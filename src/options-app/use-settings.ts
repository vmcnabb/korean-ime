import { reactive, toRaw, watch } from "vue";
import { Settings, defaultSettings } from "../settings/settings";
import { loadSettings, saveSettings } from "../settings/settings-store";

/**
 * The options page's single reactive copy of the settings. Components bind
 * directly to it with `v-model`; mutations are persisted by the watcher set up
 * in `initSettings`. Persisting to `chrome.storage.sync` is the only
 * notification needed — other contexts react via `chrome.storage.onChanged`.
 */
export const settings = reactive<Settings>(structuredClone(defaultSettings));

let initialized = false;

export async function initSettings(): Promise<void> {
    if (initialized) {
        return;
    }
    initialized = true;

    Object.assign(settings, await loadSettings());

    // Set the watcher up only after loading, so restoring stored values
    // doesn't immediately write them straight back.
    watch(settings, () => void saveSettings(structuredClone(toRaw(settings))), { deep: true });
}
