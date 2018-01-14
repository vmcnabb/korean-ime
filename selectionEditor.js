(ime => {
    ime.SelectionEditor = SelectionEditor;

    function SelectionEditor (element) {
        var selected;
        const replace = this.replace = function(text) {
            if(element.selectionStart != undefined) {
                const start = element.selectionStart;
                let end = element.selectionEnd;
                element.value = element.value.substring(0, start)
                    + text
                    + element.value.substring(end, element.value.length);
                end = start + text.length;
                element.selectionStart = start;
                element.selectionEnd = end;
                selection = { start, end };
    
            } else {
                const selection = element.ownerDocument.getSelection();
                const range = selection.getRangeAt(0);
                
                range.deleteContents();
                range.insertNode(document.createTextNode(text));
                selection.removeAllRanges();
                selection.addRange(range);
                selected = { range, selection };
            }
        }

        const deselect = this.deselect = function() {
            if (element.selectionStart != undefined) {
                element.selectionStart = element.selectionEnd;

            } else if (selected) {
                selected.range.collapse(false);
                selected.selection.removeAllRanges();
                selected.selection.addRange(selected.range);
                selected = undefined;
            }
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
            if (element.selectionStart !== undefined) {
                // input[type=text]
                const start = element.selectionStart - 1;
                const end = start + 1;

                if (start >= 0) {
                    element.selectionStart = start;
                    element.selectionEnd = end;
                    selection = { start, end }
                    return element.value.substr(start, 1);
                }

            } else {
                // [contentEditable]
                const selection = element.ownerDocument.getSelection();
                const startOffset = selection.focusOffset;

                if (selection.type === "Caret" && startOffset > 0) {
                    selection.getRangeAt(0).setStart(selection.focusNode, startOffset - 1);
                    return selection.focusNode.nodeValue.substr(startOffset - 1, 1);

                } else return false;
            }
        }
    }
})(window.koreanIme);
