import { InputAdapter } from "./composition-adapters/input-adapter";
import { GoogleDocsAdapter } from "./composition-adapters/google-docs-adapter";
import { CompositionAdapter } from "./composition-adapters/composition-adapter";
import { createLoggingProxy } from "../dev-helpers/logging-proxy";
import { WordForTheWebAdapter } from "./composition-adapters/word-for-the-web-adapter";
import { CkEditorAdapater } from "./composition-adapters/ck-editor-adapter";
import { ContentEditableAdapter } from "./composition-adapters/content-editable-adapter";

export class CompositionAdapterFactory {
    static createCompositionAdapter (element: HTMLElement) : CompositionAdapter | undefined {
        const adapter = (function () {
            if (canBeTreatedAsInputElement(element)) {
                return new InputAdapter(element);

            } else if (isGoogleDocsElement(element)) {
                return new GoogleDocsAdapter(element);

            } else if (isCkEditorElement(element)) {
                return new CkEditorAdapater(element);

            } else if (isWordForTheWebElement(element)) {
                return new WordForTheWebAdapter(element);

            } else if (element.isContentEditable) {
                return new ContentEditableAdapter(element);
            }

            return undefined;
        })();

        console.debug("Creating composition adapter", adapter);
        return adapter ? createLoggingProxy(adapter) : undefined;
    }
}

function canBeTreatedAsInputElement(element: HTMLElement): element is HTMLInputElement {
    // check if the element has a property called selectionStart
    // if so we will treat it like an input[type=text] element.
    return "selectionStart" in element;
}

function isGoogleDocsElement(element: HTMLElement) {
    return element.isContentEditable &&
        window.frameElement &&
        window.frameElement.classList.contains("docs-texteventtarget-iframe");
}

function isCkEditorElement(element: HTMLElement) {
    return element.isContentEditable &&
        element.classList.contains("ck-editor__editable");
}

function isWordForTheWebElement(element: HTMLElement) {
    return element.isContentEditable &&
        element.id === "WACViewPanel_EditingElement";
}
