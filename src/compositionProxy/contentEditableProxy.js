"use strict";

/**
 * @param {HTMLElement} element
 */
export function ContentEditableProxy (element) {
    const updateComposition = this.updateComposition = function(text) {
        const selection = element.ownerDocument.getSelection();
        const range = selection.getRangeAt(0);
        
        range.deleteContents();
        range.insertNode(document.createTextNode(text));
        selection.removeAllRanges();
        selection.addRange(range);
    };

    const deselect = this.deselect = function() {
        const selection = element.ownerDocument.getSelection();
        const range = selection.getRangeAt(0);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
    };

    this.reset = () => {};

    this.endComposition = function(text) {
        updateComposition(text);
        deselect();
    };

    this.selectPreviousCharacter = function () {
        // [contentEditable]
        const selection = element.ownerDocument.getSelection();
        const startOffset = selection.focusOffset;

        if (selection.type === "Caret" && startOffset > 0) {
            selection.getRangeAt(0).setStart(selection.focusNode, startOffset - 1);
            return selection.focusNode.nodeValue.substr(startOffset - 1, 1);

        } else return false;
    };
}
