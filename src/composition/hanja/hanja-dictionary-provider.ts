import { HanjaCandidate } from "./hanja-candidate";

export interface HanjaDictionaryProvider {
    lookup(reading: string): Promise<readonly HanjaCandidate[]>;
}

export class StaticHanjaDictionaryProvider implements HanjaDictionaryProvider {
    constructor(private readonly dictionary: ReadonlyMap<string, readonly HanjaCandidate[]> = bootstrapDictionary) {}

    lookup(reading: string): Promise<readonly HanjaCandidate[]> {
        return Promise.resolve(this.dictionary.get(reading) ?? []);
    }
}

/**
 * Small fixture dictionary for tests and for development paths that instantiate
 * the controller without the content-script service-worker provider.
 */
const bootstrapDictionary: ReadonlyMap<string, readonly HanjaCandidate[]> = new Map([
    [
        "한",
        [
            { hanja: "韓", korean: "나라 이름 한, 한나라 한" },
            { hanja: "寒", korean: "찰 한" },
            { hanja: "恨", korean: "한탄할 한, 한될 한" },
        ],
    ],
    [
        "안",
        [
            { hanja: "安", korean: "편안할 안, 어찌 안" },
            { hanja: "岸", korean: "물가 언덕 안" },
        ],
    ],
    [
        "가",
        [
            { hanja: "家", korean: "집 가" },
            { hanja: "加", korean: "더할 가" },
            { hanja: "可", korean: "옳을 가" },
            { hanja: "假", korean: "거짓 가" },
            { hanja: "價", korean: "값 가" },
            { hanja: "佳", korean: "아름다울 가" },
            { hanja: "街", korean: "거리 가" },
            { hanja: "歌", korean: "노래 가" },
            { hanja: "架", korean: "시렁 가" },
        ],
    ],
    [
        "나",
        [
            { hanja: "羅", korean: "새 그물 나" },
            { hanja: "那", korean: "어찌 나" },
            { hanja: "裸", korean: "벌거벗을 라, 털 없는 벌레 라, 벌거숭이 나" },
            { hanja: "懶", korean: "게으를 나" },
            { hanja: "螺", korean: "소라 나" },
            { hanja: "拿", korean: "붙잡을 나" },
            { hanja: "娜", korean: "아리따울 나, 휘청거릴 나" },
            { hanja: "拏", korean: "붙잡을 나" },
            { hanja: "糯", korean: "찰벼 나" },
            { hanja: "儺", korean: "역귀 쫓을 나, 법도있는 나" },
        ],
    ],
    [
        "다",
        [
            { hanja: "多", korean: "많을 다" },
            { hanja: "茶", korean: "차풀 다" },
            { hanja: "爹", korean: "아비 다" },
            { hanja: "陀", korean: "비탈 타, 땅이름 타" },
            { hanja: "舵", korean: "키 타" },
            { hanja: "馱", korean: "탈 타, 짐 실을 타" },
            { hanja: "坨", korean: "이" },
            { hanja: "沱", korean: "물이 갈래질 타, 큰 비 타, 눈물이 흐를 타" },
            { hanja: "跎", korean: "미끄러질 타" },
            { hanja: "駝", korean: "약대 타, 곱사등이 타" },
            { hanja: "鴕", korean: "타조 타" },
            { hanja: "柁", korean: "키 타" },
            { hanja: "佗", korean: "다를 타, 저 타, 마음에 든든할 타, 더할 타, 입을 타, 짊어질 타" },
            { hanja: "咤", korean: "꾸짖을 타, 슬플 타, 뿜을 타, 쩍쩍 씹는소리 타" },
            { hanja: "唾", korean: "침 타, 버릴 타" },
            { hanja: "墮", korean: "떨어질 타, 상투 타, 잃을 타" },
            { hanja: "惰", korean: "게으를 타, 태만할 타" },
            { hanja: "朶", korean: "나무가지 휘늘어질 타, 떨기 타, 움킬 타, 휘늘어진 타" },
        ],
    ],
    [
        "라",
        [
            { hanja: "羅", korean: "새그물 라" },
            { hanja: "螺", korean: "소라 라" },
            { hanja: "裸", korean: "벌거벗을 라, 벌거숭이 라" },
            { hanja: "懶", korean: "게으를 라" },
            { hanja: "邏", korean: "순행할 라, 돌 라" },
            { hanja: "鑼", korean: "징 라" },
            { hanja: "喇", korean: "나팔" },
            { hanja: "蘿", korean: "무 라, 소나무겨우살이 라" },
            { hanja: "癩", korean: "약물 중독 라" },
            { hanja: "瘰", korean: "연주창 라" },
            { hanja: "臝", korean: "벌거벗을 라" },
            { hanja: "騾", korean: "노새 라" },
            { hanja: "驘", korean: "옹 솥 라" },
            { hanja: "囉", korean: "소리 읽힐 라" },
            { hanja: "砢", korean: "가" },
            { hanja: "摞", korean: "라" },
            { hanja: "欏", korean: "라" },
            { hanja: "玀", korean: "라" },
            { hanja: "籮", korean: "라" },
        ],
    ],
]);
