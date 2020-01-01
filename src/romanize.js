"use strict";

import { Block } from "./composition";
import { hangulMaps as maps, isHangul } from "./mappings";

/**
 * Return a string with the hangul converted into Roman characters, e.g.
 * "hello 강" => "hello gang"
 * @param {string} text 
 */
export function romanize (text) {
    let romanText = '';
    let didPreviousCharSetInitial = false;
    let isPreviousCharHangul = false;
    let nextBlock = Block.fromChar(text[0] || "", false);

    for (let i = 0; i < text.length; i++) {
        const block = nextBlock;
        const thisChar = text[i];
        const nextChar = text[i + 1] || "";
        nextBlock = Block.fromChar(nextChar, false);

        if (!isHangul(thisChar)) {
            didPreviousCharSetInitial = false;
            isPreviousCharHangul = false;
            romanText += thisChar;
            continue;
        }

        if (!didPreviousCharSetInitial) {
            if (!isPreviousCharHangul && block.initial === "ㅇ") {
            } else {
                romanText += maps.hangulIntialsRoman[block.initial];
            }
            // TODO: check what happens for "ㄺ" or any other digraph finals used on their own.
        }
        if (block.medial.length > 0) {
            romanText += maps.hangulVowelsRoman[block.medial];

        } else {
            didPreviousCharSetInitial = false;
            isPreviousCharHangul = true;
            continue;
        }

        if (block.final.length == 0) {
            didPreviousCharSetInitial = false;
            isPreviousCharHangul = true;
            continue;
        }

        if (block.final.length == 2) {
            // double-consonant ending, romanise the first jamo as if it were an initial
            romanText += maps.hangulIntialsRoman[block.final[0]];
        }

        const thisFinal = block.final.substr(-1);
        const special = maps.hangulFinalInitialRoman[thisFinal + nextBlock.initial];

        if (isHangul(nextChar) && special !== undefined) {
            romanText += special;
            didPreviousCharSetInitial = true;

        } else {
            romanText += maps.hangulFinalsRoman[thisFinal];
            didPreviousCharSetInitial = false;
        }
        isPreviousCharHangul = true;
    } // for i

    return romanText;
}
