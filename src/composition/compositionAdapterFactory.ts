"use strict";

import { InputAdapter } from "./compositionAdapters/inputAdapter";
import { ContentEditableAdapter } from "./compositionAdapters/contentEditableAdapter";
import { GoogleDocsAdapter } from "./compositionAdapters/googleDocsAdapter";
import { CompositionAdapter } from "./compositionAdapters/compositionAdapter";

export class CompositionAdapterFactory {
    static createCompositionAdapter (element: HTMLElement) : CompositionAdapter | undefined {
        if (canBeTreatedAsInputElement(element)) {
            return new InputAdapter(element);

        } else if (isGoogleDocsElement(element)) {
            return new GoogleDocsAdapter(element);

        } else if (element.isContentEditable) {
            return new ContentEditableAdapter(element);
        }

        return undefined;
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
