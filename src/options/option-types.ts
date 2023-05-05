import { StrictEnum } from "src/types/enums";

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

export function isSection(option: Option | OptionsSection): option is OptionsSection {
    return option.type === OptionType.Section;
}

export function isSelectOption(option: Option): option is SelectOption {
    return option.type === OptionType.Select;
}