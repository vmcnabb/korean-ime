/**
 * Bootstrap Hanja dictionary (#150, #181).
 *
 * A tiny hard-coded dictionary — just enough to prove the conversion pipeline end
 * to end. It maps a composed Hangul reading to its ordered list of Hanja
 * candidates. This is throwaway scaffolding: a later phase swaps it for the
 * libhangul-derived data (see the Hanja Feature design doc on the wiki). Keep the
 * shape (reading → candidate[]) so that swap stays mechanical.
 */
const hanjaDictionary: ReadonlyMap<string, readonly string[]> = new Map([
    ["한", ["韓", "寒", "恨"]],
    ["안", ["安", "岸"]],
]);

/**
 * Ordered Hanja candidates for a composed Hangul reading, or an empty array when
 * the reading isn't in the dictionary.
 */
export function lookUpHanja(reading: string): readonly string[] {
    return hanjaDictionary.get(reading) ?? [];
}
