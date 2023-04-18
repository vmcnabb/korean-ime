
export function CreateProxy<T extends object>(target: T) {
    return new Proxy(target, {
        get: (obj, prop) => {
            const value = Reflect.get(obj, prop);
            if (typeof value === 'function') {
                return (...args: any) => {
                    console.log(`Calling ${String(prop)} with arguments:`, args);
                    const result = value.apply(obj, args);
                    console.log(`Result of ${String(prop)}:`, result);
                    return result;
                };
            } else {
                console.log(`Accessing property ${String(prop)}`);
                return value;
            }
        },
        set: (obj, prop, value) => {
            console.log(`Setting property ${String(prop)} with value:`, value);
            return Reflect.set(obj, prop, value);
        },
    });
}
