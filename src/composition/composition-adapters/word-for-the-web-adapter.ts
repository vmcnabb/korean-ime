"use strict";

import { KeyCode } from "../../content-script/on-screen-keyboard/korean-keyboard-map";
import { CompositionAdapter, DispatchableEvent } from "./composition-adapter";
import { Take } from "../../types";

/**
 * Handles IME composition for Word for the Web.
 * Also works well with contentEditable elements in general as well as CKEditor.
 * It causes "interesting" behaviour in Google Docs.
 * @param {HTMLElement} element
 */
export class WordForTheWebAdapter extends CompositionAdapter {
    private isCompositing: boolean = false;
    private _currentBlock: string = "";
    private characterBox?: HTMLElement = undefined;

    constructor(element: HTMLElement) {
        super(element);
    }

    get currentBlock(): string {
        return this._currentBlock;
    }

    set currentBlock(value: string) {
        this._currentBlock = value;
        if (this.characterBox) {
            this.characterBox.innerText = value;
        }
    }

    selectPreviousCharacter(): string | undefined {
        // TODO: Implement
        return undefined;
    }

    handleBackspace(): void {
        // TODO: implement
    }

    blur() {
        // todo: don't call blur - call endComposition if required
        if (this.isCompositing) {
            this.endComposition(this.currentBlock);
        }
    }

    deselect() {
        if (!this.isCompositing) {
            return;
        }

        this.endComposition(this.currentBlock);
    }

    /*
        When using Microsoft IME in Korean, the following events are fired when the first character
        has been entered:
        - keydown
        - compositionstart
        - beforeinput
        - compositionupdate
        - input
        - keyup
    */
    beginComposition(data: string, keyCode: KeyCode) {
        if (this.isCompositing) {
            throw new Error("Cannot begin composition when already compositing");
        }

        const eventsToDispatch: DispatchableEvent[] = [
            new KeyboardEvent("keydown", {
                key: "Process",
                code: keyCode,
                view: window,
                bubbles: true,
            }),
            new CompositionEvent("compositionstart", {
                view: window,
                bubbles: true,
            }),
            new InputEvent("beforeinput", {
                data: data,
                isComposing: true,
                inputType: "insertCompositionText",
                bubbles: true,
            }),
            new CompositionEvent("compositionupdate", {
                data: data,
                view: window,
                bubbles: true,
            }),
            () => {
                // replace the current selection with the new data
                const selection = window.getSelection();
                if (selection) {
                    selection.deleteFromDocument();
                    const range = selection.getRangeAt(0);
                    range.insertNode(document.createTextNode(data));
                    range.collapse(false);
                }
            },
            new InputEvent("input", {
                data: data,
                isComposing: true,
                inputType: "insertCompositionText",
                bubbles: true,
            }),
            () => {
                document.dispatchEvent(new Event("selectionchange"));
            },
            new KeyboardEvent("keyup", {
                key: "Process",
                code: keyCode,
                view: window,
                bubbles: true,
            }),
        ];

        this.dispatchEvents(eventsToDispatch);
        this.createCompositingBox();

        this.currentBlock = data;
        this.isCompositing = true;
    }

    /*
        When using Microsoft IME in Korean, the following events are fired when subsequent character
        have been entered:
        - keydown
        - beforeinput
        - compositionupdate
        - (text is updated by the browser at this point)
        - input
        - keyup
    */
    updateComposition(data: string, keyCode: KeyCode) {
        if (!this.isCompositing) {
            throw new Error("Cannot update composition when not compositing");
        }

        const eventsToDispatch: DispatchableEvent[] = [
            new KeyboardEvent("keydown", {
                key: "Process",
                code: keyCode,
                isComposing: true,
                view: window,
                bubbles: true,
            }),
            new InputEvent("beforeinput", {
                data: data,
                isComposing: true,
                inputType: "insertCompositionText",
                bubbles: true,
            }),
            new CompositionEvent("compositionupdate", {
                data: data,
                view: window,
                bubbles: true,
            }),
            () => {
                // modify the character immediately before the caret
                const selection = window.getSelection();
                if (selection) {
                    const range = selection.getRangeAt(0);
                    range.setStart(range.startContainer, range.startOffset - 1);
                    range.deleteContents();
                    range.insertNode(document.createTextNode(data));
                    range.collapse(false);
                }
            },
            new InputEvent("input", {
                data: data,
                isComposing: true,
                inputType: "insertCompositionText",
                bubbles: true,
            }),
            new KeyboardEvent("keyup", {
                key: "Process",
                code: keyCode,
                isComposing: true,
                view: window,
                bubbles: true,
            })
        ];

        this.dispatchEvents(eventsToDispatch);
        this.currentBlock = data;
    }

    /*
        When using Microsoft IME in Korean, the composition can be ended in various ways. For our purposes,
        it doesn't matter how it is ended, so just the compositionend event is fired.
     */
    endComposition(data: string) {
        if (!this.isCompositing) {
            console.error("Not compositing!");
            return;
        }

        this.element.dispatchEvent(new CompositionEvent("compositionend", {
            data: data,
            view: window,
            bubbles: true,
        }));

        // modify the character immediately before the caret
        const selection = window.getSelection();
        if (selection) {
            const range = selection.getRangeAt(0);
            range.setStart(range.startContainer, range.startOffset - 1);
            range.deleteContents();
            range.insertNode(document.createTextNode(data));
            range.collapse(false);
        }

        this.removeCompositingBox();
        this.currentBlock = "";
        this.isCompositing = false;
    }

    inputCharacter(data: string, keyCode: string): void {
        if (this.isCompositing) {
            throw new Error("Cannot input character when compositing");
        }

        console.debug("Inputting character, not using keyCode: ", keyCode);

        const eventsToDispatch: DispatchableEvent[] = [
            new InputEvent("beforeinput", {
                data: data,
                inputType: "insertText",
                bubbles: true,
            }),
            () => {
                // insert the character
                const selection = window.getSelection();
                if (selection) {
                    const range = selection.getRangeAt(0);
                    range.insertNode(document.createTextNode(data));
                    range.collapse(false);
                }
            },
            new InputEvent("input", {
                data: data,
                inputType: "insertText",
                bubbles: true,
            }),
        ];

        this.dispatchEvents(eventsToDispatch);
    }

    /** @returns {EventTarget} */
    getListenerTarget(eventType: string): EventTarget {
        switch (eventType) {
            case "mousedown":
                return document;

            default:
                return this.element;
        }
    }

    /**
     * Creates a box that is positioned at the current caret position. This box is used to indicate that the character
     * shown is being composed.
     */
    private createCompositingBox() {
        if (this.characterBox) {
            this.removeCompositingBox();
        }

        const selection = window.getSelection();

        if (!selection || selection.rangeCount === 0) {
            console.error("no selection!")
            return;
        }

        // find x/y coordinates of caret
        const range = selection.getRangeAt(0);

        // Create a temporary span element at the caret position to measure the height/width of the
        // a Hangul character as well as the x/y coordinates of the caret.
        const span = document.createElement('span');
        span.textContent = "아"; // same height/width as all Hangul characters
        range.insertNode(span);
        const characterRect = span.getBoundingClientRect();

        const x = characterRect.left + window.pageXOffset - characterRect.width;
        const y = characterRect.top + window.pageYOffset;

        span.parentNode!.removeChild(span);

        const selectionStyle = Take(
            window.getComputedStyle(selection.anchorNode as Element),
            "fontFamily", "fontSize", "fontWeight", "fontStyle", "lineHeight", "letterSpacing", "textAlign",
            "textTransform", "textIndent", "textShadow", "direction", "writingMode", "unicodeBidi", "textOrientation",
            "fontVariant", "fontFeatureSettings", "fontKerning", "fontStretch", "fontSynthesis",
            "fontVariantAlternates", "fontVariantCaps", "fontVariantEastAsian", "fontVariantLigatures",
            "fontVariantNumeric", "fontVariantPosition", "fontVariationSettings", "fontOpticalSizing", "fontPalette",
            "fontSizeAdjust", "font"
        );

        const style: Partial<CSSStyleDeclaration> = {
            position: "absolute",
            top: `${y}px`,
            left: `${x}px`,
            width: `${characterRect.width}px`,
            height: `${characterRect.height}px`,
            backgroundColor: "transparent",
            zIndex: "2147483647",
            border: "1px dotted #48F",
            ...selectionStyle,
        }

        const characterBox = Object.assign(document.createElement("div"), { style });

        document.body.appendChild(characterBox);

        this.characterBox = characterBox;
        console.log("line drawn: ", characterBox);
    }

    private removeCompositingBox() {
        if (this.characterBox) {
            this.characterBox.remove();
            this.characterBox = undefined;
        }
    }
}
