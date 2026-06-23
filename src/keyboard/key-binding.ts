import { KeyCode, isModifierKey, keyMap } from "./korean-keyboard-map";

export type KeyBindingPlatform = "mac" | "default";
export type KeyBindingLabelMode = "visible" | "accessible";

/**
 * A user-configurable key (or key combination) for toggling Han/Yong mode.
 *
 * `code` is the physical key (a DOM `KeyboardEvent.code`); the four booleans are
 * the modifier state that must be held with it. A binding whose `code` is itself
 * a modifier key (e.g. Right Alt or Right Command) is a "modifier-only" binding —
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

export type ModifierState = Pick<KeyBinding, "ctrl" | "alt" | "shift" | "meta">;

export interface FormatKeyBindingOptions {
    platform?: KeyBindingPlatform;
    labelMode?: KeyBindingLabelMode;
}

/**
 * The default non-Mac toggle key: the physical Right Alt (한/영) key. `alt` is true
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

/**
 * The default Mac toggle key: the physical Right Command key, matching the
 * right-of-space position that Right Alt occupies on many PC keyboards.
 */
export const macDefaultToggleKeyBinding: KeyBinding = {
    code: KeyCode.MetaRight,
    ctrl: false,
    alt: false,
    shift: false,
    meta: true,
};

export function defaultToggleKeyBindingForPlatform(platform: KeyBindingPlatform = "default"): KeyBinding {
    return { ...(platform === "mac" ? macDefaultToggleKeyBinding : defaultToggleKeyBinding) };
}

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

/** A binding whose key is itself a modifier (e.g. a lone Right Alt or Right Command). */
export function isModifierOnlyBinding(binding: KeyBinding): boolean {
    return isModifierKey(binding.code);
}

function isControlOrAltKey(code: KeyCode): boolean {
    return [KeyCode.ControlLeft, KeyCode.ControlRight, KeyCode.AltLeft, KeyCode.AltRight].includes(code);
}

function isMetaKey(code: KeyCode): boolean {
    return [KeyCode.MetaLeft, KeyCode.MetaRight].includes(code);
}

/**
 * Whether a binding is allowed as the toggle key. A normal/printable key may
 * only be bound in combination with Ctrl/Control or Alt/Option (Shift and
 * Meta/Command alone don't qualify for combos). The standalone modifiers allowed
 * as toggle keys are Ctrl/Control and Alt/Option everywhere, plus Command on
 * macOS.
 */
export function isValidImeActionKeyBinding(binding: KeyBinding, platform: KeyBindingPlatform = "default"): boolean {
    if (isModifierOnlyBinding(binding)) {
        return isControlOrAltKey(binding.code) || (platform === "mac" && isMetaKey(binding.code));
    }

    return binding.ctrl || binding.alt;
}

/**
 * Whether a keydown/keyup event matches a binding.
 *
 * For a modifier-only binding (lone Right Alt, lone Right Command, etc.) we match on `code` alone:
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

export function keyBindingsCollide(first: KeyBinding, second: KeyBinding): boolean {
    if (first.code !== second.code) {
        return false;
    }

    if (isModifierOnlyBinding(first) || isModifierOnlyBinding(second)) {
        return true;
    }

    return (
        first.ctrl === second.ctrl &&
        first.alt === second.alt &&
        first.shift === second.shift &&
        first.meta === second.meta
    );
}

type LabelPair = {
    visible: string;
    accessible: string;
};

/** Human-readable names for keys that are bound on their own. */
const standaloneKeyLabels: Record<KeyBindingPlatform, Partial<Record<KeyCode, LabelPair>>> = {
    default: {
        [KeyCode.AltLeft]: { visible: "Left Alt", accessible: "Left Alt" },
        [KeyCode.AltRight]: { visible: "Right Alt", accessible: "Right Alt" },
        [KeyCode.ControlLeft]: { visible: "Left Ctrl", accessible: "Left Ctrl" },
        [KeyCode.ControlRight]: { visible: "Right Ctrl", accessible: "Right Ctrl" },
        [KeyCode.ShiftLeft]: { visible: "Left Shift", accessible: "Left Shift" },
        [KeyCode.ShiftRight]: { visible: "Right Shift", accessible: "Right Shift" },
        [KeyCode.MetaLeft]: { visible: "Left Win", accessible: "Left Win" },
        [KeyCode.MetaRight]: { visible: "Right Win", accessible: "Right Win" },
    },
    mac: {
        [KeyCode.AltLeft]: { visible: "Left ⌥ Option", accessible: "Left Option" },
        [KeyCode.AltRight]: { visible: "Right ⌥ Option", accessible: "Right Option" },
        [KeyCode.ControlLeft]: { visible: "Left ⌃ Control", accessible: "Left Control" },
        [KeyCode.ControlRight]: { visible: "Right ⌃ Control", accessible: "Right Control" },
        [KeyCode.ShiftLeft]: { visible: "Left ⇧ Shift", accessible: "Left Shift" },
        [KeyCode.ShiftRight]: { visible: "Right ⇧ Shift", accessible: "Right Shift" },
        [KeyCode.MetaLeft]: { visible: "Left ⌘ Command", accessible: "Left Command" },
        [KeyCode.MetaRight]: { visible: "Right ⌘ Command", accessible: "Right Command" },
    },
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

const defaultModifierOrder: Array<keyof ModifierState> = ["ctrl", "alt", "shift", "meta"];
const macModifierOrder: Array<keyof ModifierState> = ["ctrl", "shift", "meta", "alt"];

const comboModifierLabels: Record<
    KeyBindingPlatform,
    Record<KeyBindingLabelMode, Record<keyof ModifierState, string>>
> = {
    default: {
        visible: {
            ctrl: "Ctrl",
            alt: "Alt",
            shift: "Shift",
            meta: "Win",
        },
        accessible: {
            ctrl: "Ctrl",
            alt: "Alt",
            shift: "Shift",
            meta: "Win",
        },
    },
    mac: {
        visible: {
            ctrl: "⌃",
            alt: "⌥",
            shift: "⇧",
            meta: "⌘",
        },
        accessible: {
            ctrl: "Control",
            alt: "Option",
            shift: "Shift",
            meta: "Command",
        },
    },
};

function formatOptions(options: FormatKeyBindingOptions): Required<FormatKeyBindingOptions> {
    return {
        platform: options.platform ?? "default",
        labelMode: options.labelMode ?? "visible",
    };
}

export function keyBindingPlatformFromNavigator(navigatorLike: {
    platform?: string;
    userAgent?: string;
}): KeyBindingPlatform {
    const platform = navigatorLike.platform ?? "";
    const userAgent = navigatorLike.userAgent ?? "";
    return /\bMac/i.test(platform) || /\bMac OS X\b/i.test(userAgent) ? "mac" : "default";
}

export function currentKeyBindingPlatform(): KeyBindingPlatform {
    if (typeof navigator === "undefined") {
        return "default";
    }
    return keyBindingPlatformFromNavigator(navigator);
}

export function formatModifierKeys(modifiers: ModifierState, options: FormatKeyBindingOptions = {}): string[] {
    const { platform, labelMode } = formatOptions(options);
    const order = platform === "mac" ? macModifierOrder : defaultModifierOrder;
    const labels = comboModifierLabels[platform][labelMode];

    return order.flatMap((modifier) => (modifiers[modifier] ? [labels[modifier]] : []));
}

export function formatModifierKeyPrefix(modifiers: ModifierState, options: FormatKeyBindingOptions = {}): string {
    const parts = formatModifierKeys(modifiers, options);
    return parts.length ? `${parts.join(" + ")} +` : "";
}

/**
 * A short, human-readable label for a binding, e.g. "Right Alt", "Alt + S",
 * "Ctrl + Space", "Left ⌘ Command", or "⌘ + ⌥ + C". Modifier names are not
 * localized because they are hardware labels.
 */
export function formatKeyBinding(binding: KeyBinding, options: FormatKeyBindingOptions = {}): string {
    const { platform, labelMode } = formatOptions(options);

    if (isModifierOnlyBinding(binding)) {
        return standaloneKeyLabels[platform][binding.code]?.[labelMode] ?? keyLabel(binding.code);
    }

    const parts = formatModifierKeys(binding, { platform, labelMode });
    parts.push(keyLabel(binding.code));
    return parts.join(" + ");
}
