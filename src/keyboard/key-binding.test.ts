import { KeyCode } from "./korean-keyboard-map";
import {
    KeyBinding,
    defaultToggleKeyBindingForPlatform,
    defaultToggleKeyBinding,
    formatKeyBinding,
    formatModifierKeyPrefix,
    isValidImeActionKeyBinding,
    isModifierOnlyBinding,
    keyBindingsCollide,
    keyBindingPlatformFromNavigator,
    keyBindingFromEvent,
    matchesKeyBinding,
    macDefaultToggleKeyBinding,
} from "./key-binding";

type EventLike = { code: string; ctrlKey: boolean; altKey: boolean; shiftKey: boolean; metaKey: boolean };

function event(code: KeyCode, modifiers: Partial<Omit<EventLike, "code">> = {}): EventLike {
    return { code, ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, ...modifiers };
}

function binding(code: KeyCode, modifiers: Partial<Omit<KeyBinding, "code">> = {}): KeyBinding {
    return { code, ctrl: false, alt: false, shift: false, meta: false, ...modifiers };
}

describe("keyBindingFromEvent", () => {
    it("captures the code and the held modifiers", () => {
        expect(keyBindingFromEvent(event(KeyCode.KeyS, { altKey: true }))).toEqual(
            binding(KeyCode.KeyS, { alt: true })
        );
    });

    it("captures a lone Right Alt as a modifier-only binding", () => {
        expect(keyBindingFromEvent(event(KeyCode.AltRight, { altKey: true }))).toEqual(defaultToggleKeyBinding);
    });
});

describe("defaultToggleKeyBindingForPlatform", () => {
    it("uses Right Alt by default and Right Command on macOS", () => {
        expect(defaultToggleKeyBindingForPlatform()).toEqual(defaultToggleKeyBinding);
        expect(defaultToggleKeyBindingForPlatform("default")).toEqual(defaultToggleKeyBinding);
        expect(defaultToggleKeyBindingForPlatform("mac")).toEqual(macDefaultToggleKeyBinding);
    });

    it("returns fresh copies of the shared defaults", () => {
        expect(defaultToggleKeyBindingForPlatform()).not.toBe(defaultToggleKeyBinding);
        expect(defaultToggleKeyBindingForPlatform("mac")).not.toBe(macDefaultToggleKeyBinding);
    });
});

describe("isModifierOnlyBinding", () => {
    it("is true for a bound modifier key", () => {
        expect(isModifierOnlyBinding(binding(KeyCode.AltRight, { alt: true }))).toBe(true);
        expect(isModifierOnlyBinding(binding(KeyCode.ControlLeft, { ctrl: true }))).toBe(true);
    });

    it("is false for a printable combo", () => {
        expect(isModifierOnlyBinding(binding(KeyCode.KeyS, { alt: true }))).toBe(false);
    });
});

describe("isValidImeActionKeyBinding", () => {
    it("allows a lone Ctrl or Alt key on all platforms", () => {
        expect(isValidImeActionKeyBinding(binding(KeyCode.AltRight, { alt: true }))).toBe(true);
        expect(isValidImeActionKeyBinding(binding(KeyCode.ControlRight, { ctrl: true }))).toBe(true);
    });

    it("allows a printable key combined with Ctrl or Alt on all platforms", () => {
        expect(isValidImeActionKeyBinding(binding(KeyCode.KeyS, { alt: true }))).toBe(true);
        expect(isValidImeActionKeyBinding(binding(KeyCode.Space, { ctrl: true }))).toBe(true);
        expect(isValidImeActionKeyBinding(binding(KeyCode.KeyS, { ctrl: true, shift: true }))).toBe(true);
        expect(isValidImeActionKeyBinding(binding(KeyCode.Space, { ctrl: true, meta: true }))).toBe(true);
    });

    it("rejects a bare printable key", () => {
        expect(isValidImeActionKeyBinding(binding(KeyCode.KeyS))).toBe(false);
    });

    it("rejects Shift- or Meta-only combinations by default", () => {
        expect(isValidImeActionKeyBinding(binding(KeyCode.KeyS, { shift: true }))).toBe(false);
        expect(isValidImeActionKeyBinding(binding(KeyCode.Space, { meta: true }))).toBe(false);
        expect(isValidImeActionKeyBinding(binding(KeyCode.ShiftLeft, { shift: true }))).toBe(false);
        expect(isValidImeActionKeyBinding(binding(KeyCode.MetaLeft, { meta: true }))).toBe(false);
    });

    it("allows a lone Command key on macOS", () => {
        expect(isValidImeActionKeyBinding(binding(KeyCode.MetaLeft, { meta: true }), "mac")).toBe(true);
        expect(isValidImeActionKeyBinding(binding(KeyCode.MetaRight, { meta: true }), "mac")).toBe(true);
    });

    it("requires Control or Option for normal-key combinations on macOS", () => {
        expect(isValidImeActionKeyBinding(binding(KeyCode.KeyS, { meta: true }), "mac")).toBe(false);
        expect(isValidImeActionKeyBinding(binding(KeyCode.KeyK, { shift: true, meta: true }), "mac")).toBe(false);
        expect(isValidImeActionKeyBinding(binding(KeyCode.KeyC, { meta: true, alt: true }), "mac")).toBe(true);
        expect(isValidImeActionKeyBinding(binding(KeyCode.Space, { meta: true, ctrl: true }), "mac")).toBe(true);
    });
});

describe("matchesKeyBinding", () => {
    it("matches the default Right Alt on code alone, ignoring extra modifiers (e.g. AltGr's Ctrl)", () => {
        expect(matchesKeyBinding(event(KeyCode.AltRight, { altKey: true }), defaultToggleKeyBinding)).toBe(true);
        expect(
            matchesKeyBinding(event(KeyCode.AltRight, { altKey: true, ctrlKey: true }), defaultToggleKeyBinding)
        ).toBe(true);
    });

    it("does not match a different key", () => {
        expect(matchesKeyBinding(event(KeyCode.AltLeft, { altKey: true }), defaultToggleKeyBinding)).toBe(false);
    });

    it("matches a printable combo only with the exact modifier state", () => {
        const altS = binding(KeyCode.KeyS, { alt: true });
        expect(matchesKeyBinding(event(KeyCode.KeyS, { altKey: true }), altS)).toBe(true);
        expect(matchesKeyBinding(event(KeyCode.KeyS, { altKey: true, ctrlKey: true }), altS)).toBe(false);
        expect(matchesKeyBinding(event(KeyCode.KeyS), altS)).toBe(false);
    });
});

describe("keyBindingsCollide", () => {
    it("collides modifier-only bindings by physical key code", () => {
        expect(
            keyBindingsCollide(
                binding(KeyCode.ControlRight, { ctrl: true }),
                binding(KeyCode.ControlRight, { ctrl: true, alt: true })
            )
        ).toBe(true);
    });

    it("collides printable combos only when the full modifier state matches", () => {
        expect(keyBindingsCollide(binding(KeyCode.KeyS, { alt: true }), binding(KeyCode.KeyS, { alt: true }))).toBe(
            true
        );
        expect(
            keyBindingsCollide(binding(KeyCode.KeyS, { alt: true }), binding(KeyCode.KeyS, { alt: true, ctrl: true }))
        ).toBe(false);
    });

    it("does not collide different physical keys", () => {
        expect(keyBindingsCollide(binding(KeyCode.KeyS, { alt: true }), binding(KeyCode.KeyD, { alt: true }))).toBe(
            false
        );
    });
});

describe("formatKeyBinding", () => {
    it("names a lone modifier key", () => {
        expect(formatKeyBinding(defaultToggleKeyBinding)).toBe("Right Alt");
        expect(formatKeyBinding(binding(KeyCode.ControlLeft, { ctrl: true }))).toBe("Left Ctrl");
    });

    it("joins modifiers and the key for a combo", () => {
        expect(formatKeyBinding(binding(KeyCode.KeyS, { alt: true }))).toBe("Alt + S");
        expect(formatKeyBinding(binding(KeyCode.Space, { ctrl: true }))).toBe("Ctrl + Space");
        expect(formatKeyBinding(binding(KeyCode.KeyK, { ctrl: true, shift: true }))).toBe("Ctrl + Shift + K");
    });

    it("uses Mac glyphs and names for standalone modifier bindings on macOS", () => {
        expect(formatKeyBinding(binding(KeyCode.MetaLeft, { meta: true }), { platform: "mac" })).toBe("Left ⌘ Command");
        expect(formatKeyBinding(binding(KeyCode.AltRight, { alt: true }), { platform: "mac" })).toBe("Right ⌥ Option");
        expect(formatKeyBinding(binding(KeyCode.ControlLeft, { ctrl: true }), { platform: "mac" })).toBe(
            "Left ⌃ Control"
        );
    });

    it("uses compact Mac glyphs for visible combo labels on macOS", () => {
        expect(formatKeyBinding(binding(KeyCode.KeyC, { meta: true, alt: true }), { platform: "mac" })).toBe(
            "⌘ + ⌥ + C"
        );
        expect(formatKeyBinding(binding(KeyCode.Space, { ctrl: true, meta: true }), { platform: "mac" })).toBe(
            "⌃ + ⌘ + Space"
        );
        expect(formatKeyBinding(binding(KeyCode.KeyK, { shift: true, alt: true }), { platform: "mac" })).toBe(
            "⇧ + ⌥ + K"
        );
    });

    it("can return accessible names for Mac glyph labels", () => {
        expect(
            formatKeyBinding(binding(KeyCode.KeyC, { meta: true, alt: true }), {
                platform: "mac",
                labelMode: "accessible",
            })
        ).toBe("Command + Option + C");
        expect(
            formatKeyBinding(binding(KeyCode.MetaLeft, { meta: true }), {
                platform: "mac",
                labelMode: "accessible",
            })
        ).toBe("Left Command");
    });
});

describe("formatModifierKeyPrefix", () => {
    it("formats held modifiers with the same platform-aware labels", () => {
        expect(formatModifierKeyPrefix({ ctrl: false, alt: true, shift: false, meta: true })).toBe("Alt + Win +");
        expect(formatModifierKeyPrefix({ ctrl: false, alt: true, shift: false, meta: true }, { platform: "mac" })).toBe(
            "⌘ + ⌥ +"
        );
        expect(
            formatModifierKeyPrefix(
                { ctrl: false, alt: true, shift: false, meta: true },
                { platform: "mac", labelMode: "accessible" }
            )
        ).toBe("Command + Option +");
    });
});

describe("keyBindingPlatformFromNavigator", () => {
    it("detects macOS from platform or user agent", () => {
        expect(keyBindingPlatformFromNavigator({ platform: "MacIntel" })).toBe("mac");
        expect(keyBindingPlatformFromNavigator({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" })).toBe(
            "mac"
        );
    });

    it("uses default labels for non-Mac platforms", () => {
        expect(keyBindingPlatformFromNavigator({ platform: "Win32" })).toBe("default");
        expect(keyBindingPlatformFromNavigator({ platform: "Linux x86_64" })).toBe("default");
    });
});
