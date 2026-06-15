/**
 * Step-1 bootstrap Hanja dictionary (#150).
 *
 * A single hard-coded entry — just enough to prove the conversion pipeline end to
 * end. It maps a composed Hangul reading to its ordered list of Hanja candidates
 * (one candidate, for now). This is throwaway scaffolding: a later phase swaps it
 * for the libhangul-derived data (see the Hanja Feature design doc on the wiki).
 * Keep the shape (reading → candidate[]) so that swap stays mechanical.
 */
const hanjaDictionary: ReadonlyMap<string, readonly string[]> = new Map([["한", ["韓"]]]);

/**
 * Ordered Hanja candidates for a composed Hangul reading, or an empty array when
 * the reading isn't in the dictionary.
 */
export function lookUpHanja(reading: string): readonly string[] {
    return hanjaDictionary.get(reading) ?? [];
}
