import { api } from "../platform/browser-api";
import { KeyBinding, defaultToggleKeyBinding } from "../keyboard/key-binding";

/**
 * The Han/Yong toggle key binding is stored **per machine** in
 * `api.storage.local` — deliberately separate from the synced `Settings`
 * object — because a key/combo that suits one keyboard may be wrong (or collide)
 * on another. Every context that reacts to it watches `api.storage.onChanged`
 * for area `"local"` and this key.
 *
 * Stored value semantics:
 *   - key absent  → never set → fall back to the default (Right Alt)
 *   - `null`      → the user explicitly turned the toggle key off
 *   - a binding   → the user's chosen key/combo
 */
export const TOGGLE_KEY_STORAGE_KEY = "hanYongToggleKey";

export async function loadToggleKeyBinding(): Promise<KeyBinding | null> {
    const result = (await api.storage.local.get(TOGGLE_KEY_STORAGE_KEY)) as Record<string, unknown>;
    if (!(TOGGLE_KEY_STORAGE_KEY in result)) {
        return structuredClone(defaultToggleKeyBinding);
    }
    return (result[TOGGLE_KEY_STORAGE_KEY] as KeyBinding | null) ?? null;
}

export async function saveToggleKeyBinding(binding: KeyBinding | null): Promise<void> {
    await api.storage.local.set({ [TOGGLE_KEY_STORAGE_KEY]: binding });
}
