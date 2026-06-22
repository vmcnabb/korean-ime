export type HanjaCandidate = {
    hanja: string;
    korean: string;
    simplified?: string;
    pinyin?: string;
};

const arrayOfAllKeys =
    <T>() =>
    <U extends readonly (keyof T)[]>(
        keys: U & ([keyof T] extends [U[number]] ? unknown : "Error: Not all keys are included")
    ): U =>
        keys;

export const HANJA_CANDIDATE_KEYS = arrayOfAllKeys<HanjaCandidate>()(["hanja", "korean", "simplified", "pinyin"]);
