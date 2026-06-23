import { MessageKey } from "../i18n";

export enum KeyCode {
    KeyQ = "KeyQ",
    KeyW = "KeyW",
    KeyE = "KeyE",
    KeyR = "KeyR",
    KeyT = "KeyT",
    KeyY = "KeyY",
    KeyU = "KeyU",
    KeyI = "KeyI",
    KeyO = "KeyO",
    KeyP = "KeyP",
    KeyA = "KeyA",
    KeyS = "KeyS",
    KeyD = "KeyD",
    KeyF = "KeyF",
    KeyG = "KeyG",
    KeyH = "KeyH",
    KeyJ = "KeyJ",
    KeyK = "KeyK",
    KeyL = "KeyL",
    KeyZ = "KeyZ",
    KeyX = "KeyX",
    KeyC = "KeyC",
    KeyV = "KeyV",
    KeyB = "KeyB",
    KeyN = "KeyN",
    KeyM = "KeyM",
    Comma = "Comma",
    Period = "Period",
    Slash = "Slash",
    BracketLeft = "BracketLeft",
    BracketRight = "BracketRight",
    Backslash = "Backslash",
    Semicolon = "Semicolon",
    Quote = "Quote",
    Backquote = "Backquote",
    Digit1 = "Digit1",
    Digit2 = "Digit2",
    Digit3 = "Digit3",
    Digit4 = "Digit4",
    Digit5 = "Digit5",
    Digit6 = "Digit6",
    Digit7 = "Digit7",
    Digit8 = "Digit8",
    Digit9 = "Digit9",
    Digit0 = "Digit0",
    Minus = "Minus",
    Equals = "Equals",
    Tab = "Tab",
    Enter = "Enter",
    CapsLock = "CapsLock",
    ShiftLeft = "ShiftLeft",
    ShiftRight = "ShiftRight",
    Backspace = "Backspace",
    ControlLeft = "ControlLeft",
    MetaLeft = "MetaLeft",
    AltLeft = "AltLeft",
    Space = "Space",
    AltRight = "AltRight",
    MetaRight = "MetaRight",
    ContextMenu = "ContextMenu",
    ControlRight = "ControlRight",
    // Dedicated Korean-keyboard keys (real DOM `code` values): Lang1 = 한/영,
    // Lang2 = 한자. Used by the Korean full layout, where they're distinct keys
    // rather than the US layout's secondary labels on Right Alt / Right Ctrl.
    Lang1 = "Lang1",
    Lang2 = "Lang2",
}

export type KeyRecord = {
    normal?: string;
    shift?: string;

    jamo?: {
        normal: string;
        shift?: string;
    };

    label?: string;
    koreanLabel?: string;
    tooltipResourceKey?: MessageKey;
};

export function isModifierKey(code: KeyCode): boolean {
    return [
        KeyCode.ShiftLeft,
        KeyCode.ShiftRight,
        KeyCode.ControlLeft,
        KeyCode.ControlRight,
        KeyCode.MetaLeft,
        KeyCode.MetaRight,
        KeyCode.AltLeft,
        KeyCode.AltRight,
    ].includes(code);
}

export function isAltKey(code: KeyCode): code is KeyCode.AltLeft | KeyCode.AltRight {
    return [KeyCode.AltLeft, KeyCode.AltRight].includes(code);
}

/**
 * Whether the modifier flag corresponding to a (modifier) key `code` is currently
 * held, per the event's live modifier state. Maps each side's Alt/Control/Meta/Shift
 * key to its `*Key` flag. Returns false for any non-modifier code. Used to tell
 * whether a specific physical modifier — e.g. the configured Han/Yong toggle key —
 * is still down, which `event.code` alone (the key being pressed now) can't answer.
 */
export function isModifierKeyActive(
    event: { ctrlKey: boolean; altKey: boolean; shiftKey: boolean; metaKey: boolean },
    code: KeyCode
): boolean {
    switch (code) {
        case KeyCode.AltLeft:
        case KeyCode.AltRight:
            return event.altKey;
        case KeyCode.ControlLeft:
        case KeyCode.ControlRight:
            return event.ctrlKey;
        case KeyCode.MetaLeft:
        case KeyCode.MetaRight:
            return event.metaKey;
        case KeyCode.ShiftLeft:
        case KeyCode.ShiftRight:
            return event.shiftKey;
        default:
            return false;
    }
}

export const keyMap: Record<KeyCode, KeyRecord> = {
    [KeyCode.KeyQ]: {
        normal: "q",
        shift: "Q",
        jamo: {
            normal: "ㅂ",
            shift: "ㅃ",
        },
    },
    [KeyCode.KeyW]: {
        normal: "w",
        shift: "W",
        jamo: {
            normal: "ㅈ",
            shift: "ㅉ",
        },
    },
    [KeyCode.KeyE]: {
        normal: "e",
        shift: "E",
        jamo: {
            normal: "ㄷ",
            shift: "ㄸ",
        },
    },
    [KeyCode.KeyR]: {
        normal: "r",
        shift: "R",
        jamo: {
            normal: "ㄱ",
            shift: "ㄲ",
        },
    },
    [KeyCode.KeyT]: {
        normal: "t",
        shift: "T",
        jamo: {
            normal: "ㅅ",
            shift: "ㅆ",
        },
    },
    [KeyCode.KeyY]: {
        normal: "y",
        shift: "Y",
        jamo: {
            normal: "ㅛ",
        },
    },
    [KeyCode.KeyU]: {
        normal: "u",
        shift: "U",
        jamo: {
            normal: "ㅕ",
        },
    },
    [KeyCode.KeyI]: {
        normal: "i",
        shift: "I",
        jamo: {
            normal: "ㅑ",
        },
    },
    [KeyCode.KeyO]: {
        normal: "o",
        shift: "O",
        jamo: {
            normal: "ㅐ",
            shift: "ㅒ",
        },
    },
    [KeyCode.KeyP]: {
        normal: "p",
        shift: "P",
        jamo: {
            normal: "ㅔ",
            shift: "ㅖ",
        },
    },
    [KeyCode.KeyA]: {
        normal: "a",
        shift: "A",
        jamo: {
            normal: "ㅁ",
        },
    },
    [KeyCode.KeyS]: {
        normal: "s",
        shift: "S",
        jamo: {
            normal: "ㄴ",
        },
    },
    [KeyCode.KeyD]: {
        normal: "d",
        shift: "D",
        jamo: {
            normal: "ㅇ",
        },
    },
    [KeyCode.KeyF]: {
        normal: "f",
        shift: "F",
        jamo: {
            normal: "ㄹ",
        },
    },
    [KeyCode.KeyG]: {
        normal: "g",
        shift: "G",
        jamo: {
            normal: "ㅎ",
        },
    },
    [KeyCode.KeyH]: {
        normal: "h",
        shift: "H",
        jamo: {
            normal: "ㅗ",
        },
    },
    [KeyCode.KeyJ]: {
        normal: "j",
        shift: "J",
        jamo: {
            normal: "ㅓ",
        },
    },
    [KeyCode.KeyK]: {
        normal: "k",
        shift: "K",
        jamo: {
            normal: "ㅏ",
        },
    },
    [KeyCode.KeyL]: {
        normal: "l",
        shift: "L",
        jamo: {
            normal: "ㅣ",
        },
    },
    [KeyCode.KeyZ]: {
        normal: "z",
        shift: "Z",
        jamo: {
            normal: "ㅋ",
        },
    },
    [KeyCode.KeyX]: {
        normal: "x",
        shift: "X",
        jamo: {
            normal: "ㅌ",
        },
    },
    [KeyCode.KeyC]: {
        normal: "c",
        shift: "C",
        jamo: {
            normal: "ㅊ",
        },
    },
    [KeyCode.KeyV]: {
        normal: "v",
        shift: "V",
        jamo: {
            normal: "ㅍ",
        },
    },
    [KeyCode.KeyB]: {
        normal: "b",
        shift: "B",
        jamo: {
            normal: "ㅠ",
        },
    },
    [KeyCode.KeyN]: {
        normal: "n",
        shift: "N",
        jamo: {
            normal: "ㅜ",
        },
    },
    [KeyCode.KeyM]: {
        normal: "m",
        shift: "M",
        jamo: {
            normal: "ㅡ",
        },
    },
    [KeyCode.Comma]: {
        normal: ",",
        shift: "<",
    },
    [KeyCode.Period]: {
        normal: ".",
        shift: ">",
    },
    [KeyCode.Slash]: {
        normal: "/",
        shift: "?",
    },
    [KeyCode.BracketLeft]: {
        normal: "[",
        shift: "{",
    },
    [KeyCode.BracketRight]: {
        normal: "]",
        shift: "}",
    },
    [KeyCode.Backslash]: {
        normal: "\\",
        shift: "|",
    },
    [KeyCode.Semicolon]: {
        normal: ";",
        shift: ":",
    },
    [KeyCode.Quote]: {
        normal: "'",
        shift: '"',
    },
    [KeyCode.Backquote]: {
        normal: "`",
        shift: "~",
    },
    [KeyCode.Digit1]: {
        normal: "1",
        shift: "!",
    },
    [KeyCode.Digit2]: {
        normal: "2",
        shift: "@",
    },
    [KeyCode.Digit3]: {
        normal: "3",
        shift: "#",
    },
    [KeyCode.Digit4]: {
        normal: "4",
        shift: "$",
    },
    [KeyCode.Digit5]: {
        normal: "5",
        shift: "%",
    },
    [KeyCode.Digit6]: {
        normal: "6",
        shift: "^",
    },
    [KeyCode.Digit7]: {
        normal: "7",
        shift: "&",
    },
    [KeyCode.Digit8]: {
        normal: "8",
        shift: "*",
    },
    [KeyCode.Digit9]: {
        normal: "9",
        shift: "(",
    },
    [KeyCode.Digit0]: {
        normal: "0",
        shift: ")",
    },
    [KeyCode.Minus]: {
        normal: "-",
        shift: "_",
    },
    [KeyCode.Equals]: {
        normal: "=",
        shift: "+",
    },
    [KeyCode.Tab]: {
        label: "Tab",
    },
    [KeyCode.Enter]: {
        label: "Enter",
    },
    [KeyCode.CapsLock]: {
        label: "Caps Lock",
    },
    [KeyCode.ShiftLeft]: {
        label: "Shift",
    },
    [KeyCode.ShiftRight]: {
        label: "Shift",
    },
    [KeyCode.Backspace]: {
        label: "⌫",
    },
    [KeyCode.ControlLeft]: {
        label: "Ctrl",
    },
    [KeyCode.MetaLeft]: {
        label: "⊞ Win",
    },
    [KeyCode.AltLeft]: {
        label: "Alt",
    },
    [KeyCode.Space]: {
        label: "Space",
    },
    [KeyCode.AltRight]: {
        label: "한/영",
        tooltipResourceKey: "keyboard_key_altRight_tooltip",
    },
    [KeyCode.MetaRight]: {
        label: "⊞ Win",
    },
    [KeyCode.ContextMenu]: {
        label: "≣ Menu",
    },
    [KeyCode.ControlRight]: {
        label: "Ctrl",
        koreanLabel: "한자",
        tooltipResourceKey: "keyboard_key_controlRight_tooltip",
    },
    [KeyCode.Lang1]: {
        label: "한/영",
        tooltipResourceKey: "keyboard_key_altRight_tooltip",
    },
    [KeyCode.Lang2]: {
        label: "한자",
        tooltipResourceKey: "keyboard_key_controlRight_tooltip",
    },
};
