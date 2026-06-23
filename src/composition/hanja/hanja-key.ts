import { currentKeyBindingPlatform, KeyBinding, KeyBindingPlatform } from "../../keyboard/key-binding";
import { KeyCode } from "../../keyboard/korean-keyboard-map";

export const defaultHanjaKeyBinding: KeyBinding = {
    code: KeyCode.ControlRight,
    ctrl: true,
    alt: false,
    shift: false,
    meta: false,
};

export const macDefaultHanjaKeyBinding: KeyBinding = {
    code: KeyCode.AltRight,
    ctrl: false,
    alt: true,
    shift: false,
    meta: false,
};

export function defaultHanjaKeyBindingForPlatform(
    platform: KeyBindingPlatform = currentKeyBindingPlatform()
): KeyBinding {
    return { ...(platform === "mac" ? macDefaultHanjaKeyBinding : defaultHanjaKeyBinding) };
}
