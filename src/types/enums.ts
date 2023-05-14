type StringEnum = {
    [key: string]: string;
};

type TypedStringEnum<T> = T & {
    [K in keyof T]: string;
};

type NumericEnum = {
    [key: string]: number | string;
};

type TypedNumericEnum<T> = T & {
    [K in keyof T]: number | string;
};

type OneWayNumericEnum = {
    [key: string]: number;
};

type TypedOneWayNumericEnum<T extends NumericEnum> = T & {
    [K in keyof T as Extract<K, string>]: number;
};

export type EnumLike = StringEnum | NumericEnum;
export type StrictEnum = StringEnum | OneWayNumericEnum;

export type TypedStrictEnum<T extends EnumLike> = T & T extends StringEnum
    ? TypedStringEnum<T>
    : TypedOneWayNumericEnum<T>;

export function isNumericEnum(enumLike: EnumLike): enumLike is NumericEnum {
    /*  numeric enums have both mappings {string => number} and {string => string} where
        the first string in {string => string} is the reverse mapping except the number is
        represented as a string.
        e.g.
        enum Numbers {
            One = 1,
            Two = 2,
            Three = 3
        }
        once compiled to JS and initialised becomes:
        {
            "1": "One", "2": "Two", "3": "Three",
            "One": 1, "Two": 2, "Three": 3
        }
    */
    return Object.values(enumLike).some((value) => typeof value === "number");
}

export function isTypedNumericEnum<T extends EnumLike>(
    enumLike: T
): enumLike is TypedNumericEnum<T> {
    return Object.values(enumLike).some((value) => typeof value === "number");
}

export function isStringEnum(enumLike: EnumLike): enumLike is StringEnum {
    return Object.values(enumLike).every((value) => typeof value === "string");
}

export function convertToOneWayNumericEnum<T extends NumericEnum>(
    enumLike: T
): TypedOneWayNumericEnum<T> {
    const entries = Object.entries(enumLike);
    const filtered = entries.filter(entryIs(isString, isNumber));
    const newObject = Object.fromEntries(filtered);
    return newObject as any;
}

function isString(value: any): value is string {
    return typeof value === "string";
}

function isNumber(value: any): value is number {
    return typeof value === "number";
}

function entryIs<T1, T2>(
    keyTypeGuard: (value: any) => value is T1,
    valueTypeGuard: (value: any) => value is T2
) {
    return function (entry: [any, any]): entry is [T1, T2] {
        const [key, value] = entry;
        return keyTypeGuard(key) && valueTypeGuard(value);
    };
}

export function enumValues<T extends StringEnum | OneWayNumericEnum>(
    enumLike: T
): T[] {
    return Object.values(enumLike);
}
