
/**
 * Creates a proxy withe the same interface as the target object, but logs all calls to the console.
 * Does nothing in production.
 * @param target 
 * @returns 
 */
export function createLoggingProxy<T extends object>(target: T) {
    if (process.env.NODE_ENV === 'production') {
        return target;
    }

    const targetName = target.constructor.name;

    return new Proxy(target, {
        get: (obj, prop) => {
            const value = Reflect.get(obj, prop);
            const callStack = getCallStack();

            if (typeof value === 'function') {
                return (...args: any) => {
                    console.debug(`Calling ${name(prop)} with arguments:`, args);
                    console.debug(callStack);
                    const result = value.apply(obj, args);
                    console.debug(`Result of ${name(prop)}:`, result);
                    return result;
                };
            } else {
                console.debug(`Accessing property ${name(prop)}`);
                console.debug(`Call stack:\n${callStack}`);
                return value;
            }
        },
        set: (obj, prop, value) => {
            console.debug(`Setting property ${name(prop)} with value:`, value);
            const callStack = new Error().stack;
            console.debug(callStack);
            return Reflect.set(obj, prop, value);
        },
    });

    function name(prop: string | symbol) {
        return `${targetName}.${String(prop)}`;
    }

    function getCallStack() {
        const callStack = new Error().stack;
        console.debug(`Call stack:\n${callStack?.split('\n').slice(2).join('\n')}`);
    }
}
