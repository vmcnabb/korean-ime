// Tracks which (prototype, method) pairs are marked unsupported. This used to be
// reflect-metadata, but its globalThis shim (`Function("return this")()` /
// `(0,eval)(...)`) tripped web-ext's DANGEROUS_EVAL lint. The decorator stores
// against a class prototype while the query runs against an instance, so we walk
// the prototype chain on lookup — the same resolution reflect-metadata's
// getMetadata did, minus the eval.
const notSupportedMethods = new WeakMap<object, Set<PropertyKey>>();

/**
 * Decorator that marks a method as not supported and causes it to throw an error when called.
 */
export const methodNotSupported: MethodDecorator = <Function>(
    target: object,
    propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<Function>
) => {
    let marked = notSupportedMethods.get(target);
    if (!marked) {
        notSupportedMethods.set(target, (marked = new Set()));
    }
    marked.add(propertyKey);

    // Replace the original method with a new one that throws an error
    descriptor.value = function (): void {
        throw new Error(`Method "${String(propertyKey)}" is not supported.`);
    } as Function;
};

export function isMethodSupported<T extends object>(target: T, propertyKey: keyof T & (string | symbol)): boolean {
    for (let obj: object | null = target; obj; obj = Object.getPrototypeOf(obj)) {
        if (notSupportedMethods.get(obj)?.has(propertyKey)) {
            return false;
        }
    }
    return true;
}
