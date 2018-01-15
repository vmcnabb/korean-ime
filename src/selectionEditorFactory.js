import { InputSelectionEditor } from "./inputSelectionEditor.js";
import { ContentEditableSelectionEditor } from "./contentEditableSelectionEditor.js"

export class SelectionEditorFactory {
    static createSelectionEditor (element) {
        if (element.selectionStart !== undefined) {
            return new InputSelectionEditor(element);

        } else if (element.isContentEditable) {
            return new ContentEditableSelectionEditor(element);
        }
    }
}
