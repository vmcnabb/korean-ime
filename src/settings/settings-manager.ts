export class SettingsManager<TSettings extends { [key: string]: any }> {
    private hasLoadedSettings = false;
    private settings: TSettings;

    constructor(defaultSettings: TSettings) {
        this.settings = JSON.parse(JSON.stringify(defaultSettings));
    }

    async restoreOptions(): Promise<TSettings> {
        if (this.hasLoadedSettings) {
            return this.settings;
        }

        const storedSettings = (await chrome.storage.sync.get(
            this.settings
        )) as TSettings;
        this.copySettings(storedSettings, this.settings);

        return this.settings;
    }

    async saveSettings(settings: TSettings) {
        this.settings = JSON.parse(JSON.stringify(settings));
        await chrome.storage.sync.set(this.settings);
    }

    copySettings(from: TSettings, to: TSettings) {
        for (const key of Object.keys(from)) {
            const value = from[key as keyof TSettings];

            if (typeof value === "object") {
                this.copySettings(value, to[key as keyof TSettings]);

                // only copy values that are the same type
            } else if (typeof value == typeof to[key as keyof TSettings]) {
                to[key as keyof TSettings] = value;
            }
        }
    }
}
