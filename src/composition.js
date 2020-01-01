import { hangulMaps, isHangul } from "./mappings";
const { initials, medials, finals, compoundVowels, consonantDigraphs } = hangulMaps;

export class Block {
    constructor (initial = "", medial = "", final = "") {
        this.initial = initial;
        this.medial = medial;
        this.final = final;
    }

    clone () {
        return new Block(this.initial, this.medial, this.final);
    }

    /**
     * @returns {string}
     */
    toChar () {
        const a = initials.indexOf(this.initial),
            b = this.medial.length == 1 ?
                    medials.indexOf(this.medial) :
                    medials.indexOf(compoundVowels[this.medial]),
            c = (this.final.length == 1 ?
                    finals.indexOf(this.final) :
                    finals.indexOf(consonantDigraphs[this.final])) + 1;

        return (a > -1 && b >-1) ?
            // Jamo to Unicode character formula: (initial)×588 + (medial)×28 + (final) + 44032
            String.fromCharCode(a * 588 + b * 28 + c + 44032) :
            (compoundVowels[this.initial] || consonantDigraphs[this.initial] || this.initial);
    }

    /**
     * @param {string} character 
     */
    static fromChar (character, separateMedialDigraph = true, separateFinalDigraph = true) {
        let z = character.charCodeAt(0) - 44032;
        
        if (z < 0) return new Block(character);
        
        let a = ~~(z / 588);
        z -= a * 588;
        let b = ~~(z / 28);
        z -= b * 28;
        let c = z - 1;
        
        return new Block(
            initials[a],
            (separateMedialDigraph ? compoundVowels[medials[b]] : null) || medials[b],
            (separateFinalDigraph ? consonantDigraphs[finals[c]] : null) || finals[c]
        );
    }
}

export function Compositor () {
    var block = new Block();

    this.reset = () => {
        block = new Block();
    };

    /**
     * @param {string} jamo
     */
    this.addJamo = jamo => block.medial.length === 0 ?
        addInitialJamo(jamo) :
        block.final.length === 0 ?
            addMedialJamo(jamo) :
            addFinalJamo(jamo);

    this.removeLastJamo = () =>  {
        ["final", "medial", "initial"].some(key => {
            const value = block[key];
            if (value.length > 0) {
                block[key] = value.substr(0, value.length - 1);
                return true;
            }
        });

        return block.toChar();
    };

    /**
     * @param {string} char
     */
    this.setCharacter = char => {
        block = Block.fromChar(char);
    };

    this.isCompositing = () => block.initial.length > 0;

    /**
     * Called when either nothing exists, or an initial exists
     * @param {string} jamo 
     */
    function addInitialJamo (jamo) {
        const combined = block.initial + jamo;

        if (!isHangul(jamo)) {
            return { completed: jamo };

        } else if(compoundVowels[combined] || consonantDigraphs[combined] || !block.initial) {
            // (V)V or (C)C or C or V, or nothing
            block.initial = combined;
            return {
                inProgress: block.toChar()
            };
        
        } else if(initials.indexOf(block.initial) > -1 && medials.indexOf(jamo) > -1) {
            // (C)+V
            return addMedialJamo(jamo);
                
        } else if(consonantDigraphs[block.initial] && medials.indexOf(jamo) > -1) {
            // (C)C+V
            const completed = block.initial[0];
            block.initial = block.initial[1];
            return {
                completed,
                inProgress: addMedialJamo(jamo).inProgress
            };
                
        } else {
            // (CC|C)C or (VV|V)[VC]
            const completed = block.toChar();
            block.initial = jamo;
            return {
                completed,
                inProgress: jamo
            };
        }
    }

    /**
     * called when a valid initial already exists
     * @param {string} jamo 
     */
    function addMedialJamo (jamo) {
        const combined = block.medial + jamo;
        const isMedial = (medials.indexOf(jamo) > -1);    
        
        if ((!block.medial && isMedial) || compoundVowels[combined]) {
            // (C)+V or (C+V)V
            block.medial += jamo;
            return { inProgress: block.toChar() };
            
        } else if (isMedial) {
            // (C+V)+V or (C+VV)+V
            const completed = block.toChar();
            block = new Block(jamo);
            return {
                completed,
                inProgress: jamo
            };

        } else {
            // (C+V)+C or (C+VV)+C
            return addFinalJamo(jamo);
        }
    }

    /**
     * called when valid initial & medial exists, i.e. (C+V) or (C+VV)
     * @param {*} jamo 
     */
    function addFinalJamo (jamo) {
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
            block.final = block.final.substr(0, length - 1);
            const completed = block.toChar();
            block = new Block(lastConsonant, jamo);
            return {
                completed,
                inProgress: block.toChar()
            };

        } else {
            const completed = block.toChar();
            block = new Block(jamo);
            return {
                completed,
                inProgress: block.toChar()
            };
        }
    }
}
