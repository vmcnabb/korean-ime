export enum PersistOptions {
    AlwaysOff = 0,
    AlwaysOn = 1,
    KeepLastState = 2,
}

const defaultSettings = {
    onScreenKeyboard: {
        persist: PersistOptions.AlwaysOff,
        lastState: false,
    },
    hanYongToggle: {
        persist: PersistOptions.AlwaysOff,
        lastState: false,
    }
};

export type Settings = typeof defaultSettings;

export class OptionsManager {
    private hasLoadedSettings = false;
    private settings: Settings = JSON.parse(JSON.stringify(defaultSettings));

    async restoreOptions(): Promise<Settings> {
        if (this.hasLoadedSettings) {
            return this.settings;
        }

        return new Promise<typeof defaultSettings>(resolve => {
            chrome.storage.sync.get(defaultSettings, (items: Partial<Settings>) => {
                objectKeys(this.settings).forEach(key => {
                    const storedValue = items[key];
                    if (storedValue === undefined) {
                        return;
                    }

                    if (typeof storedValue !== typeof defaultSettings[key]) {
                        return;
                    }

                    (this.settings[key] as any) = storedValue;
                });

                this.hasLoadedSettings = true;
                resolve(this.settings);
            });
        });
    }

    async saveSettings(settings: typeof defaultSettings) {
        this.settings = settings;
        return new Promise<void>(resolve => {
            chrome.storage.sync.set(this.settings, () => resolve());
        });
    }
}

function objectKeys<T extends object>(obj: T): (keyof T)[] {
    return Object
        .keys(obj)
        .filter(key => obj.hasOwnProperty(key)) as (keyof T)[];
}
