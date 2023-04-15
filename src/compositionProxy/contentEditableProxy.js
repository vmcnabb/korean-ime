"use strict";

import { CompositionProxyBase } from "./compositionProxyBase";

export class ContentEditableProxy extends CompositionProxyBase {
    updateComposition (text) {
        const selection = this.element.ownerDocument.getSelection();
        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode(text));
        selection.removeAllRanges();
        selection.addRange(range);
    }

    deselect () {
        const selection = this.element.ownerDocument.getSelection();
        const range = selection.getRangeAt(0);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
    }

    endComposition (text) {
        this.updateComposition(text);
        this.deselect();
    }

    selectPreviousCharacter() {
        const selection = this.element.ownerDocument.getSelection();
        const startOffset = selection.focusOffset;

        const isCaret = selection.type === "Caret";
        const isNotAtBeginning = startOffset > 0;
        const hasRange = selection.rangeCount > 0;

        if (!isCaret || !isNotAtBeginning || !hasRange) {
            return false;
        }

        const range = selection.getRangeAt(0);
        range.setStart(selection.focusNode, startOffset - 1);
        return selection.focusNode.nodeValue.substring(startOffset - 1, startOffset);
    }
}
