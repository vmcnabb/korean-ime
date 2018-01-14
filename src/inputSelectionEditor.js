(ime => {
    ime.InputSelectionEditor = function InputSelectionEditor (element) {
        var selected;
        const replace = this.replace = function(text) {
            const start = element.selectionStart;
            let end = element.selectionEnd;
            element.value = element.value.substring(0, start)
                + text
                + element.value.substring(end, element.value.length);
            end = start + text.length;
            element.selectionStart = start;
            element.selectionEnd = end;
            selection = { start, end };
        }

        const deselect = this.deselect = function() {
            element.selectionStart = element.selectionEnd;
        }

        this.restore = () => {};

        this.insert = function(text) {
            replace(text);
            deselect();
        };

        this.selectPreviousCharacter = function () {
            // input[type=text]
            const start = element.selectionStart - 1;
            const end = start + 1;

            if (start >= 0) {
                element.selectionStart = start;
                element.selectionEnd = end;
                selection = { start, end }
                return element.value.substr(start, 1);
            }
        }
    }
})(window.koreanIme);
