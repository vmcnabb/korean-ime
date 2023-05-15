import {
    compoundConsonantMap,
    compoundVowelMap,
    jamoIndices,
} from "../mappings";

const { initials, medials, finals } = jamoIndices;

/**
 * Class representing a Hangul block (Korean character).
 */
export class HangulBlock {
    constructor(public initial = "", public medial = "", public final = "") {}

    /**
     * Converts the HangulBlock to a single character string.
     * @returns {string} The Hangul character represented by the HangulBlock.
     */
    toChar(): string {
        const initialIndex = initials.indexOf(this.initial);

        const medialIndex =
            this.medial.length == 1
                ? medials.indexOf(this.medial)
                : medials.indexOf(compoundVowelMap.get(this.medial) as string);

        const finalIndex =
            (this.final.length == 1
                ? finals.indexOf(this.final)
                : finals.indexOf(
                      compoundConsonantMap.get(this.final) as string
                  )) + 1;

        // Jamo to Unicode character formula: (initial)×588 + (medial)×28 + (final) + 44032
        return initialIndex > -1 && medialIndex > -1
            ? String.fromCharCode(
                  initialIndex * 588 + medialIndex * 28 + finalIndex + 44032
              )
            : compoundVowelMap.get(this.initial) ||
                  compoundConsonantMap.get(this.initial) ||
                  this.initial;
    }

    /**
     * Creates a HangulBlock from a single character string.
     * @param char The Hangul character to create a HangulBlock from.
     * @param separateDigraphs Indicates whether to separate digraphs.
     * @returns A new HangulBlock instance representing the given character.
     */
    static fromChar(char: string, separateDigraphs = true): HangulBlock {
        let workingIndex = char.charCodeAt(0) - 44032;

        if (workingIndex < 0) {
            // not a standard Hangul block. Could be a Hangul Jamo.
            if (separateDigraphs && compoundVowelMap.hasReverse(char)) {
                return new HangulBlock(compoundVowelMap.getReverse(char));
            }

            if (separateDigraphs && compoundConsonantMap.hasReverse(char)) {
                return new HangulBlock(compoundConsonantMap.getReverse(char));
            }

            return new HangulBlock(char);
        }

        const initialIndex = Math.floor(workingIndex / 588);

        workingIndex %= 588;
        const medialIndex = Math.floor(workingIndex / 28);

        workingIndex %= 28;
        const finalIndex = workingIndex - 1;

        return new HangulBlock(
            initials[initialIndex],
            (separateDigraphs &&
                compoundVowelMap.getReverse(medials[medialIndex])) ||
                medials[medialIndex],
            compoundConsonantMap.getReverse(finals[finalIndex]) ||
                finals[finalIndex]
        );
    }
}
