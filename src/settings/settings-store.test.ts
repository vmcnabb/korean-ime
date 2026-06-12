/**
 * @jest-environment node
 *
 * Pure data logic with no DOM needs — run it in the `node` env (the project
 * default is jsdom), which has a real `structuredClone`, matching the browser
 * runtimes this code actually ships to. jsdom does not provide it.
 */
import { loadSettings, saveSettings } from "./settings-store";
import { Persistence, Settings, defaultSettings } from "./settings";

let get: ReturnType<typeof jest.fn>;
let set: ReturnType<typeof jest.fn>;

beforeEach(() => {
    get = jest.fn();
    set = jest.fn(() => Promise.resolve());
    Object.assign(globalThis, { chrome: { storage: { sync: { get, set } } } });
});

function stored(value: Record<string, unknown>) {
    get.mockReturnValue(Promise.resolve(value));
}

describe("loadSettings", () => {
    it("returns the defaults when nothing is stored", async () => {
        stored({});

        expect(await loadSettings()).toEqual(defaultSettings);
    });

    it("returns a fresh copy, not the shared defaults object", async () => {
        stored({});

        const settings = await loadSettings();

        expect(settings).not.toBe(defaultSettings);
        expect(settings.onScreenKeyboard).not.toBe(defaultSettings.onScreenKeyboard);
    });

    it("overlays stored values, keeping defaults for untouched keys", async () => {
        stored({
            hanYong: { persistence: Persistence.KeepLastState, syncAcrossTabs: true },
        });

        const settings = await loadSettings();

        expect(settings.hanYong.persistence).toBe(Persistence.KeepLastState);
        expect(settings.hanYong.syncAcrossTabs).toBe(true);
        expect(settings.hanYong.enabled).toBe(true);
        expect(settings.onScreenKeyboard.persistence).toBe(Persistence.AlwaysOff);
    });

    it("keeps the default when a stored value has the wrong type", async () => {
        stored({ hanYong: { syncAcrossTabs: "yes please" } });

        expect((await loadSettings()).hanYong.syncAcrossTabs).toBe(false);
    });

    it("migrates the legacy top-level shareAcrossTabs onto both feature flags", async () => {
        stored({ shareAcrossTabs: true });

        const settings = await loadSettings();

        expect(settings.hanYong.syncAcrossTabs).toBe(true);
        expect(settings.onScreenKeyboard.syncAcrossTabs).toBe(true);
        expect(settings).not.toHaveProperty("shareAcrossTabs");
    });

    it("lets an explicit feature sync flag win over the legacy shareAcrossTabs", async () => {
        stored({ shareAcrossTabs: true, hanYong: { syncAcrossTabs: false } });

        const settings = await loadSettings();

        expect(settings.hanYong.syncAcrossTabs).toBe(false);
        expect(settings.onScreenKeyboard.syncAcrossTabs).toBe(true);
    });

    it("ignores keys that are not part of the settings", async () => {
        stored({ removedLongAgo: 42 });

        const settings = await loadSettings();

        expect(settings).toEqual(defaultSettings);
        expect(settings).not.toHaveProperty("removedLongAgo");
    });

    it("deep-merges nested objects instead of replacing them wholesale", async () => {
        // A partial nested object must not drop the keys it omits.
        stored({ onScreenKeyboard: {} });

        expect((await loadSettings()).onScreenKeyboard.persistence).toBe(Persistence.AlwaysOff);
    });

    it("keeps the default object when a non-object is stored in its place", async () => {
        stored({ onScreenKeyboard: "garbage" });

        expect((await loadSettings()).onScreenKeyboard).toEqual(defaultSettings.onScreenKeyboard);
    });

    it("keeps newly added nested defaults when older stored objects omit them", async () => {
        stored({ hanYong: { persistence: Persistence.KeepLastState } });

        expect((await loadSettings()).hanYong.enabled).toBe(true);
    });
});

describe("saveSettings", () => {
    it("writes the whole settings object to storage.sync", async () => {
        const settings: Settings = structuredClone(defaultSettings);
        settings.hanYong.syncAcrossTabs = true;

        await saveSettings(settings);

        expect(set).toHaveBeenCalledWith(settings);
    });
});
