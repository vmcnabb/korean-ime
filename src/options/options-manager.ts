
export class OptionsManager<TSettings extends {[key: string]: any}> {
    private hasLoadedSettings = false;
    private settings: TSettings;

    constructor(defaultSettings: TSettings) {
        this.settings = JSON.parse(JSON.stringify(defaultSettings))
    }

    async restoreOptions(): Promise<TSettings> {
        if (this.hasLoadedSettings) {
            return this.settings;
        }

        this.settings = await chrome.storage.sync.get(this.settings) as TSettings;

        // todo: check behaviour of chrome.storage.sync.get(defaultValues);
        // do we need to do any manual copying?

        return this.settings;
    }

    async saveSettings(settings: TSettings) {
        this.settings = JSON.parse(JSON.stringify(settings));
        await chrome.storage.sync.set(this.settings);
    }
}
