import { EnumLike } from "../types/enums";

export enum OptionType {
    Section,
    Checkbox,
    Select,
    /** settings that the system wants to save. These don't need UI elements */
    System,
}

type OptionBase = {
    type: OptionType;
    title: string;
    value: unknown;
    description?: string;
};

export type CheckboxOption = OptionBase & {
    type: OptionType.Checkbox;
    value: boolean;
};

export type SelectOption<T extends EnumLike> = OptionBase & {
    type: OptionType.Select;
    value: T[keyof T];
    values: Record<keyof T, T[keyof T]>;
    names: Record<T[keyof T], string>;
};

export type SystemSetting = Omit<OptionBase, "title" | "description"> & {
    type: OptionType.System;
};

export type Option = CheckboxOption | SelectOption<EnumLike> | SystemSetting;

export type OptionsSection = Omit<OptionBase, "value"> & {
    type: OptionType.Section;
    options: { [key: string]: Option | OptionsSection };
};

// "Root" type is OptionsSection, except the values can only be OptionSection without option
type RootOptionsSection = OptionsSection & {
    options: { [key: string]: OptionsSection };
};

export type RootSection<T> = RootOptionsSection & {
    options: { [K in keyof T]: T[K] extends infer U ? U : never };
};

export type TypedOptionsSection<T> = OptionsSection & {
    options: { [K in keyof T]: T[K] extends infer U ? U : never };
};

export function isSection(value: unknown): value is OptionsSection {
    return hasType(value) && value.type === OptionType.Section;
}

export function isSelectOption(option: Option): option is SelectOption<EnumLike> {
    return option.type === OptionType.Select;
}

export function isOption(option: unknown): option is Option {
    return hasType(option) && option.type !== undefined && option.type !== OptionType.Section;
}

export function isSystemSetting(option: unknown): option is SystemSetting {
    return hasType(option) && option.type === OptionType.System;
}

export function isCheckBoxOption(option: unknown): option is CheckboxOption {
    return hasType(option) && option.type === OptionType.Checkbox;
}

function hasType(obj: unknown): obj is { type: OptionType } {
    return Object.prototype.hasOwnProperty.call(obj, "type");
}
