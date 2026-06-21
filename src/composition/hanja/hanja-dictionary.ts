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
    ["가", ["家", "加", "可", "假", "價", "佳", "街", "歌", "架"]],
    ["나", ["羅", "那", "裸", "懶", "螺", "拿", "娜", "拏", "糯", "儺"]],
    [
        "다",
        ["多", "茶", "爹", "陀", "舵", "馱", "坨", "沱", "跎", "駝", "鴕", "柁", "佗", "咤", "唾", "墮", "惰", "朶"],
    ],
    [
        "라",
        [
            "羅",
            "螺",
            "裸",
            "懶",
            "邏",
            "鑼",
            "喇",
            "蘿",
            "癩",
            "瘰",
            "臝",
            "騾",
            "驘",
            "囉",
            "砢",
            "摞",
            "欏",
            "玀",
            "籮",
        ],
    ],
]);

/**
 * Ordered Hanja candidates for a composed Hangul reading, or an empty array when
 * the reading isn't in the dictionary.
 */
export function lookUpHanja(reading: string): readonly string[] {
    return hanjaDictionary.get(reading) ?? [];
}
