import { InputSelectionEditor } from "./inputSelectionEditor.js";
import { ContentEditableSelectionEditor } from "./contentEditableSelectionEditor.js"
import { GoogleDocsSelectionEditor } from "./googleDocsSelectionEditor.js";

export class SelectionEditorFactory {
    static createSelectionEditor (element) {
        if (element.selectionStart !== undefined) {
            return new InputSelectionEditor(element);

        } else if (element.isContentEditable) {
            if (window.frameElement && window.frameElement.classList.contains("docs-texteventtarget-iframe")) {
                return new GoogleDocsSelectionEditor(element);
            }

            return new ContentEditableSelectionEditor(element);
        }
    }
}
