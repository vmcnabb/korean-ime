import { KeyCode } from "../../keyboard/korean-keyboard-map";
import { defaultHanjaKeyCodeForPlatform } from "./hanja-key";

describe("defaultHanjaKeyCodeForPlatform", () => {
    it("uses Right Ctrl by default and Right Option on macOS", () => {
        expect(defaultHanjaKeyCodeForPlatform("default")).toBe(KeyCode.ControlRight);
        expect(defaultHanjaKeyCodeForPlatform("mac")).toBe(KeyCode.AltRight);
    });
});
