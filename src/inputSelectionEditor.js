export class InputSelectionEditor {
    /**
     * @param {HTMLInputElement} element
     */
    constructor (element) {
        this.element = element;
    }

    /**
     * @param {string} text 
     */
    replace (text) {
        const element = this.element;
        const start = element.selectionStart;
        let end = element.selectionEnd;

        element.value = element.value.substring(0, start)
            + text
            + element.value.substring(end, element.value.length);
        end = start + text.length;
        element.selectionStart = start;
        element.selectionEnd = end;
    }

    deselect () {
        this.element.selectionStart = this.element.selectionEnd;
    }

    restore () {};

    /**
     * @param {string} text 
     */
    insert (text) {
        this.replace(text);
        this.deselect();
    };

    selectPreviousCharacter () {
        // input[type=text]
        const start = element.selectionStart - 1;
        const end = start + 1;

        if (start >= 0) {
            element.selectionStart = start;
            element.selectionEnd = end;
            return element.value.substr(start, 1);
        }
    }
}