import { currentKeyBindingPlatform, KeyBindingPlatform } from "../../keyboard/key-binding";
import { KeyCode } from "../../keyboard/korean-keyboard-map";

export function defaultHanjaKeyCodeForPlatform(platform: KeyBindingPlatform = currentKeyBindingPlatform()): KeyCode {
    return platform === "mac" ? KeyCode.AltRight : KeyCode.ControlRight;
}

export function isDefaultHanjaKey(event: { code: string }): boolean {
    return event.code === defaultHanjaKeyCodeForPlatform();
}
