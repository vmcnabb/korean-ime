import { Block } from "./composition.js";
import { hangeulMaps as maps } from "./mappings.js";

/**
 * Return a string with the hangeul converted into Roman characters, e.g.
 * "hello 강" => "hello gang"
 * @param {string} text 
 */
export function romanize (text) {
    console.log("romanize(\"" + text + "\")");

    let romanText = '';
    let didPreviousCharSetInitial = false;
    let isPreviousCharHangeul = false;
    let nextBlock = Block.fromChar(text[0] || "", false);

    for (let i = 0; i < text.length; i++) {
        const block = nextBlock;
        const thisChar = text[i];
        const nextChar = text[i + 1] || "";
        nextBlock = Block.fromChar(nextChar, false);

        if (!isHangeul(thisChar)) {
            didPreviousCharSetInitial = false;
            isPreviousCharHangeul = false;
            romanText += thisChar;
            continue;
        }

        if (!didPreviousCharSetInitial) {
            if (!isPreviousCharHangeul && block.initial === "ㅇ") {
            } else {
                romanText += maps.hangeulIntialsRoman[block.initial];
            }
            // TODO: check what happens for "ㄺ" or any other digraph finals used on their own.
        }
        if (block.medial.length > 0) {
            romanText += maps.hangeulVowelsRoman[block.medial];

        } else {
            didPreviousCharSetInitial = false;
            isPreviousCharHangeul = true;
            continue;
        }

        if (block.final.length == 0) {
            didPreviousCharSetInitial = false;
            isPreviousCharHangeul = true;
            continue;
        }

        if (block.final.length == 2) {
            // double-consonant ending, romanise the first jamo as if it were an initial
            romanText += maps.hangeulIntialsRoman[block.final[0]];
        }

        const thisFinal = block.final.substr(-1);
        const special = maps.hangeulFinalInitialRoman[thisFinal + nextBlock.initial];

        if (isHangeul(nextChar) && special !== undefined) {
            romanText += special;
            didPreviousCharSetInitial = true;

        } else {
            romanText += maps.hangeulFinalsRoman[thisFinal];
            didPreviousCharSetInitial = false;
        }
        isPreviousCharHangeul = true;
    } // for i

    return romanText;
}

/**
 * @param {string} char 
 */
function isHangeul (char) {
    if (!char) return false;
    const cc = char.charCodeAt(0);
    return cc >= 0xAC00 && cc <= 0xD7A3;
}
