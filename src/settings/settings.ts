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

/**
 * The extension's settings. A plain, typed object — persisted to
 * `chrome.storage.sync` (see `settings-store.ts`) and edited by the options
 * page. Every context reads the same global config from storage; there is no
 * per-tab dimension here (live per-tab state lives in `StateManager`).
 */
export interface Settings {
    onScreenKeyboard: FeatureSettings;
    hanYong: FeatureSettings;
    /** Apply changes to every tab at once, not just the focused one. */
    shareAcrossTabs: boolean;
}

export const defaultSettings: Settings = {
    onScreenKeyboard: {
        persistence: Persistence.AlwaysOff,
    },
    hanYong: {
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
