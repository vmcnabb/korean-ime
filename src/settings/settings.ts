import { LayoutId, defaultLayoutId } from "../extension-state/osk-layout";

/** What a feature's state should be when the browser starts. */
export enum Persistence {
    AlwaysOff = "always-off",
    AlwaysOn = "always-on",
    KeepLastState = "keep-last-state",
}

export interface FeatureSettings {
    /** The feature's state when the browser starts (see {@link Persistence}). */
    persistence: Persistence;
    /**
     * Keep this feature's live on/off value the same in every tab: toggling it in
     * one tab fans the change out to all of them. When false, each tab is
     * independent. Governs only this feature's live state — not layout/size/etc.
     */
    syncAcrossTabs: boolean;
}

export interface OnScreenKeyboardSettings extends FeatureSettings {
    /** Which key arrangement the on-screen keyboard shows. */
    layout: LayoutId;
}

export interface HanYongSettings extends FeatureSettings {
    /** Whether Hangul typing is enabled at all. */
    enabled: boolean;
}

/**
 * The extension's settings. A plain, typed object — persisted to
 * `chrome.storage.sync` (see `settings-store.ts`) and edited by the options
 * page. Every context reads the same global config from storage; there is no
 * per-tab dimension here (live per-tab state lives in `StateManager`).
 *
 * The Han/Yong toggle **key** is deliberately *not* here: it is stored per
 * machine in `api.storage.local` (see `toggle-key-store.ts`), so it doesn't
 * sync across machines whose keyboards differ.
 */
export interface Settings {
    onScreenKeyboard: OnScreenKeyboardSettings;
    hanYong: HanYongSettings;
}

export const defaultSettings: Settings = {
    onScreenKeyboard: {
        persistence: Persistence.AlwaysOff,
        syncAcrossTabs: false,
        layout: defaultLayoutId,
    },
    hanYong: {
        enabled: true,
        persistence: Persistence.AlwaysOff,
        syncAcrossTabs: false,
    },
};

/**
 * The top-level `chrome.storage.sync` keys these settings occupy. Derived from
 * the defaults so it can't drift. A `storage.onChanged` listener can filter on
 * these to ignore changes it doesn't care about (see #26).
 */
export const settingsKeys = Object.keys(defaultSettings) as (keyof Settings)[];
