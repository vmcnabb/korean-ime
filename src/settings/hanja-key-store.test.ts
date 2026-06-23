/**
 * @jest-environment node
 *
 * Pure storage logic — run in the `node` env (the project default is jsdom)
 * which has a real `structuredClone`, matching the browser runtimes this ships
 * to. jsdom does not provide it.
 */
import { HANJA_KEY_STORAGE_KEY, loadHanjaKeyBinding, saveHanjaKeyBinding } from "./hanja-key-store";
import { KeyBinding } from "../keyboard/key-binding";
import { KeyCode } from "../keyboard/korean-keyboard-map";
import { defaultHanjaKeyBinding, macDefaultHanjaKeyBinding } from "../composition/hanja/hanja-key";

let get: ReturnType<typeof jest.fn>;
let set: ReturnType<typeof jest.fn>;

beforeEach(() => {
    get = jest.fn();
    set = jest.fn(() => Promise.resolve());
    Object.assign(globalThis, { chrome: { storage: { local: { get, set } } } });
});

describe("loadHanjaKeyBinding", () => {
    it("returns the default Right Ctrl binding when nothing is stored on non-Mac platforms", async () => {
        get.mockReturnValue(Promise.resolve({}));

        const binding = await loadHanjaKeyBinding("default");

        expect(binding).toEqual(defaultHanjaKeyBinding);
        expect(binding).not.toBe(defaultHanjaKeyBinding);
    });

    it("returns the default Right Option binding when nothing is stored on macOS", async () => {
        get.mockReturnValue(Promise.resolve({}));

        const binding = await loadHanjaKeyBinding("mac");

        expect(binding).toEqual(macDefaultHanjaKeyBinding);
        expect(binding).not.toBe(macDefaultHanjaKeyBinding);
    });

    it("returns null when the Hanja key was explicitly turned off", async () => {
        get.mockReturnValue(Promise.resolve({ [HANJA_KEY_STORAGE_KEY]: null }));

        expect(await loadHanjaKeyBinding()).toBeNull();
    });

    it("returns the stored custom binding regardless of platform", async () => {
        const altS: KeyBinding = { code: KeyCode.KeyS, ctrl: false, alt: true, shift: false, meta: false };
        get.mockReturnValue(Promise.resolve({ [HANJA_KEY_STORAGE_KEY]: altS }));

        expect(await loadHanjaKeyBinding()).toEqual(altS);
        expect(await loadHanjaKeyBinding("mac")).toEqual(altS);
    });
});

describe("saveHanjaKeyBinding", () => {
    it("writes a binding to storage.local under the Hanja key", async () => {
        const altS: KeyBinding = { code: KeyCode.KeyS, ctrl: false, alt: true, shift: false, meta: false };

        await saveHanjaKeyBinding(altS);

        expect(set).toHaveBeenCalledWith({ [HANJA_KEY_STORAGE_KEY]: altS });
    });

    it("writes null to turn the Hanja key off", async () => {
        await saveHanjaKeyBinding(null);

        expect(set).toHaveBeenCalledWith({ [HANJA_KEY_STORAGE_KEY]: null });
    });
});
