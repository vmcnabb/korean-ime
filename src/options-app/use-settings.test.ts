/**
 * @jest-environment node
 */
import { nextTick } from "vue";
import { defaultSettings } from "../settings/settings";

const loadSettings = jest.fn();
const saveSettings = jest.fn(async () => {});

async function loadUseSettingsModule() {
    jest.resetModules();
    jest.doMock("../settings/settings-store", () => ({ loadSettings, saveSettings }));
    return import("./use-settings");
}

beforeEach(() => {
    loadSettings.mockReset();
    saveSettings.mockReset();
    saveSettings.mockResolvedValue(undefined);
});

describe("use-settings", () => {
    it("starts with default settings before storage is loaded", async () => {
        loadSettings.mockResolvedValue(defaultSettings);

        const { settings } = await loadUseSettingsModule();

        expect(settings).toEqual(defaultSettings);
    });

    it("loads saved settings and persists later mutations", async () => {
        const storedSettings = structuredClone(defaultSettings);
        storedSettings.hanYong.enabled = false;
        loadSettings.mockResolvedValue(storedSettings);

        const { initSettings, settings } = await loadUseSettingsModule();
        await initSettings();

        expect(settings.hanYong.enabled).toBe(false);
        expect(saveSettings).not.toHaveBeenCalled();

        settings.hanYong.enabled = true;
        await nextTick();

        expect(saveSettings).toHaveBeenCalledWith({
            ...storedSettings,
            hanYong: { ...storedSettings.hanYong, enabled: true },
        });
    });
});
