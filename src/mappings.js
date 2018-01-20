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
            }

            this[left[i]] = right[i];
            this[right[i]] = left[i];
        }
    }
}

/**
* @param {string} char 
*/
export function isHangul (char) {
   if (!char) return false;
   const cc = char.charCodeAt(0);
   return (cc >= 0xAC00 && cc <= 0xD7A3) || (cc >= 0x3131 && cc <= 0x318E);
}


const nDash = "–";

export const hangulMaps = Object.freeze({
    initials: "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ",
    medials: "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ",
    finals: "ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ",
    keyboardMap: {
        "KeyQ": { normal: "ㅂ", shift: "ㅃ" },
        "KeyW": { normal: "ㅈ", shift: "ㅉ" },
        "KeyE": { normal: "ㄷ", shift: "ㄸ" },
        "KeyR": { normal: "ㄱ", shift: "ㄲ" },
        "KeyT": { normal: "ㅅ", shift: "ㅆ" },
        "KeyY": { normal: "ㅛ" },
        "KeyU": { normal: "ㅕ" },
        "KeyI": { normal: "ㅑ" },
        "KeyO": { normal: "ㅐ", shift: "ㅒ" },
        "KeyP": { normal: "ㅔ", shift: "ㅖ" },
        "KeyA": { normal: "ㅁ" },
        "KeyS": { normal: "ㄴ" },
        "KeyD": { normal: "ㅇ" },
        "KeyF": { normal: "ㄹ" },
        "KeyG": { normal: "ㅎ" },
        "KeyH": { normal: "ㅗ" },
        "KeyJ": { normal: "ㅓ" },
        "KeyK": { normal: "ㅏ" },
        "KeyL": { normal: "ㅣ" },
        "KeyZ": { normal: "ㅋ" },
        "KeyX": { normal: "ㅌ" },
        "KeyC": { normal: "ㅊ" },
        "KeyV": { normal: "ㅍ" },
        "KeyB": { normal: "ㅠ" },
        "KeyN": { normal: "ㅜ" },
        "KeyM": { normal: "ㅡ" },
        "Comma": { normal: ",", shift: "<" },
        "Period": { normal: ".", shift: ">" },
        "Slash": { normal: "/", shift: "?" },
        "BracketLeft": { normal: "[", shift: "{" },
        "BracketRight": { normal: "]", shift: "}" },
        "Backquote": { normal: "`", shift: "~" },
        "Digit1": { normal: "1", shift: "!" },
        "Digit2": { normal: "2", shift: "@" },
        "Digit3": { normal: "3", shift: "#" },
        "Digit4": { normal: "4", shift: "$" },
        "Digit5": { normal: "5", shift: "%" },
        "Digit6": { normal: "6", shift: "^" },
        "Digit7": { normal: "7", shift: "&" },
        "Digit8": { normal: "8", shift: "*" },
        "Digit9": { normal: "9", shift: "(" },
        "Digit0": { normal: "0", shift: ")" },
        "Minus": { normal: "-", shift: "_" },
        "Equals": { normal: "=", shift: "+" }
    },
    hangulVowelsRoman: new Map(
        "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ",
        [   "a", "ae", "ya", "yae", "eo", "e", "yeo", "ye", "o", "wa", "wae",
            "oe", "yo", "u", "wo", "we", "wi", "yu", "eu", "ui", "i"
        ]
    ),
    hangulIntialsRoman: new Map(
        "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ",
        [   "g", "kk", "n", "d", "tt", "r", "m", "b", "pp", "s", "ss",
            nDash, "j", "jj", "ch", "k", "t", "p", "h"
        ]
    ),
    hangulFinalsRoman: new Map(
        "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ",
        [   "k", "k", "n", "t", nDash, "l", "m", "p", nDash, "t", "t", "ng", "t",
            nDash, "t", "k", "t", "p", "h"
        ]
    ),
    hangulFinalInitialRoman: new Map(
        [   "ㄱㅇ", "ㄱㄴ", "ㄱㄹ", "ㄱㅁ", "ㄱㅋ",
            "ㄴㅇ", "ㄴㄱ", "ㄴㄹ",
            "ㄷㅇ", "ㄷㄴ", "ㄷㄹ", "ㄷㅌ", "ㄷㅎ",
            "ㄹㅇ", "ㄹㄴ", "ㄹㄹ", "ㅁㅇ", "ㅁㄹ", "ㅂㅇ", "ㅂㄴ", "ㅂㄹ", "ㅂㅁ", "ㅂㅍ",
            "ㅅㅇ", "ㅅㄴ", "ㅅㄹ", "ㅅㅁ", "ㅅㅌ", "ㅅㅎ",
            "ㅇㄹ",
            "ㅈㅇ", "ㅈㄴ", "ㅈㄹ", "ㅈㅁ", "ㅈㅌ", "ㅈㅎ",
            "ㅊㅇ", "ㅊㄴ", "ㅊㄹ", "ㅊㅁ", "ㅊㅌ", "ㅊㅎ",
            "ㅌㅇ", "ㅌㄴ", "ㅌㄹ", "ㅌㅁ", "ㅌㅌ", "ㅌㅎ",
            "ㅎㅇ", "ㅎㄱ", "ㅎㄴ", "ㅎㄷ", "ㅎㄹ", "ㅎㅁ", "ㅎㅂ", "ㅎㅈ", "ㅎㅊ", "ㅎㅋ", 'ㅎㅌ', "ㅎㅍ", "ㅎㅎ"
        ],
        [   "g", "ngn", "ngn", "ngm", `k${nDash}k`,
            "n", `n${nDash}g`, "ll",
            "d", "nn", "nn", "tt", "t",
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
