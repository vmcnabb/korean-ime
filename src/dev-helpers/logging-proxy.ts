
export function CreateProxy<T extends object>(target: T) {
    if (process.env.NODE_ENV === 'production') {
        return target;
    }

    return new Proxy(target, {
        get: (obj, prop) => {
            const value = Reflect.get(obj, prop);
            const callStack = new Error().stack;

            if (typeof value === 'function') {
                return (...args: any) => {
                    console.debug(`Calling ${String(prop)} with arguments:`, args);
                    console.debug(`Call stack:\n${callStack}`);
                    const result = value.apply(obj, args);
                    console.debug(`Result of ${String(prop)}:`, result);
                    return result;
                };
            } else {
                console.debug(`Accessing property ${String(prop)}`);
                console.debug(`Call stack:\n${callStack}`);
                return value;
            }
        },
        set: (obj, prop, value) => {
            console.debug(`Setting property ${String(prop)} with value:`, value);
            const callStack = new Error().stack;
            console.debug(`Call stack:\n${callStack}`);
            return Reflect.set(obj, prop, value);
        },
    });
}
