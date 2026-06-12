import { KeyCode } from "./korean-keyboard-map";
import {
    KeyBinding,
    defaultToggleKeyBinding,
    formatKeyBinding,
    isModifierOnlyBinding,
    isValidToggleKeyBinding,
    keyBindingFromEvent,
    matchesKeyBinding,
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

describe("isModifierOnlyBinding", () => {
    it("is true for a bound modifier key", () => {
        expect(isModifierOnlyBinding(binding(KeyCode.AltRight, { alt: true }))).toBe(true);
        expect(isModifierOnlyBinding(binding(KeyCode.ControlLeft, { ctrl: true }))).toBe(true);
    });

    it("is false for a printable combo", () => {
        expect(isModifierOnlyBinding(binding(KeyCode.KeyS, { alt: true }))).toBe(false);
    });
});

describe("isValidToggleKeyBinding", () => {
    it("allows a lone Ctrl or Alt key", () => {
        expect(isValidToggleKeyBinding(binding(KeyCode.AltRight, { alt: true }))).toBe(true);
        expect(isValidToggleKeyBinding(binding(KeyCode.ControlRight, { ctrl: true }))).toBe(true);
    });

    it("allows a printable key combined with Ctrl or Alt", () => {
        expect(isValidToggleKeyBinding(binding(KeyCode.KeyS, { alt: true }))).toBe(true);
        expect(isValidToggleKeyBinding(binding(KeyCode.Space, { ctrl: true }))).toBe(true);
        expect(isValidToggleKeyBinding(binding(KeyCode.KeyS, { ctrl: true, shift: true }))).toBe(true);
    });

    it("rejects a bare printable key", () => {
        expect(isValidToggleKeyBinding(binding(KeyCode.KeyS))).toBe(false);
    });

    it("rejects Shift- or Meta-only combinations", () => {
        expect(isValidToggleKeyBinding(binding(KeyCode.KeyS, { shift: true }))).toBe(false);
        expect(isValidToggleKeyBinding(binding(KeyCode.Space, { meta: true }))).toBe(false);
        expect(isValidToggleKeyBinding(binding(KeyCode.ShiftLeft, { shift: true }))).toBe(false);
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
});
