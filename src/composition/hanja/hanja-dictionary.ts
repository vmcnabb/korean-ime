export type HanjaCandidate = {
    hanja: string;
    korean: string;
    simplified?: string;
    pinyin: string;
};

/**
 * Bootstrap Hanja dictionary (#150, #181).
 *
 * A tiny hard-coded dictionary — just enough to prove the conversion pipeline end
 * to end. It maps a composed Hangul reading to its ordered list of Hanja
 * candidates. This is throwaway scaffolding: a later phase swaps it for the
 * libhangul-derived data (see the Hanja Feature design doc on the wiki). Keep the
 * shape (reading → candidate[]) so that swap stays mechanical.
 *
 * Korean gloss/readings mirror libhangul `hanja.txt`; Simplified Chinese and
 * Pinyin mirror Unihan `kSimplifiedVariant` and `kMandarin`.
 */
const hanjaDictionary: ReadonlyMap<string, readonly HanjaCandidate[]> = new Map([
    [
        "한",
        [
            { hanja: "韓", korean: "나라 이름 한, 한나라 한", simplified: "韩", pinyin: "hán" },
            { hanja: "寒", korean: "찰 한", pinyin: "hán" },
            { hanja: "恨", korean: "한탄할 한, 한될 한", pinyin: "hèn" },
        ],
    ],
    [
        "안",
        [
            { hanja: "安", korean: "편안할 안, 어찌 안", pinyin: "ān" },
            { hanja: "岸", korean: "물가 언덕 안", pinyin: "àn" },
        ],
    ],
    [
        "가",
        [
            { hanja: "家", korean: "집 가", pinyin: "jiā" },
            { hanja: "加", korean: "더할 가", pinyin: "jiā" },
            { hanja: "可", korean: "옳을 가", pinyin: "kě" },
            { hanja: "假", korean: "거짓 가", pinyin: "jiǎ" },
            { hanja: "價", korean: "값 가", simplified: "价", pinyin: "jià" },
            { hanja: "佳", korean: "아름다울 가", pinyin: "jiā" },
            { hanja: "街", korean: "거리 가", pinyin: "jiē" },
            { hanja: "歌", korean: "노래 가", pinyin: "gē" },
            { hanja: "架", korean: "시렁 가", pinyin: "jià" },
        ],
    ],
    [
        "나",
        [
            { hanja: "羅", korean: "새 그물 나", simplified: "罗", pinyin: "luó" },
            { hanja: "那", korean: "어찌 나", pinyin: "nà" },
            { hanja: "裸", korean: "벌거벗을 라, 털 없는 벌레 라, 벌거숭이 나", pinyin: "luǒ" },
            { hanja: "懶", korean: "게으를 나", simplified: "懒", pinyin: "lǎn" },
            { hanja: "螺", korean: "소라 나", pinyin: "luó" },
            { hanja: "拿", korean: "붙잡을 나", pinyin: "ná" },
            { hanja: "娜", korean: "아리따울 나, 휘청거릴 나", pinyin: "nà" },
            { hanja: "拏", korean: "붙잡을 나", pinyin: "ná" },
            { hanja: "糯", korean: "찰벼 나", pinyin: "nuò" },
            { hanja: "儺", korean: "역귀 쫓을 나, 법도있는 나", simplified: "傩", pinyin: "nuó" },
        ],
    ],
    [
        "다",
        [
            { hanja: "多", korean: "많을 다", pinyin: "duō" },
            { hanja: "茶", korean: "차풀 다", pinyin: "chá" },
            { hanja: "爹", korean: "아비 다", pinyin: "diē" },
            { hanja: "陀", korean: "비탈 타, 땅이름 타", pinyin: "tuó" },
            { hanja: "舵", korean: "키 타", pinyin: "duò" },
            { hanja: "馱", korean: "탈 타, 짐 실을 타", simplified: "驮", pinyin: "tuó" },
            { hanja: "坨", korean: "이", pinyin: "tuó" },
            { hanja: "沱", korean: "물이 갈래질 타, 큰 비 타, 눈물이 흐를 타", pinyin: "tuó" },
            { hanja: "跎", korean: "미끄러질 타", pinyin: "tuó" },
            { hanja: "駝", korean: "약대 타, 곱사등이 타", simplified: "驼", pinyin: "tuó" },
            { hanja: "鴕", korean: "타조 타", simplified: "鸵", pinyin: "tuó" },
            { hanja: "柁", korean: "키 타", pinyin: "tuó duò" },
            { hanja: "佗", korean: "다를 타, 저 타, 마음에 든든할 타, 더할 타, 입을 타, 짊어질 타", pinyin: "tuó" },
            { hanja: "咤", korean: "꾸짖을 타, 슬플 타, 뿜을 타, 쩍쩍 씹는소리 타", pinyin: "zhà" },
            { hanja: "唾", korean: "침 타, 버릴 타", pinyin: "tuò" },
            { hanja: "墮", korean: "떨어질 타, 상투 타, 잃을 타", simplified: "堕", pinyin: "duò" },
            { hanja: "惰", korean: "게으를 타, 태만할 타", pinyin: "duò" },
            { hanja: "朶", korean: "나무가지 휘늘어질 타, 떨기 타, 움킬 타, 휘늘어진 타", pinyin: "duǒ" },
        ],
    ],
    [
        "라",
        [
            { hanja: "羅", korean: "새그물 라", simplified: "罗", pinyin: "luó" },
            { hanja: "螺", korean: "소라 라", pinyin: "luó" },
            { hanja: "裸", korean: "벌거벗을 라, 벌거숭이 라", pinyin: "luǒ" },
            { hanja: "懶", korean: "게으를 라", simplified: "懒", pinyin: "lǎn" },
            { hanja: "邏", korean: "순행할 라, 돌 라", simplified: "逻", pinyin: "luó" },
            { hanja: "鑼", korean: "징 라", simplified: "锣", pinyin: "luó" },
            { hanja: "喇", korean: "나팔", pinyin: "lǎ" },
            { hanja: "蘿", korean: "무 라, 소나무겨우살이 라", simplified: "萝", pinyin: "luó" },
            { hanja: "癩", korean: "약물 중독 라", simplified: "癞", pinyin: "lài" },
            { hanja: "瘰", korean: "연주창 라", pinyin: "luǒ" },
            { hanja: "臝", korean: "벌거벗을 라", pinyin: "luǒ" },
            { hanja: "騾", korean: "노새 라", simplified: "骡", pinyin: "luó" },
            { hanja: "驘", korean: "옹 솥 라", pinyin: "luó" },
            { hanja: "囉", korean: "소리 읽힐 라", simplified: "啰", pinyin: "luō" },
            { hanja: "砢", korean: "가", pinyin: "kē" },
            { hanja: "摞", korean: "라", pinyin: "luò" },
            { hanja: "欏", korean: "라", simplified: "椤", pinyin: "luó" },
            { hanja: "玀", korean: "라", simplified: "猡", pinyin: "luó" },
            { hanja: "籮", korean: "라", simplified: "箩", pinyin: "luó" },
        ],
    ],
]);

/**
 * Ordered Hanja candidates for a composed Hangul reading, or an empty array when
 * the reading isn't in the dictionary.
 */
export function lookUpHanja(reading: string): readonly HanjaCandidate[] {
    return hanjaDictionary.get(reading) ?? [];
}
