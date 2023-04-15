"use strict";

import { InputProxy } from "./compositionProxy/inputProxy";
import { ContentEditableProxy } from "./compositionProxy/contentEditableProxy";
import { GoogleDocsProxy } from "./compositionProxy/googleDocsProxy";

export class CompositionProxyFactory {
    static createCompositionProxy (element) {
        if (element.selectionStart !== undefined) {
            return new InputProxy(element);

        } else if (isGoogleDocsElement(element)) {
            return new GoogleDocsProxy(element);

        } else if (element.isContentEditable) {
            return new ContentEditableProxy(element);
        }
    }
}

function isGoogleDocsElement(element) {
    return element.isContentEditable &&
        window.frameElement &&
        window.frameElement.classList.contains("docs-texteventtarget-iframe");
}
