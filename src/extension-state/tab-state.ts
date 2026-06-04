import { KoreanKeyboardMode } from "./korean-keyboard-mode";

export type TabState = {
    isHanYongEnabled: boolean;
    isHanYongKeyboardKeyEnabled: boolean;
    koreanKeyboardMode: KoreanKeyboardMode;
    isOnScreenKeyboardEnabled: boolean;
};
