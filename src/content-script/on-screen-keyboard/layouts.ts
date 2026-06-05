import { KeyCode } from "../../keyboard/korean-keyboard-map";

/**
 * One key in a layout: its code, how many key-units wide it is (1 = a standard
 * square key), and whether it's inert — shown for keyboard fidelity but
 * de-emphasised and non-interactive (e.g. CapsLock, Ctrl, the not-yet-supported
 * 한자 key).
 */
export type LayoutKey = {
    code: KeyCode;
    width?: number;
    inert?: boolean;
};

export type KeyboardRow = LayoutKey[];
export type KeyboardLayout = KeyboardRow[];

export enum LayoutId {
    /** Alphabet keys only (jamo reference) plus Shift/Backspace/Space/한영. */
    Minimal = "minimal",
    /** Full PC keyboard, US: 한/영 and 한자 as secondary labels on Right Alt/Ctrl. */
    FullUs = "full-us",
    /** Full PC keyboard, Korean: dedicated 한자 / 한영 keys flanking a short space. */
    FullKorean = "full-korean",
}

export const defaultLayoutId = LayoutId.FullUs;

// Concise key builders: `key` is interactive, `dead` is inert (de-emphasised).
const key = (code: KeyCode, width?: number): LayoutKey => (width === undefined ? { code } : { code, width });
const dead = (code: KeyCode, width?: number): LayoutKey =>
    width === undefined ? { code, inert: true } : { code, width, inert: true };

// --- The minimal layout: just the jamo keys, plus the essentials to actually type.
const minimal: KeyboardLayout = [
    [
        KeyCode.KeyQ,
        KeyCode.KeyW,
        KeyCode.KeyE,
        KeyCode.KeyR,
        KeyCode.KeyT,
        KeyCode.KeyY,
        KeyCode.KeyU,
        KeyCode.KeyI,
        KeyCode.KeyO,
        KeyCode.KeyP,
    ].map((c) => key(c)),
    [
        KeyCode.KeyA,
        KeyCode.KeyS,
        KeyCode.KeyD,
        KeyCode.KeyF,
        KeyCode.KeyG,
        KeyCode.KeyH,
        KeyCode.KeyJ,
        KeyCode.KeyK,
        KeyCode.KeyL,
    ].map((c) => key(c)),
    [
        key(KeyCode.ShiftLeft, 1.5),
        ...[KeyCode.KeyZ, KeyCode.KeyX, KeyCode.KeyC, KeyCode.KeyV, KeyCode.KeyB, KeyCode.KeyN, KeyCode.KeyM].map((c) =>
            key(c)
        ),
        key(KeyCode.Backspace, 1.5),
    ],
    [key(KeyCode.AltRight, 2), key(KeyCode.Space, 6)],
];

// --- Shared rows 1–4 of the full PC keyboard (the two full variants only differ
//     in the bottom row).
const fullUpperRows: KeyboardLayout = [
    [
        key(KeyCode.Backquote),
        key(KeyCode.Digit1),
        key(KeyCode.Digit2),
        key(KeyCode.Digit3),
        key(KeyCode.Digit4),
        key(KeyCode.Digit5),
        key(KeyCode.Digit6),
        key(KeyCode.Digit7),
        key(KeyCode.Digit8),
        key(KeyCode.Digit9),
        key(KeyCode.Digit0),
        key(KeyCode.Minus),
        key(KeyCode.Equals),
        key(KeyCode.Backspace, 2),
    ],
    [
        key(KeyCode.Tab, 1.5),
        key(KeyCode.KeyQ),
        key(KeyCode.KeyW),
        key(KeyCode.KeyE),
        key(KeyCode.KeyR),
        key(KeyCode.KeyT),
        key(KeyCode.KeyY),
        key(KeyCode.KeyU),
        key(KeyCode.KeyI),
        key(KeyCode.KeyO),
        key(KeyCode.KeyP),
        key(KeyCode.BracketLeft),
        key(KeyCode.BracketRight),
        key(KeyCode.Backslash, 1.5),
    ],
    [
        dead(KeyCode.CapsLock, 1.75),
        key(KeyCode.KeyA),
        key(KeyCode.KeyS),
        key(KeyCode.KeyD),
        key(KeyCode.KeyF),
        key(KeyCode.KeyG),
        key(KeyCode.KeyH),
        key(KeyCode.KeyJ),
        key(KeyCode.KeyK),
        key(KeyCode.KeyL),
        key(KeyCode.Semicolon),
        key(KeyCode.Quote),
        key(KeyCode.Enter, 2.25),
    ],
    [
        key(KeyCode.ShiftLeft, 2.25),
        key(KeyCode.KeyZ),
        key(KeyCode.KeyX),
        key(KeyCode.KeyC),
        key(KeyCode.KeyV),
        key(KeyCode.KeyB),
        key(KeyCode.KeyN),
        key(KeyCode.KeyM),
        key(KeyCode.Comma),
        key(KeyCode.Period),
        key(KeyCode.Slash),
        key(KeyCode.ShiftRight, 2.75),
    ],
];

const fullUs: KeyboardLayout = [
    ...fullUpperRows,
    [
        dead(KeyCode.ControlLeft, 1.5),
        dead(KeyCode.MetaLeft, 1.25),
        dead(KeyCode.AltLeft, 1.25),
        key(KeyCode.Space, 5.75),
        key(KeyCode.AltRight, 1.25), // 한/영
        dead(KeyCode.MetaRight, 1.25),
        dead(KeyCode.ContextMenu, 1.25),
        dead(KeyCode.ControlRight, 1.5), // Ctrl · 한자 (Hanja not yet supported)
    ],
];

const fullKorean: KeyboardLayout = [
    ...fullUpperRows,
    [
        dead(KeyCode.ControlLeft, 1.5),
        dead(KeyCode.MetaLeft, 1.25),
        dead(KeyCode.AltLeft, 1.25),
        dead(KeyCode.Lang2, 1.25), // 한자 (Hanja not yet supported)
        key(KeyCode.Space, 5.75),
        key(KeyCode.Lang1, 1.25), // 한/영
        dead(KeyCode.MetaRight, 1.25),
        dead(KeyCode.ContextMenu, 1.5),
    ],
];

export const layouts: Record<LayoutId, KeyboardLayout> = {
    [LayoutId.Minimal]: minimal,
    [LayoutId.FullUs]: fullUs,
    [LayoutId.FullKorean]: fullKorean,
};
