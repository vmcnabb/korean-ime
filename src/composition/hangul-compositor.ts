import { hasProperties } from "../types/objects";
import { hangulMaps, isHangulCharacter } from "../mappings";
import { HangulBlock } from "./hangul-block";

const { initials, medials, finals, compoundVowels, consonantDigraphs } =
    hangulMaps;

type CompositingResult =
    | { started: string }
    | { updated: string }
    | { completed: string }
    | { started: string; completed: string };

/**
 * Composes Hangul characters from jamo.
 */
export class HangulCompositor {
    constructor(private block = new HangulBlock()) {}

    reset() {
        this.block = new HangulBlock();
    }

    addJamo(jamo: string): CompositingResult {
        if (!isHangulCharacter(jamo)) {
            throw new Error(`${jamo} is not a valid Jamo.`);
        }

        if (this.block.medial.length === 0) {
            return this.addInitialJamo(jamo);
        }
        if (this.block.final.length === 0) {
            return this.addMedialJamo(jamo);
        }
        return this.addFinalJamo(jamo);
    }

    /**
     * @returns the Hangul character with the last jamo removed
     */
    removeLastJamo(): string {
        ["final", "medial", "initial"].some((k) => {
            const key = k as "final" | "medial" | "initial";

            const value = this.block[key];

            if (value.length === 0) {
                return false;
            }

            this.block[key] = value.substring(0, value.length - 1);
            return true;
        });

        return this.block.toChar();
    }

    setCharacter(char: string) {
        this.block = HangulBlock.fromChar(char);
    }

    isCompositing() {
        return this.block.initial.length > 0;
    }

    getCurrentChar() {
        return this.block.toChar();
    }

    /**
     * Called when either nothing exists, or an initial exists
     */
    private addInitialJamo(jamo: string): CompositingResult {
        const block = this.block;
        const combined = block.initial + jamo;

        if (!block.initial) {
            // C or V, or nothing
            block.initial = jamo;
            return {
                started: jamo,
            };
        } else if (compoundVowels[combined] || consonantDigraphs[combined]) {
            // (V)V or (C)C
            block.initial = combined;
            return {
                updated: block.toChar(),
            };
        } else if (
            initials.indexOf(block.initial) > -1 &&
            medials.indexOf(jamo) > -1
        ) {
            // (C)+V
            return this.addMedialJamo(jamo);
        } else if (
            consonantDigraphs[block.initial] &&
            medials.indexOf(jamo) > -1
        ) {
            // (C)C+V
            // e.g. ㄳ + ㅏ = ㄱ사
            const completed = block.initial[0];
            block.initial = block.initial[1];

            const updateResult = this.addMedialJamo(jamo);
            if (!hasProperties(updateResult, "updated")) {
                throw new Error(
                    "Expected updateResult to have property 'updated'."
                );
            }

            return {
                completed,
                started: updateResult.updated,
            };
        } else {
            // (CC|C)C or (VV|V)[VC]
            const completed = block.toChar();
            block.initial = jamo;
            return {
                completed,
                started: jamo,
            };
        }
    }

    /**
     * called when a valid initial already exists
     */
    private addMedialJamo(jamo: string): CompositingResult {
        const block = this.block;
        const combined = block.medial + jamo;
        const isMedial = medials.indexOf(jamo) > -1;

        if ((!block.medial && isMedial) || compoundVowels[combined]) {
            // (C)+V or (C+V)V
            block.medial += jamo;
            return { updated: block.toChar() };
        } else if (isMedial) {
            // (C+V)+V or (C+VV)+V
            const completed = block.toChar();
            this.block = new HangulBlock(jamo);
            return {
                completed,
                started: jamo,
            };
        } else {
            // (C+V)+C or (C+VV)+C
            return this.addFinalJamo(jamo);
        }
    }

    /**
     * called when valid initial & medial exists, i.e. (C+V) or (C+VV)
     */
    private addFinalJamo(jamo: string): CompositingResult {
        const block = this.block;
        const combined = block.final + jamo;
        const isValidFinal =
            (!block.final && finals.indexOf(jamo) > -1) ||
            consonantDigraphs[combined];

        if (isValidFinal) {
            // C+(V|VV)+(C|CC)
            block.final += jamo;
            return { updated: block.toChar() };
        } else if (block.final && medials.indexOf(jamo) > -1) {
            // if this is a vowel, take last consonant and create new character
            const length = block.final.length;
            const lastConsonant = block.final[length - 1];
            block.final = block.final.substring(0, length - 1);
            const completed = block.toChar();
            this.block = new HangulBlock(lastConsonant, jamo);
            return {
                completed,
                started: this.block.toChar(),
            };
        } else {
            const completed = block.toChar();
            this.block = new HangulBlock(jamo);
            return {
                completed,
                started: this.block.toChar(),
            };
        }
    }
}
