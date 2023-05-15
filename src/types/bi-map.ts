export class ReadOnlyBiMap<K, V> {
    private readonly map = new Map<K, V>();
    private readonly reverseMap = new Map<V, K>();

    constructor(keyValuePairs: [key: K, value: V][]) {
        keyValuePairs.forEach(this.add.bind(this));
    }

    get(key: K) {
        return this.map.get(key);
    }

    has(key: K) {
        return this.map.has(key);
    }

    getReverse(value: V) {
        return this.reverseMap.get(value);
    }

    hasReverse(value: V) {
        return this.reverseMap.has(value);
    }

    private add([key, value]: [K, V]) {
        if (this.map.has(key)) {
            throw new Error(`Duplicate key: ${key}`);
        }

        if (this.reverseMap.has(value)) {
            throw new Error(`Duplicate value: ${value}`);
        }

        this.map.set(key, value);
        this.reverseMap.set(value, key);
    }
}
