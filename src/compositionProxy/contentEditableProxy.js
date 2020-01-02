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

    selectPreviousCharacter () {
        // [contentEditable]
        const selection = this.element.ownerDocument.getSelection();
        const startOffset = selection.focusOffset;

        if (selection.type === "Caret" && startOffset > 0) {
            selection.getRangeAt(0).setStart(selection.focusNode, startOffset - 1);
            return selection.focusNode.nodeValue.substr(startOffset - 1, 1);

        } else return false;
    }
}
