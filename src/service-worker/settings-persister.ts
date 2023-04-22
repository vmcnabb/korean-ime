enum PersistOptions {
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

export class SettingsPersister {
    private settings: typeof defaultSettings = { ...defaultSettings };

    loadSettings() {
        console.debug("before loading settings:", this.settings);

        chrome.storage.sync.get(defaultSettings, (items: Partial<typeof defaultSettings>) => {
            (objectKeys(this.settings)).forEach(key => {
                const storedValue = items[key];
                if (storedValue === undefined) {
                    return;
                }

                if (typeof storedValue !== typeof defaultSettings[key]) {
                    return;
                }

                (this.settings[key] as any) = storedValue;
            });
        });
    }

    saveSettings() {
        console.debug("saveSettings", this.settings);
        return new Promise(resolve => {
            chrome.storage.local.set(this.settings, () => resolve(undefined));
        });
    }
}

function objectKeys<T extends object>(obj: T): (keyof T)[] {
    return Object
        .keys(obj)
        .filter(obj.hasOwnProperty) as (keyof T)[];
}

