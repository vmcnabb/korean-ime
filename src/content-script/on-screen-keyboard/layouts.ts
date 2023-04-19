import { KeyCode } from "./korean-keyboard-map";

export type KeyboardLayout = KeyCode[][];

export const defaultLayout: KeyboardLayout = [
    [KeyCode.Backquote, KeyCode.Digit1, KeyCode.Digit2, KeyCode.Digit3, KeyCode.Digit4, KeyCode.Digit5, KeyCode.Digit6, KeyCode.Digit7, KeyCode.Digit8, KeyCode.Digit9, KeyCode.Digit0, KeyCode.Minus, KeyCode.Equals, KeyCode.Backspace],
    [KeyCode.KeyQ, KeyCode.KeyW, KeyCode.KeyE, KeyCode.KeyR, KeyCode.KeyT, KeyCode.KeyY, KeyCode.KeyU, KeyCode.KeyI, KeyCode.KeyO, KeyCode.KeyP, KeyCode.BracketLeft, KeyCode.BracketRight, KeyCode.Backslash],
    [KeyCode.KeyA, KeyCode.KeyS, KeyCode.KeyD, KeyCode.KeyF, KeyCode.KeyG, KeyCode.KeyH, KeyCode.KeyJ, KeyCode.KeyK, KeyCode.KeyL, KeyCode.Semicolon, KeyCode.Quote],
    [KeyCode.ShiftLeft, KeyCode.KeyZ, KeyCode.KeyX, KeyCode.KeyC, KeyCode.KeyV, KeyCode.KeyB, KeyCode.KeyN, KeyCode.KeyM, KeyCode.Comma, KeyCode.Period, KeyCode.Slash],
    [KeyCode.Space, KeyCode.AltRight, KeyCode.ControlRight]
];
