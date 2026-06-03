import { InputAdapter } from "./composition-adapters/input-adapter";
import { CompositionAdapter } from "./composition-adapters/composition-adapter";
import { WordForTheWebAdapter } from "./composition-adapters/word-for-the-web-adapter";
import { CkEditorAdapter } from "./composition-adapters/ck-editor-adapter";
import { ContentEditableAdapter } from "./composition-adapters/content-editable-adapter";
import { debugLog } from "../debug-log";

export class CompositionAdapterFactory {
    static createCompositionAdapter(element: HTMLElement): CompositionAdapter | undefined {
        const adapter = (function () {
            if (canBeTreatedAsInputElement(element)) {
                return new InputAdapter(element);
            } else if (isGoogleDocsElement(element)) {
                // Google Docs moved to a canvas + EditContext editor that ignores
                // synthetic composition events, so we can't drive it. Stay out of the
                // way (return undefined) rather than composing into the void.
                return undefined;
            } else if (isCkEditorElement(element)) {
                return new CkEditorAdapter(element);
            } else if (isWordForTheWebElement(element)) {
                // Word for the Web still works via direct DOM editing, but it's on the
                // same EditContext trajectory as Docs and is fragile, so it's off by
                // default. Enable it for development with `npm run dev:chrome -- --enable-word`
                // (sets KIME_ENABLE_WORD, which Parcel inlines at build time).
                return process.env.KIME_ENABLE_WORD === "true" ? new WordForTheWebAdapter(element) : undefined;
            } else if (element.isContentEditable) {
                return new ContentEditableAdapter(element);
            }

            return undefined;
        })();

        debugLog("Creating composition adapter", adapter);
        return adapter;
    }
}

function canBeTreatedAsInputElement(element: HTMLElement): element is HTMLInputElement {
    // check if the element has a property called selectionStart
    // if so we will treat it like an input[type=text] element.
    return "selectionStart" in element;
}

function isGoogleDocsElement(element: HTMLElement) {
    return (
        element.isContentEditable &&
        window.frameElement &&
        window.frameElement.classList.contains("docs-texteventtarget-iframe")
    );
}

function isCkEditorElement(element: HTMLElement) {
    return element.isContentEditable && element.classList.contains("ck-editor__editable");
}

function isWordForTheWebElement(element: HTMLElement) {
    return element.isContentEditable && element.id === "WACViewPanel_EditingElement";
}
