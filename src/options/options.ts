import { StrictEnum, convertToOneWayNumericEnum } from "../types/enums";
import { OptionsManager, PersistOptions, Settings } from "./options-manager";

export const PersistOptionNames: Record<PersistOptions, string> = {
    [PersistOptions.AlwaysOff]: "Always Off",
    [PersistOptions.AlwaysOn]: "Always On",
    [PersistOptions.KeepLastState]: "Keep Last State",
}

export enum OptionType {
    Section,
    Checkbox,
    Select,
}

type OptionBase = {
    type: OptionType;
    title: string;
    setValue: (value: any) => Promise<void>;
    getValue: () => Promise<any>;
    description?: string;
}

export type BasicOption = OptionBase & {
    type: OptionType.Checkbox;
};

export type SelectOption = OptionBase & {
    type: OptionType.Select;
    values: StrictEnum;
    names: Record<number | string, string>;
}

export type Option = BasicOption | SelectOption;

export type OptionsSection = Omit<OptionBase, "setValue" | "getValue"> & {
    type: OptionType.Section;
    options?: { [key: string]: Option | OptionsSection };
};

const persistenceOption = {
    type: OptionType.Select,
    title: "Persistence between sessions",
    values: convertToOneWayNumericEnum(PersistOptions),
    names: PersistOptionNames,
};

export function isSection(option: Option | OptionsSection): option is OptionsSection {
    return option.type === OptionType.Section;
}

export function isSelectOption(option: Option): option is SelectOption {
    return option.type === OptionType.Select;
}

const optionsManager = new OptionsManager();

export const availableOptions: OptionsSection = {
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
                TimHong: {
                    ...persistenceOption,
                    ...createGetterSetter(
                        settings => settings.hanYongToggle.persist,
                        (settings, value) => settings.hanYongToggle.persist = value
                    ),
                    description: "Time is Chinese.",
                }
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
