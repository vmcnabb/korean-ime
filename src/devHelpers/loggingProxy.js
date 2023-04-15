"use strict";

class LoggingProxy {
    constructor(target) {
        this.target = target;
        return this._createProxy(target);
    }

    _createProxy(target) {
        return new Proxy(target, {
            get: (obj, prop) => {
                const value = Reflect.get(obj, prop);
                if (typeof value === 'function') {
                    return (...args) => {
                        console.log(`Calling ${prop} with arguments:`, args);
                        const result = value.apply(obj, args);
                        console.log(`Result of ${prop}:`, result);
                        return result;
                    };
                } else {
                    console.log(`Accessing property ${prop}`);
                    return value;
                }
            },
            set: (obj, prop, value) => {
                console.log(`Setting property ${prop} with value:`, value);
                return Reflect.set(obj, prop, value);
            },
        });
    }
}
