import { HangulBlock } from "../composition/hangul-block";
import { compoundConsonantMap, isHangulOrJamo } from "../composition/hangul-maps";
import {
    hangulInitialsRoman,
    hangulVowelsRoman,
    hangulFinalInitialRoman,
    hangulFinalsRoman,
} from "./hangul-to-roman-maps";

/**
 * Return a string with the hangul converted into Roman characters, e.g.
 * "hello 강" => "hello gang"
 * @param {string} text
 */
export function romanize(text: string) {
    let romanText = "";
    let didPreviousCharSetInitial = false;

    let nextBlock = isHangulOrJamo(text[0]) ? HangulBlock.fromChar(text[0], false) : undefined;

    for (let i = 0; i < text.length; i++) {
        const thisChar = text[i];
        const nextChar: string | undefined = text[i + 1];

        const block = nextBlock;
        nextBlock = isHangulOrJamo(nextChar) ? HangulBlock.fromChar(nextChar, false) : undefined;

        if (block === undefined) {
            didPreviousCharSetInitial = false;
            romanText += thisChar;
            continue;
        }

        if (!block.hasMedial()) {
            let textToAdd =
                // standard initials (standalone consonant case)
                hangulInitialsRoman.get(block.initial) ??
                // standalone vowel case - initial is a vowel
                hangulVowelsRoman.get(block.initial);

            if (textToAdd === "" && block.initial === "ㅇ") {
                textToAdd = "ng";
            }
            if (textToAdd === undefined) {
                // standalone digraph case - initial is a digraph consonant
                if (compoundConsonantMap.hasReverse(block.initial)) {
                    const consonants = compoundConsonantMap.getReverse(block.initial)!;
                    const first = hangulFinalsRoman.get(consonants[0]);
                    const second = hangulInitialsRoman.get(consonants[1]);
                    if (first && second) {
                        textToAdd = first + second;
                    }
                }
            }

            const lastBlockWasNotInitial =
                !isHangulOrJamo(text[i - 1]) || HangulBlock.fromChar(text[i - 1]).hasMedial();
            const lastCharWasNotWhitespace = i === 0 || text[i - 1].trim() !== "";

            if (lastBlockWasNotInitial && i > 0 && lastCharWasNotWhitespace) {
                romanText += "-";
            }
            romanText += textToAdd ?? "�";
            if (nextChar && nextChar.trim() !== "") {
                romanText += "-";
            }

            didPreviousCharSetInitial = false;
            continue;
        } else if (!didPreviousCharSetInitial) {
            romanText += hangulInitialsRoman.get(block.initial) ?? "�";
        }

        romanText += hangulVowelsRoman.get(block.medial) ?? "�";

        if (!block.hasFinal()) {
            didPreviousCharSetInitial = false;
            continue;
        }

        // e.g. "ㄱ" or "ㄹㄱ"
        const decomposedFinal = compoundConsonantMap.getReverse(block.final) ?? block.final;

        const specialFinalInitialCombination =
            nextBlock && nextBlock.hasMedial()
                ? hangulFinalInitialRoman.get(decomposedFinal.at(-1)! + nextBlock.initial)
                : undefined;

        const isNextPhonemeAVowel = !!nextBlock?.hasMedial() && nextBlock.initial === "ㅇ";
        const isSpecial = specialFinalInitialCombination !== undefined;
        const isCompoundFinal = decomposedFinal.length === 2;

        if (isCompoundFinal && (isNextPhonemeAVowel || isSpecial)) {
            romanText += hangulFinalsRoman.get(decomposedFinal[0]) ?? "�";
        }

        if (isSpecial) {
            romanText += specialFinalInitialCombination;
        } else if (isNextPhonemeAVowel) {
            romanText += hangulInitialsRoman.get(decomposedFinal.at(-1)!) ?? "�";
        } else {
            romanText += hangulFinalsRoman.get(block.final) ?? "�";
        }
        didPreviousCharSetInitial = isSpecial || isNextPhonemeAVowel;
    } // for i

    return romanText;
}
