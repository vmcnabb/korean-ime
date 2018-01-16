class Map {
    constructor (keys, values) {
        if (keys.length !== values.length) throw "Keys and values must be of equal length.";

        for (let i = 0; i < keys.length; i++) {
            if (this.hasOwnProperty(keys[i])) throw "Cannot have duplicate key:" + keys[i];
            this[keys[i]] = values[i];
        }
    }
}

class TwoWayMap {
    constructor (left, right) {
        if (left.length !== right.length) throw "Arrays must be of equal length.";

        for (let i = 0; i < left.length; i++) {
            if (this.hasOwnProperty(left[i]) || this.hasOwnProperty(right[i])) {
                throw "left and right cannot share or repeat any values.";

                this[left[i]] = right[i];
                this[right[i]] = left[i];
            }
        }
    }
}

export const nDash = "–";

export const hangeulMaps = Object.freeze({
    initials: "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ",
    medials: "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ",
    finals: "ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ",
    qwertyHangeul: new Map(
        "QqWwEeRrTtYyUuIiOoPp"
            + "AaSsDdFfGgHhJjKkLl"
            + "ZzXxCcVvBbNnMm",    
        "ㅃㅂㅉㅈㄸㄷㄲㄱㅆㅅㅛㅛㅕㅕㅑㅑㅒㅐㅖㅔ"
            + "ㅁㅁㄴㄴㅇㅇㄹㄹㅎㅎㅗㅗㅓㅓㅏㅏㅣㅣ"
            + "ㅋㅋㅌㅌㅊㅊㅍㅍㅠㅠㅜㅜㅡㅡ"
    ),
    hangeulVowelsRoman: new Map(
        "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ",
        [   "a", "ae", "ya", "yae", "eo", "e", "yeo", "ye", "o", "wa", "wae",
            "oe", "yo", "u", "wo", "we", "wi", "yu", "eu", "ui", "i"
        ]
    ),
    hangeulIntialsRoman: new Map(
        "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ",
        [   "g", "kk", "n", "d", "tt", "r", "m", "b", "pp", "s", "ss",
            nDash, "j", "jj", "ch", "k", "t", "p", "h"
        ]
    ),
    hangeulFinalsRoman: new Map(
        "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ",
        [   "k", "k", "n", "t", nDash, "l", "m", "p", nDash, "t", "t", "ng", "t",
            nDash, "t", "k", "t", "p", "h"
        ]
    ),
    hangeulFinalInitialRoman: new Map(
        [   "ㄱㅇ", "ㄱㄴ", "ㄱㄹ", "ㄱㅁ", "ㄱㅋ",
            "ㄴㅇ", "ㄴㄱ", "ㄴㄹ", "ㄷㅇ", "ㄷㄴ", "ㄷㄹ", "ㄷㅌ", "ㄷㅎ",
            "ㄹㅇ", "ㄹㄴ", "ㄹㄹ", "ㅁㅇ", "ㅁㄹ", "ㅂㅇ", "ㅂㄴ", "ㅂㄹ", "ㅂㅁ", "ㅂㅍ",
            "ㅅㅇ", "ㅅㄴ", "ㅅㄹ", "ㅅㅁ", "ㅅㅌ", "ㅅㅎ",
            "ㅇㄹ",
            "ㅈㅇ", "ㅈㄴ", "ㅈㄹ", "ㅈㅁ", "ㅈㅌ", "ㅈㅎ",
            "ㅊㅇ", "ㅊㄴ", "ㅊㄹ", "ㅊㅁ", "ㅊㅌ", "ㅊㅎ",
            "ㅌㅇ", "ㅌㄴ", "ㅌㄹ", "ㅌㅁ", "ㅌㅌ", "ㅌㅎ",
            "ㅎㅇ", "ㅎㄱ", "ㅎㄴ", "ㅎㄷ", "ㅎㄹ", "ㅎㅁ", "ㅎㅂ", "ㅎㅈ", "ㅎㅊ", "ㅎㅋ", 'ㅎㅌ', "ㅎㅍ", "ㅎㅎ"
        ],
        [   "g", "ngn", "ngn", "ngm", `k${nDash}k`,
            "n", `n${nDash}g`, "ll", "d", "nn", "nn", "tt", "t",
            "r", "ll", "ll", "m", "mn", "b", "mn", "mn", "mm", `p${nDash}p`,
            "s", "nn", "nn", "nm", `t${nDash}t`, "t",
            "ngn",
            "j", "nn", "nn", "nm", `t${nDash}t`, "t",
            "ch", "nn", "nn", "nm", `t${nDash}t`, "t",
            "t", "nn", "nn", "nm", `t${nDash}t`, "t",
            "h", "k", "nn", "t", "nn", "nm", "p", "ch", "tch", "tk", "tt", "tp", "t"
        ]
    ),
    compoundVowels: new TwoWayMap(
        ["ㅗㅏ", "ㅗㅐ", "ㅗㅣ", "ㅜㅓ", "ㅜㅔ", "ㅜㅣ", "ㅡㅣ"],
        "ㅘㅙㅚㅝㅞㅟㅢ"
    ),
    consonantDigraphs: new TwoWayMap(
        [
            "ㄱㅅ", "ㄴㅈ", "ㄴㅎ", "ㄹㄱ", "ㄹㅁ", "ㄹㅂ",
            "ㄹㅅ", "ㄹㅌ", "ㄹㅍ", "ㄹㅎ", "ㅂㅅ"
        ],
        "ㄳㄵㄶㄺㄻㄼㄽㄾㄿㅀㅄ"
    )
});
