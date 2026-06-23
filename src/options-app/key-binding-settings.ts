import {
    KeyBinding,
    KeyBindingPlatform,
    currentKeyBindingPlatform,
    defaultToggleKeyBindingForPlatform,
    formatKeyBinding,
    keyBindingsCollide,
} from "../keyboard/key-binding";
import { defaultHanjaKeyBindingForPlatform } from "../composition/hanja/hanja-key";
import { TOGGLE_KEY_STORAGE_KEY, loadToggleKeyBinding, saveToggleKeyBinding } from "../settings/toggle-key-store";
import { HANJA_KEY_STORAGE_KEY, loadHanjaKeyBinding, saveHanjaKeyBinding } from "../settings/hanja-key-store";
import { t, type MessageKey } from "../i18n";
import { ImeKeySettingKind, notifyKeyBindingUnbound } from "./key-binding-events";

/**
 * Everything a `KeyBindingField` needs to drive one configurable IME key, as
 * plain data. The field component is generic and receives one of these as a
 * prop; the registry below lists every key so collision handling can scan across
 * all of them.
 *
 * **To add another configurable key:** add a config object and list it in
 * `keyBindingFieldConfigs` (guarded by its feature flag, if any). The field,
 * collision, and flash machinery need no changes — they are driven entirely by
 * this data.
 */
export type KeyBindingFieldConfig = {
    kind: ImeKeySettingKind;
    storageKey: string;
    loadBinding: () => Promise<KeyBinding | null>;
    saveBinding: (binding: KeyBinding | null) => Promise<void>;
    defaultBindingForPlatform: (platform: KeyBindingPlatform) => KeyBinding;
    labelKey: MessageKey;
    descriptionKey: MessageKey;
    /** Shown in another field when *this* key is the one unbound by a collision. */
    unboundMessageKey: MessageKey;
};

export const hanYongKeyConfig: KeyBindingFieldConfig = {
    kind: "hanYong",
    storageKey: TOGGLE_KEY_STORAGE_KEY,
    loadBinding: loadToggleKeyBinding,
    saveBinding: saveToggleKeyBinding,
    defaultBindingForPlatform: defaultToggleKeyBindingForPlatform,
    labelKey: "options_hanYong_toggleKey_label",
    descriptionKey: "options_hanYong_toggleKey_description",
    unboundMessageKey: "options_keyBinding_hanYongUnbound",
};

export const hanjaKeyConfig: KeyBindingFieldConfig = {
    kind: "hanja",
    storageKey: HANJA_KEY_STORAGE_KEY,
    loadBinding: loadHanjaKeyBinding,
    saveBinding: saveHanjaKeyBinding,
    defaultBindingForPlatform: defaultHanjaKeyBindingForPlatform,
    labelKey: "options_hanja_conversionKey_label",
    descriptionKey: "options_hanja_conversionKey_description",
    unboundMessageKey: "options_keyBinding_hanjaUnbound",
};

/**
 * Every configurable key that exists in this build. Flag-gated keys are only
 * included when their feature is built in: `process.env.KIME_ENABLE_HANJA` is
 * inlined at build time, so with the flag off the Hanja entry (and, with it, the
 * Hanja key store) tree-shakes out of the production bundle — and the Han/Yong
 * key can never "collide" with a key the user can't reach.
 */
export const keyBindingFieldConfigs: readonly KeyBindingFieldConfig[] = [
    hanYongKeyConfig,
    ...(process.env.KIME_ENABLE_HANJA === "true" ? [hanjaKeyConfig] : []),
];

export type KeyBindingCollision = {
    /** The storage key of the key that was unbound — so the field that triggered
     *  the collision can drop its notice once that key is rebound. */
    unboundStorageKey: string;
    /** A message naming what was unbound, to show on the triggering field. */
    message: string;
};

/**
 * Resolve a collision for a key the user is about to set. If `next` would fire on
 * the same keydown as another configured key's current binding, that other key is
 * unbound (a physical key can't drive two IME actions), its field is flashed, and
 * the unbound key + a message naming it are returned. Scans every *other*
 * available key, so it scales as more keys are added. Returns null when there is
 * no collision.
 */
export async function resolveKeyBindingCollision(
    self: KeyBindingFieldConfig,
    next: KeyBinding
): Promise<KeyBindingCollision | null> {
    const platform = currentKeyBindingPlatform();

    for (const other of keyBindingFieldConfigs) {
        if (other.kind === self.kind) {
            continue;
        }

        const otherBinding = await other.loadBinding();
        if (otherBinding && keyBindingsCollide(next, otherBinding)) {
            await other.saveBinding(null);
            notifyKeyBindingUnbound(other.kind);
            return {
                unboundStorageKey: other.storageKey,
                message: t(other.unboundMessageKey, formatKeyBinding(otherBinding, { platform })),
            };
        }
    }

    return null;
}
