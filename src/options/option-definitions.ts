import { convertToOneWayNumericEnum } from "../types/enums";
import { OptionType, OptionsSection } from "./option-types";
import { OptionsManager } from "./options-manager";

export enum PersistOptions {
    AlwaysOff = 0,
    AlwaysOn = 1,
    KeepLastState = 2,
}

const defaultSettings = Object.freeze({
    onScreenKeyboard: {
        persist: PersistOptions.AlwaysOff,
        lastState: false,
    },
    hanYongToggle: {
        persist: PersistOptions.AlwaysOff,
        lastState: false,
    }
});

export const PersistOptionNames: Record<PersistOptions, string> = {
    [PersistOptions.AlwaysOff]: "Always Off",
    [PersistOptions.AlwaysOn]: "Always On",
    [PersistOptions.KeepLastState]: "Keep Last State",
}

const persistenceOption = {
    type: OptionType.Select,
    title: "Persistence between sessions",
    values: convertToOneWayNumericEnum(PersistOptions),
    names: PersistOptionNames,
};

type Settings = typeof defaultSettings;

export const optionsManager = new OptionsManager(defaultSettings);

export function getAvailableOptions() {
    const availableOptions: OptionsSection = {
        type: OptionType.Section,
        title: "Korean IME Options",
        options: {
            onScreenKeyboard: {
                type: OptionType.Section,
                title: "On-screen Keyboard",
                options: {
                    persist: {
                        ...persistenceOption,
                        ...createGetterSetter(
                            settings => settings.onScreenKeyboard.persist,
                            (settings, value) => settings.onScreenKeyboard.persist = value
                        ),
                        description: "What state the on-screen keyboard should be in when the browser is restarted.",
                    },
                },
            },
            hanYongToggle: {
                type: OptionType.Section,
                title: "Han/Yong Toggle",
                options: {
                    persist: {
                        ...persistenceOption,
                        ...createGetterSetter(
                            settings => settings.hanYongToggle.persist,
                            (settings, value) => settings.hanYongToggle.persist = value
                        ),
                        description: "What state the Han/Yong toggle should be in when the browser is restarted.",
                    },
                },
            }
        },
    };

    function createGetterSetter(getFn: (settings: Settings) => any, setFn: (settings: Settings, value: any) => void) {
        return {
            getValue: async () => {
                const settings = await optionsManager.restoreOptions();
                return getFn(settings);
            },
            setValue: async (value: any) => {
                const settings = await optionsManager.restoreOptions();
                setFn(settings, value);
                await optionsManager.saveSettings(settings);
            },
        };
    }

    return availableOptions;
}
