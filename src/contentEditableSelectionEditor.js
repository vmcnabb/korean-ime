/**
 * @param {HTMLElement} element
 */
export function ContentEditableSelectionEditor (element) {
    var selected;
    const replace = this.replace = function(text) {
        const selection = element.ownerDocument.getSelection();
        const range = selection.getRangeAt(0);
        
        range.deleteContents();
        range.insertNode(document.createTextNode(text));
        selection.removeAllRanges();
        selection.addRange(range);
        selected = { range, selection };
    }

    const deselect = this.deselect = function() {
        const selection = element.ownerDocument.getSelection();
        const range = selection.getRangeAt(0);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
        selected = undefined;
    }

    this.restore = () => {
        if (selected) {
            // [contenteditable]
            // fix Gmail Compose selection bug on first key
            const selection = element.ownerDocument.getSelection();
            selection.removeAllRanges();
            selection.addRange(selected.range);
        }
    };

    this.insert = function(text) {
        replace(text);
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
    }
}
