import {
    EnumLike,
    convertToOneWayNumericEnum,
    isNumericEnum,
} from "../types/enums";
import {
    CheckboxOption,
    Option,
    OptionType,
    OptionsSection,
    SelectOption,
    SystemSetting,
    TypedOptionsSection,
} from "./option-types";

export function createSection<
    T extends {
        [K in keyof T]: (T[K] extends infer U ? U : never) &
            (Option | OptionsSection);
    }
>(title: string, options: T): TypedOptionsSection<T> {
    return {
        type: OptionType.Section,
        title,
        options,
    };
}

export function createCheckBoxOption(
    title: string,
    defaultValue = false,
    description?: string
): CheckboxOption {
    return {
        title,
        type: OptionType.Checkbox,
        value: defaultValue,
        description,
    };
}

export function createSelectOption<T extends EnumLike>(
    enumObj: T,
    title: string,
    defaultValue: T[keyof T],
    names: Record<T[keyof T], string>,
    description?: string
): SelectOption<T> {
    let actual = enumObj;

    if (isNumericEnum(enumObj)) {
        actual = convertToOneWayNumericEnum(enumObj);
    }

    const option: SelectOption<T> = {
        title,
        type: OptionType.Select,
        value: defaultValue,
        values: actual,
        names,
        description,
    };

    return option;
}

export function createSystemSetting<T>(
    defaultValue: T
): SystemSetting & { value: T } {
    return {
        type: OptionType.System,
        value: defaultValue,
    };
}

type FlattenOptionOrSection<T> = T extends { options: infer U }
    ? U
    : T extends { value: infer U }
    ? U
    : T;

/**
 * returns a type with all settings from the input, but only the values. It also removes
 * what are now unnecessary nesting levels. Instead of the object containing information
 * about the type of the setting, it only contains the value.
 * e.g. { title: "page title", options: { age: { value: 1, title: "bla",... } } } becomes { age: 1 }
 */
export type SimplifySettings<T> = {
    [K in keyof T]: T[K] extends { options: unknown }
        ? SimplifySettings<FlattenOptionOrSection<T[K]>>
        : FlattenOptionOrSection<T[K]>;
};
