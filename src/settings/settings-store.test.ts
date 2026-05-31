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
            shareAcrossTabs: true,
            hanYong: { persistence: Persistence.KeepLastState },
        });

        const settings = await loadSettings();

        expect(settings.shareAcrossTabs).toBe(true);
        expect(settings.hanYong.persistence).toBe(Persistence.KeepLastState);
        expect(settings.onScreenKeyboard.persistence).toBe(Persistence.AlwaysOff);
    });

    it("keeps the default when a stored value has the wrong type", async () => {
        stored({ shareAcrossTabs: "yes please" });

        expect((await loadSettings()).shareAcrossTabs).toBe(false);
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
});

describe("saveSettings", () => {
    it("writes the whole settings object to storage.sync", async () => {
        const settings: Settings = { ...defaultSettings, shareAcrossTabs: true };

        await saveSettings(settings);

        expect(set).toHaveBeenCalledWith(settings);
    });
});
