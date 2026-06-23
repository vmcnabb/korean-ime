import { KeyCode } from "../../keyboard/korean-keyboard-map";
import { defaultHanjaKeyBinding, defaultHanjaKeyBindingForPlatform, macDefaultHanjaKeyBinding } from "./hanja-key";

describe("defaultHanjaKeyBindingForPlatform", () => {
    it("uses Right Ctrl by default and Right Option on macOS", () => {
        expect(defaultHanjaKeyBindingForPlatform("default")).toEqual({
            code: KeyCode.ControlRight,
            ctrl: true,
            alt: false,
            shift: false,
            meta: false,
        });
        expect(defaultHanjaKeyBindingForPlatform("mac")).toEqual({
            code: KeyCode.AltRight,
            ctrl: false,
            alt: true,
            shift: false,
            meta: false,
        });
    });

    it("returns fresh copies of the shared defaults", () => {
        expect(defaultHanjaKeyBindingForPlatform("default")).not.toBe(defaultHanjaKeyBinding);
        expect(defaultHanjaKeyBindingForPlatform("mac")).not.toBe(macDefaultHanjaKeyBinding);
    });
});
