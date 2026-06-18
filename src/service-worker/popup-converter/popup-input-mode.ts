import { KoreanKeyboardMode } from "../../extension-state/korean-keyboard-mode";

export function togglePopupInputMode(mode: KoreanKeyboardMode): KoreanKeyboardMode {
    return mode === KoreanKeyboardMode.Hangul ? KoreanKeyboardMode.English : KoreanKeyboardMode.Hangul;
}

export function isHangulInputMode(mode: KoreanKeyboardMode): boolean {
    return mode === KoreanKeyboardMode.Hangul;
}
