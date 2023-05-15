class ReadOnlyBiMap<K, V> {
    private readonly forwardMap = new Map<K, V>();
    private readonly backwardMap = new Map<V, K>();

    constructor(keyValuePairs: [key: K, value: V][]) {
        keyValuePairs.forEach(this.add.bind(this));
    }

    get(key: K) {
        return this.forwardMap.get(key);
    }

    has(key: K) {
        return this.forwardMap.has(key);
    }

    getReverse(value: V) {
        return this.backwardMap.get(value);
    }

    hasReverse(value: V) {
        return this.backwardMap.has(value);
    }

    private add([key, value]: [K, V]) {
        if (this.forwardMap.has(key)) {
            throw new Error(`Duplicate key: ${key}`);
        }

        if (this.backwardMap.has(value)) {
            throw new Error(`Duplicate value: ${value}`);
        }

        this.forwardMap.set(key, value);
        this.backwardMap.set(value, key);
    }
}

export function isHangulCharacter(char: string) {
    if (!char) {
        return false;
    }
    const charCode = char.charCodeAt(0);
    return (
        (charCode >= 0xac00 && charCode <= 0xd7a3) ||
        (charCode >= 0x3131 && charCode <= 0x318e)
    );
}

/** compound vowel = complex vowel = 이중모음 (double vowel) */
export const compoundVowelMap = new ReadOnlyBiMap([
    ["ㅗㅏ", "ㅘ"],
    ["ㅗㅐ", "ㅙ"],
    ["ㅗㅣ", "ㅚ"],
    ["ㅜㅓ", "ㅝ"],
    ["ㅜㅔ", "ㅞ"],
    ["ㅜㅣ", "ㅟ"],
    ["ㅡㅣ", "ㅢ"],
]);

/** compound consonant = complex consonant = 이중자음 (double consonant) */
export const compoundConsonantMap = new ReadOnlyBiMap([
    ["ㄱㅅ", "ㄳ"],
    ["ㄴㅈ", "ㄵ"],
    ["ㄴㅎ", "ㄶ"],
    ["ㄹㄱ", "ㄺ"],
    ["ㄹㅁ", "ㄻ"],
    ["ㄹㅂ", "ㄼ"],
    ["ㄹㅅ", "ㄽ"],
    ["ㄹㅌ", "ㄾ"],
    ["ㄹㅍ", "ㄿ"],
    ["ㄹㅎ", "ㅀ"],
    ["ㅂㅅ", "ㅄ"],
]);

export const jamoIndices = Object.freeze({
    initials: "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ",
    medials: "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ",
    finals: "ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ",
});
