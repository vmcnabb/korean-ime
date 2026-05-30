function createTraceProxy<T extends object>(instance: T): T {
    if (process.env.NODE_ENV === "production") {
        return instance;
    }

    const targetName = instance.constructor.name;

    function name(prop: PropertyKey) {
        return `${targetName}.${String(prop)}`;
    }

    function getCallStack() {
        const callStack = new Error().stack;
        // Remove the first two lines from the call stack, which are the Error and Proxy constructors.
        return `Call stack:\n${callStack?.split("\n").slice(2).join("\n")}`;
    }

    return new Proxy(instance, {
        get(target: object, property: PropertyKey): unknown {
            const value = Reflect.get(target, property);
            if (typeof value === "function") {
                // Log method calls
                return (...args: []) => {
                    const returnValue = value.apply(target, args);
                    console.debug(
                        `Called ${name(property)} at\n${getCallStack()}\nWith args, returning:`,
                        args,
                        returnValue
                    );
                    return returnValue;
                };
            } else {
                // Log property access
                console.debug(`Get ${name(property)} at\n${getCallStack()}\nValue:`, value);
                return value;
            }
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        set(target: any, property: PropertyKey, value: any): boolean {
            // Log property updates
            console.debug(`Set ${name(property)} at\n${getCallStack()}\nValue:`, value);
            return Reflect.set(target, property, value);
        },
    });
}

type ConcreteConstructor<T = object> = new (...args: []) => T;
type AbstractConstructor<T = object> = abstract new (...args: []) => T;
type Constructor = AbstractConstructor | ConcreteConstructor;

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
type ConstructorFn = Constructor | Function;

export const trace: ClassDecorator = <T extends ConstructorFn, TArgs extends []>(target: T): T | void => {
    if (process.env.NODE_ENV === "production") {
        return target;
    }

    const constructor = target as Constructor;

    return class extends constructor {
        constructor(...args: TArgs) {
            const instance = super(...args) as unknown as T;

            if (this.constructor === target) {
                return instance;
            } else {
                return createTraceProxy(instance);
            }
        }
    } as T;
};
