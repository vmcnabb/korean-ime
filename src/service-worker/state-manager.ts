import { TabState } from "../extension-state/tab-state";
import { KoreanKeyboardMode } from "../extension-state/korean-keyboard-mode";
import icon16h from "url:../images/icon16h.png";
import icon16a from "url:../images/icon16a.png";
import {
    ServiceScriptMessage,
    ServiceScriptMessageAction,
    SendKeyServiceMessage,
} from "../messaging/service-to-content-messages";
import { menus } from "./menus";
import { sendMessageToTab } from "./send-message-to-tab";
import { Persistence, Settings } from "../settings/settings";
import { loadSettings } from "../settings/settings-store";
import { debugLog } from "../debug-log";

/**
 * Global current live state (browser-session-lived). New tabs inherit it, and
 * in "share across tabs" mode every tab is kept equal to it. Updated whenever a
 * tab's state changes or a tab becomes active.
 */
const LIVE_STATE_KEY = "liveState";
/** Persisted (survives restart) last state, source for KeepLastState seeding. */
const LAST_STATE_KEY = "lastState";

/**
 * Manages extension state for all tabs.
 *
 * Live per-tab state lives in `storage.session` (`tabState-<id>`). Two globals
 * connect it to the user's settings (#26):
 *  - `storage.session[liveState]` — the current value new tabs inherit (and
 *    that all tabs share when "share across tabs" is on). Tracks the last
 *    active tab.
 *  - `storage.local[lastState]` — the value remembered across a browser
 *    restart, used to seed `KeepLastState` features on a fresh session.
 *
 * Persistence policy (Always off / Always on / Keep last state) governs only
 * how a *fresh session* is seeded; mid-session, a new tab simply inherits the
 * last active tab's state (see {@link deriveInitialState}).
 */
export class StateManager {
    public constructor() {
        // ensure we are only referenced from the service worker
        if (!chrome.runtime.onMessage) {
            throw new Error("StateManager can only be used from the service worker");
        }
    }

    public async setFocusedFrame(tabId: number, frameId: number) {
        await chrome.storage.session.set({ [this.focusedFrameKey(tabId)]: frameId });
    }

    public async routeSendKey(tabId: number, data: SendKeyServiceMessage["data"]) {
        const key = this.focusedFrameKey(tabId);
        const frameId = (await chrome.storage.session.get(key))[key] as number | undefined;
        if (frameId === undefined) {
            return;
        }
        const message: SendKeyServiceMessage = {
            type: "serviceScriptMessage",
            action: ServiceScriptMessageAction.SendKey,
            data,
        };
        await sendMessageToTab(tabId, message, { frameId });
    }

    public async toggleHanYongMode(tabId: number): Promise<void> {
        await this.setTabState(tabId, (tabState) => ({
            ...tabState,
            koreanKeyboardMode:
                tabState.koreanKeyboardMode === KoreanKeyboardMode.Hangul
                    ? KoreanKeyboardMode.English
                    : KoreanKeyboardMode.Hangul,
        }));
    }

    /**
     * Toggles the on-screen keyboard state for the given tab and returns the new state
     * @param tabId The ID of the tab for which to toggle the on-screen keyboard
     * @returns true if the on-screen keyboard is now enabled, false if it is now disabled
     */
    public async toggleOnScreenKeyboard(tabId: number): Promise<boolean> {
        const newTabState = await this.setTabState(tabId, (tabState) => ({
            ...tabState,
            isOnScreenKeyboardEnabled: !tabState.isOnScreenKeyboardEnabled,
        }));

        return newTabState.isOnScreenKeyboardEnabled;
    }

    public async updatePresentation(tabId: number) {
        const tabState = await this.getTabState(tabId);

        const isHangulMode = tabState.koreanKeyboardMode === KoreanKeyboardMode.Hangul;
        await chrome.action.setIcon({
            tabId: tabId,
            path: isHangulMode ? icon16h : icon16a,
        });

        // Update the on-screen-keyboard menu checkbox. The menu may not exist
        // yet (it's created on install); tolerate that rather than throwing an
        // unhandled rejection into the presentation path.
        try {
            await chrome.contextMenus.update(menus.onScreenKeyboard.id, {
                checked: tabState.isOnScreenKeyboardEnabled,
            });
        } catch (error) {
            debugLog("Could not update on-screen-keyboard menu item:", error);
        }
    }

    /**
     * Record that a tab became active. Its state becomes the live value that
     * subsequently-opened tabs inherit (the "new tab adopts the last active
     * tab" behaviour).
     */
    public async markTabActive(tabId: number): Promise<void> {
        await this.setLiveState(await this.getTabState(tabId));
    }

    /**
     * React to a settings change (the service worker's top-level
     * `storage.onChanged` listener calls this — see #25/#26).
     *
     * Persistence changes are restart-only, so they don't disturb open tabs.
     * The one live effect is enabling "share across tabs": that should converge
     * the currently-open tabs onto the shared live value immediately.
     */
    public async onSettingsChanged(): Promise<void> {
        const settings = await loadSettings();
        if (!settings.shareAcrossTabs) {
            return;
        }

        let live = await this.getLiveState();
        if (!live) {
            const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
            live = active?.id !== undefined ? await this.getTabState(active.id) : await this.deriveInitialState();
            await this.setLiveState(live);
        }
        await this.broadcastState(live);
    }

    /**
     * Updates a tab's state and propagates it. Returns the new state.
     *
     * Always updates the global live value (so new tabs inherit it) and, for any
     * `KeepLastState` feature, the persisted `storage.local` value. When "share
     * across tabs" is on, mirrors the new state to every open tab instead of
     * just this one.
     * @param tabId The ID of the tab for which to update the state
     * @param updateFn function that takes the current tab state and returns the new tab state
     */
    private async setTabState(tabId: number, updateFn: (tabState: TabState) => TabState): Promise<TabState> {
        const settings = await loadSettings();
        const currentTabState = await this.getTabState(tabId);
        const newTabState = updateFn(currentTabState);

        await chrome.storage.session.set({ [this.tabStateKey(tabId)]: newTabState });
        await this.persistLastState(settings, newTabState);
        await this.setLiveState(newTabState);

        if (settings.shareAcrossTabs) {
            await this.broadcastState(newTabState);
        } else {
            await this.sendStateToTab(tabId);
        }

        return newTabState;
    }

    /** Push a tab's current state to it and refresh its icon / menu presentation. */
    public async sendStateToTab(tabId: number) {
        const state = await this.getTabState(tabId);
        await this.pushState(tabId, state);
        await this.updatePresentation(tabId);
    }

    private async pushState(tabId: number, state: TabState) {
        await sendMessageToTab<ServiceScriptMessage>(tabId, {
            type: "serviceScriptMessage",
            action: ServiceScriptMessageAction.UpdateState,
            data: state,
        });
    }

    /** Apply one state to every open tab (used in "share across tabs" mode). */
    private async broadcastState(state: TabState) {
        const tabs = await chrome.tabs.query({});
        await Promise.all(
            tabs.map(async (tab) => {
                if (tab.id === undefined) {
                    return;
                }
                await chrome.storage.session.set({ [this.tabStateKey(tab.id)]: state });
                await this.pushState(tab.id, state);
                await this.updatePresentation(tab.id);
            })
        );
    }

    /**
     * Discards the state for a tab. Call this when a tab closes so per-tab state
     * doesn't accumulate. Tab state lives in session storage (tab ids are only
     * meaningful within a browser session), so it's all cleared on browser
     * close anyway — this just reclaims it promptly during a long session.
     */
    public async clearTabState(tabId: number) {
        await chrome.storage.session.remove([this.tabStateKey(tabId), this.focusedFrameKey(tabId)]);
    }

    private tabStateKey(tabId: number) {
        return `tabState-${tabId}`;
    }

    private focusedFrameKey(tabId: number) {
        return `focusedFrame-${tabId}`;
    }

    private async getTabState(tabId: number): Promise<TabState> {
        const storageKey = this.tabStateKey(tabId);
        const result = await chrome.storage.session.get(storageKey);
        const tabState = result[storageKey] as TabState | undefined;

        if (tabState) {
            return this.cloneTabState(tabState);
        }

        return this.deriveInitialState();
    }

    /**
     * The state a tab starts in. Mid-session it inherits the global live value
     * (the last active tab, also the shared value when sharing is on). Only on a
     * fresh session — when no live value exists yet — does persistence policy
     * decide the seed, reading `storage.local` for `KeepLastState`.
     */
    private async deriveInitialState(): Promise<TabState> {
        const live = await this.getLiveState();
        if (live) {
            return live;
        }

        const settings = await loadSettings();
        const last = await this.getLastState();
        const lastHangul = (last.koreanKeyboardMode ?? KoreanKeyboardMode.English) === KoreanKeyboardMode.Hangul;

        return {
            isOnScreenKeyboardEnabled: this.seedFeature(
                settings.onScreenKeyboard.persistence,
                last.isOnScreenKeyboardEnabled ?? false
            ),
            koreanKeyboardMode: this.seedFeature(settings.hanYong.persistence, lastHangul)
                ? KoreanKeyboardMode.Hangul
                : KoreanKeyboardMode.English,
        };
    }

    /** How a feature is seeded on a fresh session, given its persistence policy. */
    private seedFeature(persistence: Persistence, lastValue: boolean): boolean {
        switch (persistence) {
            case Persistence.AlwaysOff:
                return false;
            case Persistence.AlwaysOn:
                return true;
            case Persistence.KeepLastState:
                return lastValue;
            default:
                // loadSettings only type-checks via `typeof`, so a stale or
                // corrupt persistence value in storage.sync can slip through as
                // a string. Treat anything unrecognised as "off".
                return false;
        }
    }

    /** Persist the new value to `storage.local`, but only for KeepLastState features. */
    private async persistLastState(settings: Settings, next: TabState) {
        const oskKeepsState = settings.onScreenKeyboard.persistence === Persistence.KeepLastState;
        const hanYongKeepsState = settings.hanYong.persistence === Persistence.KeepLastState;

        if (!oskKeepsState && !hanYongKeepsState) {
            return;
        }

        const updated: Partial<TabState> = { ...(await this.getLastState()) };

        if (oskKeepsState) {
            updated.isOnScreenKeyboardEnabled = next.isOnScreenKeyboardEnabled;
        }
        if (hanYongKeepsState) {
            updated.koreanKeyboardMode = next.koreanKeyboardMode;
        }

        await chrome.storage.local.set({ [LAST_STATE_KEY]: updated });
    }

    private async getLastState(): Promise<Partial<TabState>> {
        const result = await chrome.storage.local.get(LAST_STATE_KEY);
        return (result[LAST_STATE_KEY] as Partial<TabState> | undefined) ?? {};
    }

    private async getLiveState(): Promise<TabState | undefined> {
        const result = await chrome.storage.session.get(LIVE_STATE_KEY);
        const live = result[LIVE_STATE_KEY] as TabState | undefined;
        return live ? this.cloneTabState(live) : undefined;
    }

    private async setLiveState(state: TabState) {
        await chrome.storage.session.set({ [LIVE_STATE_KEY]: this.cloneTabState(state) });
    }

    private cloneTabState(tabState: TabState): TabState {
        return { ...tabState };
    }
}
