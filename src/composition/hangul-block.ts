import { hangulMaps } from "../mappings";

const { initials, medials, finals, compoundVowels, consonantDigraphs } =
    hangulMaps;

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
                : medials.indexOf(compoundVowels[this.medial]!);

        const finalIndex =
            (this.final.length == 1
                ? finals.indexOf(this.final)
                : finals.indexOf(consonantDigraphs[this.final]!)) + 1;

        // Jamo to Unicode character formula: (initial)×588 + (medial)×28 + (final) + 44032
        return initialIndex > -1 && medialIndex > -1
            ? String.fromCharCode(
                  initialIndex * 588 + medialIndex * 28 + finalIndex + 44032
              )
            : compoundVowels[this.initial] ||
                  consonantDigraphs[this.initial] ||
                  this.initial;
    }

    /**
     * Creates a HangulBlock from a single character string.
     * @param character The Hangul character to create a HangulBlock from.
     * @param separateMedialDigraph Indicates whether to separate medial digraphs.
     * @param separateFinalDigraph Indicates whether to separate final digraphs.
     * @returns A new HangulBlock instance representing the given character.
     */
    static fromChar(
        character: string,
        separateMedialDigraph = true,
        separateFinalDigraph = true
    ): HangulBlock {
        let workingIndex = character.charCodeAt(0) - 44032;

        if (workingIndex < 0) {
            // not a Hangul block
            return new HangulBlock(character);
        }

        const initialIndex = Math.floor(workingIndex / 588);

        workingIndex %= 588;
        const medialIndex = Math.floor(workingIndex / 28);

        workingIndex %= 28;
        const finalIndex = workingIndex - 1;

        // separateMedialDigraph and separateFinalDigraph if possible, otherwise don't.
        return new HangulBlock(
            initials[initialIndex],
            (separateMedialDigraph && compoundVowels[medials[medialIndex]]) ||
                medials[medialIndex],
            (separateFinalDigraph && consonantDigraphs[finals[finalIndex]]) ||
                finals[finalIndex]
        );
    }
}
