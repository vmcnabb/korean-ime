import { KoreanKeyboardMode } from "../../extension-state/korean-keyboard-mode";
import { isHangulInputMode, togglePopupInputMode } from "./popup-input-mode";

describe("popup input mode helpers", () => {
    it("toggles between Hangul and English", () => {
        expect(togglePopupInputMode(KoreanKeyboardMode.Hangul)).toBe(KoreanKeyboardMode.English);
        expect(togglePopupInputMode(KoreanKeyboardMode.English)).toBe(KoreanKeyboardMode.Hangul);
    });

    it("identifies Hangul mode", () => {
        expect(isHangulInputMode(KoreanKeyboardMode.Hangul)).toBe(true);
        expect(isHangulInputMode(KoreanKeyboardMode.English)).toBe(false);
    });
});
