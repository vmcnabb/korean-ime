(ime => {
    ime.SelectionEditor = SelectionEditor;

    function getSelectionEditor (element) {
        if (element.selectionStart !== undefined) {
            // input
            return new ime.InputSelectionEditor(element);

        } else if (element.isContentEditable) {
            return new ime.ContentEditableSelectionEditor(element);
        }
    }
})(window.koreanIme);
