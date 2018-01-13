(() => {
    const ime = window.koreanIme = window.koreanIme || {};

    class Map {
        constructor (keys, values) {
            if (keys.length !== values.length) throw "Keys and values must be of equal length.";

            for (let i = 0; i < keys.length; i++) {
                if (this.hasOwnProperty(keys[i])) throw "Cannot have duplicate keys.";
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

    ime.hangeulMaps = {
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
        hangeulRoman: new Map(
            "ㅃㅂㅉㅈㄸㄷㄲㄱㅆㅅㅛㅕㅑㅒㅐㅖㅔ" +
            "ㅁㄴㅇㄹㅎㅗㅓㅏㅣ" +
            "ㅋㅌㅊㅍㅠㅜㅡ" +
            "ㅘㅙㅚㅝㅞㅟㅢ",
            ['bb','b','jj','j','dd','d','kk','g','ss','s','yo','yeo','ya','yae','ae','ye','e',
            'm','n','ng','r','h','o','eo','a','i',
            'k','t','ch','p','yu','u','eu',
            'wa','wae','oe','wo','we','wi','ui'
            ]
        ),
        compoundVowels: new TwoWayMap(
            ["ㅗㅏ","ㅗㅐ","ㅗㅣ","ㅜㅓ","ㅜㅔ","ㅜㅣ","ㅡㅣ"],
            "ㅘㅙㅚㅝㅞㅟㅢ"
        ),
        consonantDigraphs: new TwoWayMap(
            [
                "ㄱㅅ", "ㄴㅈ", "ㄴㅎ", "ㄹㄱ", "ㄹㅁ", "ㄹㅂ",
                "ㄹㅅ", "ㄹㅌ", "ㄹㅍ", "ㄹㅎ", "ㅂㅅ"
            ],
            "ㄳㄵㄶㄺㄻㄼㄽㄾㄿㅀㅄ"
        )
    };
})();
