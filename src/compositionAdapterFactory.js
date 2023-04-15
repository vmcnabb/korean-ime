"use strict";

import { InputAdapter } from "./compositionAdapters/inputAdapter";
import { ContentEditableAdapter } from "./compositionAdapters/contentEditableAdapter";
import { GoogleDocsAdapter } from "./compositionAdapters/googleDocsAdapter";

export class CompositionAdapterFactory {
    static createCompositionAdapter (element) {
        if (canBeTreatedAsInputElement(element)) {
            return new InputAdapter(element);

        } else if (isGoogleDocsElement(element)) {
            return new GoogleDocsAdapter(element);

        } else if (element.isContentEditable) {
            return new ContentEditableAdapter(element);
        }
    }
}

function canBeTreatedAsInputElement(element) {
    // is an INPUT or TEXTAREA element or some new-fangled HTML element from the future
    return element.selectionStart !== undefined;
}

function isGoogleDocsElement(element) {
    return element.isContentEditable &&
        window.frameElement &&
        window.frameElement.classList.contains("docs-texteventtarget-iframe");
}
