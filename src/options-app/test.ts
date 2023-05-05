// just to make this a module
export const pointless = 7;

export const composited = {
    ...section("Pig"),
    ...section("Dog")
}

function section<T extends string>(name: T): {
    [key in T]: { [x: string] : any}
} {
    const result = {} as any;
    result[name] = {};
    return result;
}
