import { KeyCode, isModifierKey, keyMap } from "./korean-keyboard-map";

/**
 * A user-configurable key (or key combination) for toggling Han/Yong mode.
 *
 * `code` is the physical key (a DOM `KeyboardEvent.code`); the four booleans are
 * the modifier state that must be held with it. A binding whose `code` is itself
 * a modifier key (e.g. Right Alt, the default) is a "modifier-only" binding —
 * see {@link isModifierOnlyBinding} and the matching rules in
 * {@link matchesKeyBinding}.
 */
export interface KeyBinding {
    code: KeyCode;
    ctrl: boolean;
    alt: boolean;
    shift: boolean;
    meta: boolean;
}

/**
 * The default toggle key: the physical Right Alt (한/영) key. `alt` is true
 * because pressing Right Alt itself sets `event.altKey` — but matching a
 * modifier-only binding ignores the modifier flags anyway (see
 * {@link matchesKeyBinding}).
 */
export const defaultToggleKeyBinding: KeyBinding = {
    code: KeyCode.AltRight,
    ctrl: false,
    alt: true,
    shift: false,
    meta: false,
};

/** Build a binding from a captured keydown event. */
export function keyBindingFromEvent(event: {
    code: string;
    ctrlKey: boolean;
    altKey: boolean;
    shiftKey: boolean;
    metaKey: boolean;
}): KeyBinding {
    return {
        code: event.code as KeyCode,
        ctrl: event.ctrlKey,
        alt: event.altKey,
        shift: event.shiftKey,
        meta: event.metaKey,
    };
}

/** A binding whose key is itself a modifier (e.g. a lone Right Alt). */
export function isModifierOnlyBinding(binding: KeyBinding): boolean {
    return isModifierKey(binding.code);
}

/**
 * Whether a binding is allowed as the toggle key. A normal/printable key may
 * only be bound in combination with Ctrl or Alt (Shift alone doesn't qualify);
 * the only keys allowed on their own are ones that are themselves Ctrl or Alt
 * (their own modifier flag is set, e.g. the default Right Alt → `alt: true`).
 * Both cases reduce to: the binding must carry Ctrl or Alt.
 */
export function isValidToggleKeyBinding(binding: KeyBinding): boolean {
    return binding.ctrl || binding.alt;
}

/**
 * Whether a keydown/keyup event matches a binding.
 *
 * For a modifier-only binding (lone Right Alt, etc.) we match on `code` alone:
 * a bare modifier's own flags vary by platform — AltGr, for instance, reports
 * both Ctrl and Alt — so requiring an exact modifier match would break the
 * default on some layouts. For a printable/combo binding (Alt+S, Ctrl+Space, …)
 * the modifier state must match exactly, so Alt+S never fires on Ctrl+Alt+S.
 */
export function matchesKeyBinding(
    event: { code: string; ctrlKey: boolean; altKey: boolean; shiftKey: boolean; metaKey: boolean },
    binding: KeyBinding
): boolean {
    if (event.code !== binding.code) {
        return false;
    }

    if (isModifierOnlyBinding(binding)) {
        return true;
    }

    return (
        event.ctrlKey === binding.ctrl &&
        event.altKey === binding.alt &&
        event.shiftKey === binding.shift &&
        event.metaKey === binding.meta
    );
}

/** Human-readable names for keys that are bound on their own. */
const standaloneKeyLabels: Partial<Record<KeyCode, string>> = {
    [KeyCode.AltLeft]: "Left Alt",
    [KeyCode.AltRight]: "Right Alt",
    [KeyCode.ControlLeft]: "Left Ctrl",
    [KeyCode.ControlRight]: "Right Ctrl",
    [KeyCode.ShiftLeft]: "Left Shift",
    [KeyCode.ShiftRight]: "Right Shift",
    [KeyCode.MetaLeft]: "Left Win",
    [KeyCode.MetaRight]: "Right Win",
};

function keyLabel(code: KeyCode): string {
    const key = keyMap[code];
    if (key?.label) {
        return key.label;
    }
    if (key?.normal) {
        return key.normal.toUpperCase();
    }
    return code;
}

/**
 * A short, human-readable label for a binding, e.g. "Right Alt", "Alt + S",
 * "Ctrl + Space". Modifier names are not localized (Ctrl/Alt/Shift/Win are
 * effectively universal on a keyboard).
 */
export function formatKeyBinding(binding: KeyBinding): string {
    if (isModifierOnlyBinding(binding)) {
        return standaloneKeyLabels[binding.code] ?? keyLabel(binding.code);
    }

    const parts: string[] = [];
    if (binding.ctrl) {
        parts.push("Ctrl");
    }
    if (binding.alt) {
        parts.push("Alt");
    }
    if (binding.shift) {
        parts.push("Shift");
    }
    if (binding.meta) {
        parts.push("Win");
    }
    parts.push(keyLabel(binding.code));
    return parts.join(" + ");
}
