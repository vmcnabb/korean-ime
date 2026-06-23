import { KoreanKeyboardMode } from "./korean-keyboard-mode";

export type TabState = {
    isHanYongEnabled: boolean;
    isHanjaEnabled: boolean;
    showHanjaSimplified: boolean;
    showHanjaPinyin: boolean;
    koreanKeyboardMode: KoreanKeyboardMode;
    isOnScreenKeyboardEnabled: boolean;
};
