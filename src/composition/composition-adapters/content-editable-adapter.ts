import { KeyCode } from "../../keyboard/korean-keyboard-map";
import { CompositionAdapter } from "./composition-adapter";
import { CompositingBox, GlyphRect } from "../compositing-box";

/**
 * Handles IME composition for contentEditable elements.
 * Also works in CKEditor.
 *
 * Causes "interesting" behaviour in Google Docs. This suggests we are not quite
 * implementing our text entry exactly the same as the browser does - which is our goal.
 * @param {HTMLElement} element
 */
export class ContentEditableAdapter extends CompositionAdapter {
    private isCompositing = false;
    private _currentBlock = "";

    /** The overlay drawn over the composing block. */
    private compositingBox?: CompositingBox = undefined;

    constructor(element: HTMLElement) {
        super(element);
    }

    private get currentBlock(): string {
        return this._currentBlock;
    }

    private set currentBlock(value: string) {
        this._currentBlock = value;
        this.compositingBox?.update(value);
    }

    deleteContentBackwards(): void {
        super._deleteContentBackwards(() => {
            document.execCommand("delete");
        });
    }

    getPreviousCharacter(): string | undefined {
        const selection = window.getSelection();

        if (!selection) {
            return undefined;
        }

        const range = selection.getRangeAt(0).cloneRange();

        // if range is not caret, return undefined
        if (range.startOffset !== range.endOffset) {
            return undefined;
        }

        // if range start and end don't have this.element as an ancestor, return undefined
        if (!this.element.contains(range.startContainer) || !this.element.contains(range.endContainer)) {
            return undefined;
        }

        // if range is at the start of the element, return undefined
        if (range.startOffset === 0) {
            return undefined;
        }

        range.setStart(range.startContainer, range.startOffset - 1);

        return range.toString();
    }

    blur() {
        // todo: don't call blur - call endComposition if required
        if (this.isCompositing) {
            this.endComposition(this.currentBlock);
        }
    }

    collapseSelection(toStart?: boolean) {
        if (this.isCompositing) {
            throw new Error("Cannot collapse selection when compositing");
        }

        const range = this.guardSelection().getRangeAt(0);

        range.collapse(toStart);
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

        this._beginComposition(data, keyCode, () => {
            // replace the current selection with the new data
            const selection = window.getSelection();
            if (selection) {
                selection.deleteFromDocument();
                const range = selection.getRangeAt(0);
                range.insertNode(document.createTextNode(data));
                range.collapse(false);
            }
            document.dispatchEvent(new Event("selectionchange"));
        });

        // The glyph is now in the DOM with the caret just after it, so the box can
        // measure it. (See measureCompositingRect.)
        this.compositingBox = new CompositingBox(this.element, () => this.measureCompositingRect());
        this.compositingBox.show(data);

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

        this._updateComposition(data, keyCode, () => {
            // modify the character immediately before the caret
            const selection = window.getSelection();
            if (selection) {
                const range = selection.getRangeAt(0);
                range.setStart(range.startContainer, range.startOffset - 1);
                range.deleteContents();
                range.insertNode(document.createTextNode(data));
                range.collapse(false);
            }
        });
        this.currentBlock = data;
    }

    /*
        When using Microsoft IME in Korean, the composition can be ended in various ways. For our purposes,
        it doesn't matter how it is ended, so just the "compositionend" event is fired.
     */
    endComposition(data: string) {
        if (!this.isCompositing) {
            throw new Error("Cannot end composition when not compositing");
        }

        try {
            this.element.dispatchEvent(
                new CompositionEvent("compositionend", {
                    data: data,
                    view: window,
                    bubbles: true,
                })
            );

            // modify the character immediately before the caret
            const selection = window.getSelection();
            if (selection) {
                const range = selection.getRangeAt(0);

                if (process.env.NODE_ENV === "development") {
                    if (range.startOffset === 0) {
                        // eslint-disable-next-line no-debugger
                        debugger; // we "know" there is a character before the caret, but apparently not.
                    }
                }

                range.setStart(range.startContainer, range.startOffset - 1);
                range.deleteContents();
                range.insertNode(document.createTextNode(data));
                range.collapse(false);
            }
        } finally {
            this.isCompositing = false;
            this.currentBlock = "";
            this.compositingBox?.remove();
            this.compositingBox = undefined;
        }
    }

    inputCharacter(data: string, keyCode: KeyCode): void {
        if (this.isCompositing) {
            throw new Error("Cannot input character when compositing");
        }

        const selection = window.getSelection();
        if (!selection) {
            throw new Error("Cannot input character when there is no selection");
        }

        const inputCharacterFn = () => {
            // This inserts a non-breaking space (&nbsp;)
            // todo: dynamically switch between " " and "\u00A0" depending on the previous string of spaces.
            // make sure to emulate the actual behaviour of a contenteditable element.
            const text = data === " " ? "\u00A0" : data;
            const selection = window.getSelection();
            if (selection) {
                const range = selection.getRangeAt(0);
                range.insertNode(document.createTextNode(text));
                range.collapse(false);
            }
        };

        return super._inputCharacter(data, keyCode, inputCharacterFn);
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
     * The composing glyph's viewport rect, measured directly from a Range over the
     * character immediately before the caret (the just-composed block). No DOM
     * mutation, so it's safe to re-run on every scroll frame as the box re-aligns.
     */
    getPreviousCharacterRect(): GlyphRect | undefined {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) {
            return undefined;
        }

        const caret = selection.getRangeAt(0);
        if (!this.element.contains(caret.startContainer) || !this.element.contains(caret.endContainer)) {
            return undefined;
        }

        if (!caret.collapsed || caret.startOffset < 1) {
            return undefined;
        }

        // Select the content immediately before the caret — the just-composed
        // glyph. This works whether the caret sits inside the glyph's text node
        // (offsets are character indices, so this spans one character) or in its
        // parent element (offsets are child indices, so this spans the glyph's text
        // node) — the latter is where the caret usually lands after the block is
        // inserted, which is why guarding on a text-node container drew no box.
        const glyph = document.createRange();
        try {
            glyph.setStart(caret.startContainer, caret.startOffset - 1);
            glyph.setEnd(caret.startContainer, caret.startOffset);
        } catch {
            return undefined;
        }
        const rect = glyph.getBoundingClientRect();

        if (rect.width === 0 && rect.height === 0) {
            return undefined;
        }

        return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    }

    private measureCompositingRect(): GlyphRect | undefined {
        return this.getPreviousCharacterRect();
    }
}
