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

/** Global, browser-session-lived shared value, used when `shareAcrossTabs`. */
const SHARED_LIVE_STATE_KEY = "sharedLiveState";
/** Persisted (survives restart) last toggled value, source for KeepLastState. */
const LAST_STATE_KEY = "lastState";

/**
 * Manages extension state for all tabs.
 *
 * Live per-tab state lives in `storage.session` (`tabState-<id>`). Two extra
 * slots connect it to the user's settings (#26):
 *  - `storage.session[sharedLiveState]` — when "share across tabs" is on, the
 *    one value every tab adopts.
 *  - `storage.local[lastState]` — the remembered value for features set to
 *    `KeepLastState`, the only state that survives a browser restart.
 * Initial state is *derived* from `Settings` (see {@link deriveInitialState})
 * rather than a hardcoded default.
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

        // update on-screen-keyboard menu item to checked or not
        await chrome.contextMenus.update(menus.onScreenKeyboard.id, {
            checked: tabState.isOnScreenKeyboardEnabled,
        });
    }

    /**
     * React to a settings change (the service worker's top-level
     * `storage.onChanged` listener calls this — see #25/#26). Settings only
     * change how *new* tabs derive their initial state, except for "share
     * across tabs": flipping it on should immediately converge open tabs, so we
     * seed the shared value from the active tab and broadcast it.
     */
    public async onSettingsChanged(): Promise<void> {
        const settings = await loadSettings();

        if (!settings.shareAcrossTabs) {
            // Persistence changes affect only future tabs/sessions; just refresh
            // presentation so any settings-derived UI stays correct.
            const tabs = await chrome.tabs.query({});
            await Promise.all(tabs.map((tab) => (tab.id !== undefined ? this.updatePresentation(tab.id) : undefined)));
            return;
        }

        let shared = await this.getSharedLiveState();
        if (!shared) {
            const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
            shared = active?.id !== undefined ? await this.getTabState(active.id) : await this.deriveInitialState();
            await this.setSharedLiveState(shared);
        }
        await this.broadcastState(shared);
    }

    /**
     * Updates the TabState and propagates it. Returns the new state.
     *
     * Side effects beyond the per-tab slot: persists to `storage.local` for any
     * feature set to `KeepLastState`, and — when "share across tabs" is on —
     * mirrors the new state to the shared slot and every open tab instead of
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

        if (settings.shareAcrossTabs) {
            await this.setSharedLiveState(newTabState);
            await this.broadcastState(newTabState);
        } else {
            await this.sendStateToTab(tabId);
            await this.updatePresentation(tabId);
        }

        return newTabState;
    }

    public async sendStateToTab(tabId: number) {
        await this.pushState(tabId, await this.getTabState(tabId));
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
     * The state a tab starts in, derived from settings. In share mode an
     * existing shared value wins (so tabs opened later adopt it); otherwise each
     * feature follows its persistence policy, reading the remembered value for
     * `KeepLastState`.
     */
    private async deriveInitialState(): Promise<TabState> {
        const settings = await loadSettings();

        if (settings.shareAcrossTabs) {
            const shared = await this.getSharedLiveState();
            if (shared) {
                return shared;
            }
        }

        const last = await this.getLastState();

        const lastHangul = (last.koreanKeyboardMode ?? KoreanKeyboardMode.English) === KoreanKeyboardMode.Hangul;

        return {
            isOnScreenKeyboardEnabled: this.deriveFeature(
                settings.onScreenKeyboard.persistence,
                last.isOnScreenKeyboardEnabled ?? false
            ),
            koreanKeyboardMode: this.deriveFeature(settings.hanYong.persistence, lastHangul)
                ? KoreanKeyboardMode.Hangul
                : KoreanKeyboardMode.English,
        };
    }

    private deriveFeature(persistence: Persistence, lastValue: boolean): boolean {
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

    private async getSharedLiveState(): Promise<TabState | undefined> {
        const result = await chrome.storage.session.get(SHARED_LIVE_STATE_KEY);
        const shared = result[SHARED_LIVE_STATE_KEY] as TabState | undefined;
        return shared ? this.cloneTabState(shared) : undefined;
    }

    private async setSharedLiveState(state: TabState) {
        await chrome.storage.session.set({ [SHARED_LIVE_STATE_KEY]: this.cloneTabState(state) });
    }

    private cloneTabState(tabState: TabState): TabState {
        return { ...tabState };
    }
}
