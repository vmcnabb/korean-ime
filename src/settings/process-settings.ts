import { SettingsStore } from "./default-settings";
import { OptionsSection, isOption, isSection, isSystemSetting } from "./option-types";

export type SettingsChangedCallback = (path: string, previousValue: unknown, newValue: unknown) => void;

export function createSettingsStore(settings: OptionsSection, callback: SettingsChangedCallback) {
    // create a default settings store by copying the default values from defaultSettings
    const settingsStore = {} as SettingsStore;

    for (const key of Object.keys(settings.options)) {
        const value = settings.options[key as keyof typeof settings];

        if (isSection(value)) {
            settingsStore[key as keyof SettingsStore] = populateSection(value, key, callback);
        }
    }

    return settingsStore;
}

function populateSection(section: OptionsSection, path: string, callback: SettingsChangedCallback): unknown {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const storeSection = {} as any;

    for (const key of Object.keys(section.options)) {
        const value = section.options[key];

        if (isSection(value)) {
            storeSection[key as keyof typeof storeSection] = populateSection(value, `${path}.${key}`, callback);
        } else if (isOption(value)) {
            storeSection[key as keyof typeof storeSection] = value.value;

            if (isSystemSetting(value)) {
                continue;
            }

            // put getter and setter on the OptionsSection option, referencing the store
            Object.defineProperty(value, "value", {
                get() {
                    return storeSection[key];
                },
                set(value) {
                    const previousValue = storeSection[key];

                    if (previousValue !== value) {
                        storeSection[key] = value;
                        callback(`${path}.${key}`, previousValue, value);
                    }
                },
            });
        }
    }

    return storeSection;
}
