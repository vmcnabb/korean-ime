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
}

export interface OnScreenKeyboardSettings extends FeatureSettings {
    /** Which key arrangement the on-screen keyboard shows. */
    layout: LayoutId;
}

export interface HanYongSettings extends FeatureSettings {
    /** Whether Hangul typing is enabled at all. */
    enabled: boolean;
    /** Whether the physical Right Alt / Han-Yong key toggles modes. */
    keyboardKeyEnabled: boolean;
}

/**
 * The extension's settings. A plain, typed object — persisted to
 * `chrome.storage.sync` (see `settings-store.ts`) and edited by the options
 * page. Every context reads the same global config from storage; there is no
 * per-tab dimension here (live per-tab state lives in `StateManager`).
 */
export interface Settings {
    onScreenKeyboard: OnScreenKeyboardSettings;
    hanYong: HanYongSettings;
    /** Apply changes to every tab at once, not just the focused one. */
    shareAcrossTabs: boolean;
}

export const defaultSettings: Settings = {
    onScreenKeyboard: {
        persistence: Persistence.AlwaysOff,
        layout: defaultLayoutId,
    },
    hanYong: {
        enabled: true,
        keyboardKeyEnabled: true,
        persistence: Persistence.AlwaysOff,
    },
    shareAcrossTabs: false,
};

/**
 * The top-level `chrome.storage.sync` keys these settings occupy. Derived from
 * the defaults so it can't drift. A `storage.onChanged` listener can filter on
 * these to ignore changes it doesn't care about (see #26).
 */
export const settingsKeys = Object.keys(defaultSettings) as (keyof Settings)[];
