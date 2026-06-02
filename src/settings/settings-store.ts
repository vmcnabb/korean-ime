import { Settings, defaultSettings } from "./settings";
import { api } from "../platform/browser-api";

/**
 * Load/save the settings to `chrome.storage.sync`.
 *
 * The write *is* the broadcast: every context (service worker, content
 * scripts, options page) can subscribe to `chrome.storage.onChanged` and react,
 * so there is no separate options→service-worker message (see #25/#26).
 */
export async function loadSettings(): Promise<Settings> {
    const stored = (await api.storage.sync.get(null)) as Record<string, unknown>;
    const result = structuredClone(defaultSettings);
    overlayStored(result as unknown as Record<string, unknown>, stored);
    return result;
}

export async function saveSettings(settings: Settings): Promise<void> {
    await api.storage.sync.set(settings);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Overlay stored values onto a fresh copy of the defaults, in place. Only keys
 * the defaults know about are copied, and only when the stored type matches —
 * so a stale or partial stored object can never drop a (possibly newly added)
 * setting or smuggle in an unexpected shape.
 */
function overlayStored(target: Record<string, unknown>, source: Record<string, unknown>): void {
    for (const key of Object.keys(target)) {
        if (!(key in source)) {
            continue;
        }

        const targetValue = target[key];
        const sourceValue = source[key];

        if (isPlainObject(targetValue) && isPlainObject(sourceValue)) {
            overlayStored(targetValue, sourceValue);
        } else if (!isPlainObject(targetValue) && typeof targetValue === typeof sourceValue) {
            target[key] = sourceValue;
        }
    }
}
