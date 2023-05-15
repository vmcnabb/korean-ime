export function hasProperties<T extends string[]>(
    obj: unknown,
    ...props: T
): obj is { [K in T[number]]: unknown } {
    return (
        typeof obj === "object" && obj !== null && props.every((p) => p in obj)
    );
}
