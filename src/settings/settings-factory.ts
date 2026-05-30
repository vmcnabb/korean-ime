import { createDefaultSettings } from "./default-settings";
import { SettingsChangedCallback, createSettingsStore } from "./process-settings";
import { SettingsManager } from "./settings-manager";

export async function getSettings() {
    const listeners: SettingsChangedCallback[] = [];

    const callback: SettingsChangedCallback = (path, previousValue, newValue) => {
        for (const listener of listeners) {
            try {
                listener(path, previousValue, newValue);
            } catch (e) {
                console.error(e);
            }
        }
    };

    const addSettingsUpdateListener = (listener: SettingsChangedCallback) => {
        listeners.push(listener);
    };

    const settings = createDefaultSettings();
    const settingsStore = createSettingsStore(settings, callback);

    const settingsManager = new SettingsManager(settingsStore);
    const restoredSettings = await settingsManager.restoreOptions();
    settingsManager.copySettings(restoredSettings, settingsStore);

    return {
        settings,
        settingsStore,
        settingsManager,
        addSettingsUpdateListener,
    };
}
