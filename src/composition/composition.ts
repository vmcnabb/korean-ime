"use strict";

import { hangulMaps, isHangulCharacter } from "../mappings";
const { initials, medials, finals, compoundVowels, consonantDigraphs } = hangulMaps;

type CompositingResult =
  | { initial: string; inProgress?: never; completed?: string }
  | { initial?: string; inProgress: string; completed?: never }
  | { initial?: never; inProgress?: never; completed: string };

export class Block {
    constructor (public initial = "", public medial = "", public final = "") {}

    clone () {
        return new Block(this.initial, this.medial, this.final);
    }

    toChar(): string {
        const initialIndex = initials.indexOf(this.initial),
            medialIndex = this.medial.length == 1 ?
                medials.indexOf(this.medial) :
                medials.indexOf(compoundVowels[this.medial] as string),
            finalIndex = (this.final.length == 1 ?
                finals.indexOf(this.final) :
                finals.indexOf(consonantDigraphs[this.final] as string)) + 1;

        return (initialIndex > -1 && medialIndex >-1) ?
            // Jamo to Unicode character formula: (initial)×588 + (medial)×28 + (final) + 44032
            String.fromCharCode(initialIndex * 588 + medialIndex * 28 + finalIndex + 44032) :
            (compoundVowels[this.initial] || consonantDigraphs[this.initial] || this.initial);
    }

    static fromChar (character: string, separateMedialDigraph = true, separateFinalDigraph = true) {
        let workingIndex = character.charCodeAt(0) - 44032;
        
        if (workingIndex < 0) {
            return new Block(character);
        }

        let initialIndex = ~~(workingIndex / 588);
        
        workingIndex -= initialIndex * 588;
        let medialIndex = ~~(workingIndex / 28);
        
        workingIndex -= medialIndex * 28;
        let finalIndex = workingIndex - 1;
        
        return new Block(
            initials[initialIndex],
            (separateMedialDigraph ? compoundVowels[medials[medialIndex]] : null) || medials[medialIndex],
            (separateFinalDigraph ? consonantDigraphs[finals[finalIndex]] : null) || finals[finalIndex]
        );
    }
}

export class Compositor {
    constructor (private block = new Block()) {}

    reset () {
        this.block = new Block();
    };

    addJamo (jamo: string): CompositingResult {
        if (!isHangulCharacter(jamo)) {
            throw new Error("addJamo(jamo) must be called with a valid jamo.");
        }

        return this.block.medial.length === 0 ?
            this.addInitialJamo(jamo) :
            this.block.final.length === 0 ?
                this.addMedialJamo(jamo) :
                this.addFinalJamo(jamo);
    };

    /**
     * @returns the Hangul character with the last jamo removed
     */
    removeLastJamo (): string {
        ["final", "medial", "initial"].some(k => {
            const key = k as "final" | "medial" | "initial";

            const value = this.block[key];

            if (value.length === 0) {
                return false;
            }

            this.block[key] = value.substring(0, value.length - 1);
            return true;
        });

        return this.block.toChar();
    };

    setCharacter (char: string) {
        this.block = Block.fromChar(char);
    };

    isCompositing () {
        return this.block.initial.length > 0;
    }

    getCurrent () {
        return this.block.toChar();
    }

    /**
     * Called when either nothing exists, or an initial exists
     */
    private addInitialJamo (jamo: string): CompositingResult {
        const block = this.block;
        const combined = block.initial + jamo;

        if(compoundVowels[combined] || consonantDigraphs[combined] || !block.initial) {
            // (V)V or (C)C or C or V, or nothing
            block.initial = combined;
            return {
                initial: block.toChar()
            };

        } else if(initials.indexOf(block.initial) > -1 && medials.indexOf(jamo) > -1) {
            // (C)+V
            return this.addMedialJamo(jamo);

        } else if(consonantDigraphs[block.initial] && medials.indexOf(jamo) > -1) {
            // (C)C+V
            const completed = block.initial[0];
            block.initial = block.initial[1];
            return {
                completed,
                initial: this.addMedialJamo(jamo).inProgress
            };

        } else {
            // (CC|C)C or (VV|V)[VC]
            const completed = block.toChar();
            block.initial = jamo;
            return {
                completed,
                initial: jamo
            };
        }
    }

    /**
     * called when a valid initial already exists
     */
    private addMedialJamo (jamo: string): CompositingResult {
        const block = this.block;
        const combined = block.medial + jamo;
        const isMedial = (medials.indexOf(jamo) > -1);    
        
        if ((!block.medial && isMedial) || compoundVowels[combined]) {
            // (C)+V or (C+V)V
            block.medial += jamo;
            return { inProgress: block.toChar() };
            
        } else if (isMedial) {
            // (C+V)+V or (C+VV)+V
            const completed = block.toChar();
            this.block = new Block(jamo);
            return {
                completed,
                initial: jamo
            };

        } else {
            // (C+V)+C or (C+VV)+C
            return this.addFinalJamo(jamo);
        }
    }

    /**
     * called when valid initial & medial exists, i.e. (C+V) or (C+VV)
     */
    private addFinalJamo (jamo: string): CompositingResult {
        const block = this.block;
        const combined = block.final + jamo;
        const isValidFinal =
            (!block.final && finals.indexOf(jamo) > -1) ||
            consonantDigraphs[combined];

        if (isValidFinal) {
            // C+(V|VV)+(C|CC)
            block.final += jamo;
            return { inProgress: block.toChar() };

        } else if (block.final && medials.indexOf(jamo) > -1) { 
            // if this is a vowel, take last consonant and create new character
            const length = block.final.length;
            const lastConsonant = block.final[length - 1];
            block.final = block.final.substring(0, length - 1);
            const completed = block.toChar();
            this.block = new Block(lastConsonant, jamo);
            return {
                completed,
                initial: this.block.toChar()
            };

        } else {
            const completed = block.toChar();
            this.block = new Block(jamo);
            return {
                completed,
                initial: this.block.toChar()
            };
        }
    }
}
