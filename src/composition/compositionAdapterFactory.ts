"use strict";

import { InputAdapter } from "./compositionAdapters/inputAdapter";
import { ContentEditableAdapter } from "./compositionAdapters/contentEditableAdapter";
import { GoogleDocsAdapter } from "./compositionAdapters/googleDocsAdapter";
import { CompositionAdapter } from "./compositionAdapters/compositionAdapter";
import { CreateProxy } from "../devHelpers/loggingProxy";

export class CompositionAdapterFactory {
    static createCompositionAdapter (element: HTMLElement) : CompositionAdapter | undefined {
        const adapter = (function () {
            if (canBeTreatedAsInputElement(element)) {
                return new InputAdapter(element);

            } else if (isGoogleDocsElement(element)) {
                return new GoogleDocsAdapter(element);

            } else if (element.isContentEditable) {
                return new ContentEditableAdapter(element);
            }

            return undefined;
        })();

        return adapter ? CreateProxy(adapter) : undefined;
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
