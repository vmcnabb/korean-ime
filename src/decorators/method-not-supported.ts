import 'reflect-metadata';

const notSupportedMetadataKey = Symbol('notSupported');

/**
 * Decorator that marks a method as not supported and causes it to throw an error when called.
 */
export const methodNotSupported: MethodDecorator = <Function>(
    target: Object,
    propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<Function>
) => {
    Reflect.defineMetadata(notSupportedMetadataKey, true, target, propertyKey);

    // Replace the original method with a new one that throws an error
    descriptor.value = function (): void {
        throw new Error(`Method "${String(propertyKey)}" is not supported.`);
    } as Function;
}

export function isMethodSupported<T extends object>(target: T, propertyKey: keyof T & (string | symbol)): boolean {
    return !Reflect.getMetadata(notSupportedMetadataKey, target, propertyKey);
}
