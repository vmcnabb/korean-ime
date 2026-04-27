import { ReadOnlyBiMap } from "../types/bi-map";

export function isHangulOrJamo(char: string) {
    if (!char) return false;

    const charCode = char.charCodeAt(0);
    return (
        (charCode >= 0xAC00 && charCode <= 0xD7A3)
        || (charCode >= 0x3131 && charCode <= 0x318E)
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
