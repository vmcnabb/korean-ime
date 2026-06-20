import { TabState } from "../extension-state/tab-state";
import { KoreanKeyboardMode } from "../extension-state/korean-keyboard-mode";
import icon16h from "url:../images/icon16h.png";
import icon24h from "url:../images/icon24h.png";
import icon32h from "url:../images/icon32h.png";
import icon16a from "url:../images/icon16a.png";
import icon24a from "url:../images/icon24a.png";
import icon32a from "url:../images/icon32a.png";
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
import { api } from "../platform/browser-api";
import { t } from "../i18n";

/**
 * Global current live state (browser-session-lived). New tabs inherit it, and
 * any field with `syncAcrossTabs` on is kept equal to it across every open tab.
 * Updated whenever a tab's state changes or a tab becomes active.
 */
const LIVE_STATE_KEY = "liveState";
/** Persisted (survives restart) last state, source for KeepLastState seeding. */
const LAST_STATE_KEY = "lastState";
const hangulActionIcons = { 16: icon16h, 24: icon24h, 32: icon32h };
const englishActionIcons = { 16: icon16a, 24: icon24a, 32: icon32a };

/**
 * Manages extension state for all tabs.
 *
 * Live per-tab state lives in `storage.session` (`tabState-<id>`). Two globals
 * connect it to the user's settings (#26):
 *  - `storage.session[liveState]` — the current value new tabs inherit (and the
 *    source for any field synced across tabs). Tracks the last active tab.
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
        if (!api.runtime.onMessage) {
            throw new Error("StateManager can only be used from the service worker");
        }
    }

    public async setFocusedFrame(tabId: number, frameId: number) {
        await api.storage.session.set({ [this.focusedFrameKey(tabId)]: frameId });
    }

    public async routeSendKey(tabId: number, data: SendKeyServiceMessage["data"]) {
        const key = this.focusedFrameKey(tabId);
        const frameId = (await api.storage.session.get(key))[key] as number | undefined;
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
        const settings = await loadSettings();
        if (!settings.hanYong.enabled) {
            return;
        }

        await this.setTabState(
            tabId,
            (tabState) => ({
                ...tabState,
                koreanKeyboardMode:
                    tabState.koreanKeyboardMode === KoreanKeyboardMode.Hangul
                        ? KoreanKeyboardMode.English
                        : KoreanKeyboardMode.Hangul,
            }),
            settings
        );
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

    /** Explicitly set the on-screen keyboard on or off (e.g. the OSK's close button). */
    public async setOnScreenKeyboardEnabled(tabId: number, enabled: boolean): Promise<void> {
        await this.setTabState(tabId, (tabState) => ({
            ...tabState,
            isOnScreenKeyboardEnabled: enabled,
        }));
    }

    public async updatePresentation(tabId: number, tabState?: TabState) {
        const currentState = tabState ?? (await this.getTabState(tabId));

        const isHangulMode = currentState.koreanKeyboardMode === KoreanKeyboardMode.Hangul;
        await api.action.setIcon({
            tabId: tabId,
            path: isHangulMode ? hangulActionIcons : englishActionIcons,
        });
        await api.action.setTitle({
            tabId: tabId,
            title: t(isHangulMode ? "action_title_hangul" : "action_title_english"),
        });

        // Update the on-screen-keyboard menu checkbox. The menu may not exist
        // yet (it's created on service-worker startup); tolerate that rather
        // than throwing an unhandled rejection into the presentation path.
        try {
            await api.contextMenus.update(menus.onScreenKeyboard.id, {
                checked: currentState.isOnScreenKeyboardEnabled,
            });
        } catch (error) {
            debugLog("Could not update on-screen-keyboard menu item:", error);
        }
    }

    /**
     * Refresh the action icon and menu checkbox for the currently active tab.
     * Called after the menus are (re)created on service-worker startup: the
     * checkbox is recreated unchecked, so without this it would misrepresent an
     * enabled on-screen keyboard until the next state change.
     */
    public async refreshActiveTabPresentation(): Promise<void> {
        const [active] = await api.tabs.query({ active: true, lastFocusedWindow: true });
        if (active?.id !== undefined) {
            await this.updatePresentation(active.id);
        }
    }

    /**
     * Record that a tab became active. Its state becomes the live value that
     * subsequently-opened tabs inherit (the "new tab adopts the last active
     * tab" behaviour).
     */
    public async markTabActive(tabId: number): Promise<void> {
        await this.setLiveState(await this.anchorTabState(tabId));
    }

    /**
     * Ensure a tab has its *own* persisted state. A tab that inherited its state
     * (a newly opened/cloned tab) has no `tabState-<id>` entry, so every read
     * would otherwise fall back to the global live value and the tab would keep
     * tracking whatever tab was last active. Persisting the derived state on
     * first sight anchors the tab so it becomes independent. Returns the state.
     */
    private async anchorTabState(tabId: number, settings?: Settings): Promise<TabState> {
        const currentSettings = settings ?? (await loadSettings());
        const key = this.tabStateKey(tabId);
        const existing = (await api.storage.session.get(key))[key] as Partial<TabState> | undefined;
        const anchored = existing
            ? this.hydrateTabState(existing, currentSettings)
            : await this.deriveInitialState(currentSettings);
        await api.storage.session.set({ [key]: anchored });
        return anchored;
    }

    /**
     * React to a settings change (the service worker's top-level
     * `storage.onChanged` listener calls this — see #25/#26).
     *
     * Some settings affect open tabs immediately and so must be propagated:
     *  - Enabling/disabling Hangul typing (or the configured Han/Yong toggle key)
     *    is re-derived for every tab by `hydrateTabState`, so each open tab is
     *    re-sent its state to reflect the change.
     *  - Turning on a feature's `syncAcrossTabs` converges the currently-open
     *    tabs onto the shared live value for that feature's field.
     *
     * Persistence changes remain restart-only (they only seed a fresh session),
     * so re-sending state is a harmless no-op for them. Each tab is pushed its
     * own re-hydrated state, with any synced field overlaid from the live value.
     */
    public async onSettingsChanged(): Promise<void> {
        const settings = await loadSettings();
        const live = await this.getLiveState(settings);
        if (live) {
            await this.setLiveState(live);
        }

        // Re-send every open tab its own re-hydrated state, overlaying any field
        // that's now synced so the open tabs converge onto the shared live value
        // (e.g. when a syncAcrossTabs flag was just turned on).
        const shared = this.syncedFields(live, settings);
        const tabs = await api.tabs.query({});
        await Promise.all(
            tabs.map(async (tab) => {
                if (tab.id === undefined) {
                    return;
                }
                const own = await this.anchorTabState(tab.id, settings);
                const merged = this.hydrateTabState({ ...own, ...shared }, settings);
                await api.storage.session.set({ [this.tabStateKey(tab.id)]: merged });
                await this.pushState(tab.id, merged);
                await this.updatePresentation(tab.id, merged);
            })
        );
    }

    /**
     * Updates a tab's state and propagates it. Returns the new state.
     *
     * Always updates the global live value (so new tabs inherit it) and, for any
     * `KeepLastState` feature, the persisted `storage.local` value. Any field
     * whose `syncAcrossTabs` flag is on is also mirrored to every other open tab
     * (see {@link shareToOtherTabs}).
     * @param tabId The ID of the tab for which to update the state
     * @param updateFn function that takes the current tab state and returns the new tab state
     */
    private async setTabState(
        tabId: number,
        updateFn: (tabState: TabState) => TabState,
        settings?: Settings
    ): Promise<TabState> {
        const currentSettings = settings ?? (await loadSettings());
        // Captured before we move the live value, so tabs that are still tracking
        // it (no own state yet) keep their current un-synced fields below.
        const previousLive = await this.getLiveState(currentSettings);
        const currentTabState = await this.anchorTabState(tabId, currentSettings);
        const newTabState = this.hydrateTabState(updateFn(currentTabState), currentSettings);

        await api.storage.session.set({ [this.tabStateKey(tabId)]: newTabState });
        await this.persistLastState(currentSettings, newTabState);
        await this.setLiveState(newTabState);

        await this.pushState(tabId, newTabState);
        await this.updatePresentation(tabId, newTabState);
        await this.shareToOtherTabs(tabId, newTabState, previousLive, currentSettings);

        return newTabState;
    }

    /**
     * Fan the synced fields of one tab's new state out to every *other* open tab.
     * Only the fields whose `syncAcrossTabs` flag is on are applied; each target
     * tab keeps its own value for the rest (e.g. syncing keyboard visibility must
     * not disturb another tab's Han/Yong mode). A tab with no state of its own is
     * still tracking the previous live value, so that's the base we preserve.
     */
    private async shareToOtherTabs(
        sourceTabId: number,
        sourceState: TabState,
        previousLive: TabState | undefined,
        settings: Settings
    ): Promise<void> {
        const shared = this.syncedFields(sourceState, settings);
        if (Object.keys(shared).length === 0) {
            return;
        }

        const tabs = await api.tabs.query({});
        await Promise.all(
            tabs.map(async (tab) => {
                if (tab.id === undefined || tab.id === sourceTabId) {
                    return;
                }
                const key = this.tabStateKey(tab.id);
                const own = (await api.storage.session.get(key))[key] as Partial<TabState> | undefined;
                const base = own ?? previousLive ?? sourceState;
                const merged = this.hydrateTabState({ ...base, ...shared }, settings);
                await api.storage.session.set({ [key]: merged });
                await this.pushState(tab.id, merged);
                await this.updatePresentation(tab.id, merged);
            })
        );
    }

    /**
     * The subset of a state's live fields that are currently synced across tabs,
     * per each feature's `syncAcrossTabs` flag. Returns {} when `source` is
     * undefined (no live value yet) or nothing is synced.
     */
    private syncedFields(source: TabState | undefined, settings: Settings): Partial<TabState> {
        const fields: Partial<TabState> = {};
        if (!source) {
            return fields;
        }
        if (settings.onScreenKeyboard.syncAcrossTabs) {
            fields.isOnScreenKeyboardEnabled = source.isOnScreenKeyboardEnabled;
        }
        if (settings.hanYong.syncAcrossTabs) {
            fields.koreanKeyboardMode = source.koreanKeyboardMode;
        }
        return fields;
    }

    /** Push a tab's current state to it and refresh its icon / menu presentation. */
    public async sendStateToTab(tabId: number, settings?: Settings) {
        const currentSettings = settings ?? (await loadSettings());
        // Anchor on the way out so a freshly loaded/cloned tab persists its
        // inherited state and stops tracking the global live value.
        const state = await this.anchorTabState(tabId, currentSettings);
        await this.pushState(tabId, state);
        await this.updatePresentation(tabId, state);
    }

    private async pushState(tabId: number, state: TabState) {
        await sendMessageToTab<ServiceScriptMessage>(tabId, {
            type: "serviceScriptMessage",
            action: ServiceScriptMessageAction.UpdateState,
            data: state,
        });
    }

    /**
     * Discards the state for a tab. Call this when a tab closes so per-tab state
     * doesn't accumulate. Tab state lives in session storage (tab ids are only
     * meaningful within a browser session), so it's all cleared on browser
     * close anyway — this just reclaims it promptly during a long session.
     */
    public async clearTabState(tabId: number) {
        await api.storage.session.remove([this.tabStateKey(tabId), this.focusedFrameKey(tabId)]);
    }

    private tabStateKey(tabId: number) {
        return `tabState-${tabId}`;
    }

    private focusedFrameKey(tabId: number) {
        return `focusedFrame-${tabId}`;
    }

    private async getTabState(tabId: number, settings?: Settings): Promise<TabState> {
        const currentSettings = settings ?? (await loadSettings());
        const storageKey = this.tabStateKey(tabId);
        const result = await api.storage.session.get(storageKey);
        const tabState = result[storageKey] as Partial<TabState> | undefined;

        if (tabState) {
            return this.hydrateTabState(tabState, currentSettings);
        }

        return this.deriveInitialState(currentSettings);
    }

    /**
     * The state a tab starts in. Mid-session it inherits the global live value
     * (the last active tab, also the shared value when sharing is on). Only on a
     * fresh session — when no live value exists yet — does persistence policy
     * decide the seed, reading `storage.local` for `KeepLastState`.
     */
    private async deriveInitialState(settings?: Settings): Promise<TabState> {
        const currentSettings = settings ?? (await loadSettings());
        const live = await this.getLiveState(currentSettings);
        if (live) {
            return live;
        }

        // No live value yet, so seed from persistence. This is safe even though
        // liveState isn't initialized until the first toggle/activation:
        // liveState lives in storage.session (survives SW respawns, cleared only
        // on browser close), so the undefined window is just the start of a
        // fresh session. And there, seeding and inheritance are equivalent —
        // every tab seeds identically, and the only paths that make a tab differ
        // from that seed (setTabState / broadcast) also set liveState. So by the
        // time inheritance could differ from the seed, liveState is already set.
        const last = await this.getLastState();
        const lastHangul = (last.koreanKeyboardMode ?? KoreanKeyboardMode.English) === KoreanKeyboardMode.Hangul;

        return this.hydrateTabState(
            {
                isOnScreenKeyboardEnabled: this.seedFeature(
                    currentSettings.onScreenKeyboard.persistence,
                    last.isOnScreenKeyboardEnabled ?? false
                ),
                koreanKeyboardMode: this.seedFeature(currentSettings.hanYong.persistence, lastHangul)
                    ? KoreanKeyboardMode.Hangul
                    : KoreanKeyboardMode.English,
            },
            currentSettings
        );
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
                // a string. Treat anything unrecognized as "off".
                return false;
        }
    }

    /** Persist the new value to `storage.local`, but only for KeepLastState features. */
    private async persistLastState(settings: Settings, next: TabState) {
        const oskKeepsState = settings.onScreenKeyboard.persistence === Persistence.KeepLastState;
        const hanYongKeepsState =
            settings.hanYong.enabled && settings.hanYong.persistence === Persistence.KeepLastState;

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

        await api.storage.local.set({ [LAST_STATE_KEY]: updated });
    }

    private async getLastState(): Promise<Partial<TabState>> {
        const result = await api.storage.local.get(LAST_STATE_KEY);
        return (result[LAST_STATE_KEY] as Partial<TabState> | undefined) ?? {};
    }

    private async getLiveState(settings?: Settings): Promise<TabState | undefined> {
        const currentSettings = settings ?? (await loadSettings());
        const result = await api.storage.session.get(LIVE_STATE_KEY);
        const live = result[LIVE_STATE_KEY] as Partial<TabState> | undefined;
        return live ? this.hydrateTabState(live, currentSettings) : undefined;
    }

    private async setLiveState(state: TabState) {
        await api.storage.session.set({ [LIVE_STATE_KEY]: this.cloneTabState(state) });
    }

    private hydrateTabState(tabState: Partial<TabState>, settings: Settings): TabState {
        const isHanYongEnabled = settings.hanYong.enabled;

        return {
            isHanYongEnabled,
            isOnScreenKeyboardEnabled: tabState.isOnScreenKeyboardEnabled ?? false,
            koreanKeyboardMode:
                isHanYongEnabled && tabState.koreanKeyboardMode === KoreanKeyboardMode.Hangul
                    ? KoreanKeyboardMode.Hangul
                    : KoreanKeyboardMode.English,
        };
    }

    private cloneTabState(tabState: TabState): TabState {
        return { ...tabState };
    }
}
