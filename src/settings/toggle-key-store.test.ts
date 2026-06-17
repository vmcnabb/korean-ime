/**
 * @jest-environment node
 *
 * Pure storage logic — run in the `node` env (the project default is jsdom)
 * which has a real `structuredClone`, matching the browser runtimes this ships
 * to. jsdom does not provide it.
 */
import { TOGGLE_KEY_STORAGE_KEY, loadToggleKeyBinding, saveToggleKeyBinding } from "./toggle-key-store";
import { defaultToggleKeyBinding, KeyBinding, macDefaultToggleKeyBinding } from "../keyboard/key-binding";
import { KeyCode } from "../keyboard/korean-keyboard-map";

let get: ReturnType<typeof jest.fn>;
let set: ReturnType<typeof jest.fn>;

beforeEach(() => {
    get = jest.fn();
    set = jest.fn(() => Promise.resolve());
    Object.assign(globalThis, { chrome: { storage: { local: { get, set } } } });
});

describe("loadToggleKeyBinding", () => {
    it("returns the default Right Alt binding when nothing is stored on non-Mac platforms", async () => {
        get.mockReturnValue(Promise.resolve({}));

        const binding = await loadToggleKeyBinding("default");

        expect(binding).toEqual(defaultToggleKeyBinding);
        // A fresh copy, not the shared default object.
        expect(binding).not.toBe(defaultToggleKeyBinding);
    });

    it("returns the default Right Command binding when nothing is stored on macOS", async () => {
        get.mockReturnValue(Promise.resolve({}));

        const binding = await loadToggleKeyBinding("mac");

        expect(binding).toEqual(macDefaultToggleKeyBinding);
        // A fresh copy, not the shared default object.
        expect(binding).not.toBe(macDefaultToggleKeyBinding);
    });

    it("returns null when the toggle key was explicitly turned off", async () => {
        get.mockReturnValue(Promise.resolve({ [TOGGLE_KEY_STORAGE_KEY]: null }));

        expect(await loadToggleKeyBinding()).toBeNull();
    });

    it("returns the stored custom binding regardless of platform", async () => {
        const altS: KeyBinding = { code: KeyCode.KeyS, ctrl: false, alt: true, shift: false, meta: false };
        get.mockReturnValue(Promise.resolve({ [TOGGLE_KEY_STORAGE_KEY]: altS }));

        expect(await loadToggleKeyBinding()).toEqual(altS);
        expect(await loadToggleKeyBinding("mac")).toEqual(altS);
    });
});

describe("saveToggleKeyBinding", () => {
    it("writes a binding to storage.local under the toggle key", async () => {
        const altS: KeyBinding = { code: KeyCode.KeyS, ctrl: false, alt: true, shift: false, meta: false };

        await saveToggleKeyBinding(altS);

        expect(set).toHaveBeenCalledWith({ [TOGGLE_KEY_STORAGE_KEY]: altS });
    });

    it("writes null to turn the toggle key off", async () => {
        await saveToggleKeyBinding(null);

        expect(set).toHaveBeenCalledWith({ [TOGGLE_KEY_STORAGE_KEY]: null });
    });
});
