import { api } from "../platform/browser-api";
import { KeyBinding, KeyBindingPlatform, currentKeyBindingPlatform } from "../keyboard/key-binding";
import { defaultHanjaKeyBindingForPlatform } from "../composition/hanja/hanja-key";

/**
 * The Hanja conversion key is stored per machine in `api.storage.local`, for
 * the same reason as the Han/Yong toggle key: useful physical keys vary across
 * keyboards and operating systems.
 *
 * Stored value semantics:
 *   - key absent  → never set → fall back to the platform default
 *   - `null`      → the user explicitly turned the Hanja key off
 *   - a binding   → the user's chosen key/combo
 */
export const HANJA_KEY_STORAGE_KEY = "hanjaConversionKey";

export async function loadHanjaKeyBinding(
    platform: KeyBindingPlatform = currentKeyBindingPlatform()
): Promise<KeyBinding | null> {
    const result = (await api.storage.local.get(HANJA_KEY_STORAGE_KEY)) as Record<string, unknown>;
    if (!(HANJA_KEY_STORAGE_KEY in result)) {
        return defaultHanjaKeyBindingForPlatform(platform);
    }
    return (result[HANJA_KEY_STORAGE_KEY] as KeyBinding | null) ?? null;
}

export async function saveHanjaKeyBinding(binding: KeyBinding | null): Promise<void> {
    await api.storage.local.set({ [HANJA_KEY_STORAGE_KEY]: binding });
}
