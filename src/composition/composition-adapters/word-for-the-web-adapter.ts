import { KeyCode } from "../../content-script/on-screen-keyboard/korean-keyboard-map";
import { CompositionAdapter, DispatchableEvent } from "./composition-adapter";
import { Take } from "../../typescript-typing/index";

/**
 * Handles IME composition for Word for the Web.
 * Also works well with contentEditable elements in general as well as CKEditor.
 * It causes "interesting" behaviour in Google Docs.
 * @param {HTMLElement} element
 */
export class WordForTheWebAdapter extends CompositionAdapter {
    private isCompositing: boolean = false;
    private _currentBlock: string = "";

    /** 
     * Used to display or underline the current composition.
     */
    private compositingBox?: HTMLElement = undefined;

    constructor(element: HTMLElement) {
        super(element);
    }

    get currentBlock(): string {
        return this._currentBlock;
    }

    set currentBlock(value: string) {
        this._currentBlock = value;
        if (this.compositingBox) {
            this.compositingBox.innerText = value;
        }
    }

    selectPreviousCharacter(): string | undefined {
        // TODO: Implement
        return undefined;
    }

    deleteContentBackward(): void {
        // fire events for backspace being pressed
        const eventsToDispatch: DispatchableEvent[] = [
            new KeyboardEvent("keydown", {
                key: "Backspace",
                code: KeyCode.Backspace,
                view: window,
                bubbles: true,
            }),
            new InputEvent("beforeinput", {
                inputType: "deleteContentBackward",
                bubbles: true,
            }),
            () => {
                // delete the previous character
                const selection = window.getSelection();
                if (selection) {
                    const range = selection.getRangeAt(0);
                    range.setStart(range.startContainer, range.startOffset - 1);
                    range.deleteContents();
                }
            },
            new InputEvent("input", {
                inputType: "deleteContentBackward",
                bubbles: true,
            }),
            new KeyboardEvent("keyup", {
                key: "Backspace",
                code: KeyCode.Backspace,
                view: window,
                bubbles: true,
            }),
        ];

        this.dispatchEvents(eventsToDispatch);
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

        // simulate the events that would be fired when typing a character
        const eventsToDispatch: DispatchableEvent[] = [
            new KeyboardEvent("keydown", {
                key: data,
                code: keyCode,
                view: window,
                bubbles: true,
            }),
            new KeyboardEvent("keypress", {
                key: data,
                code: keyCode,
                bubbles: true,
                view: window
            }),
            new InputEvent("beforeinput", {
                data: data,
                bubbles: true,
                inputType: "insertText",
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
                bubbles: true,
                inputType: "insertText"
            }),
            new KeyboardEvent("keyup", {
                key: data,
                code: keyCode,
                bubbles: true,
                view: window
            })
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
        if (this.compositingBox) {
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
        // selection of a Hangul character as well as the x/y coordinates of the caret.
        const span = document.createElement('span');
        span.textContent = "아"; // same height/width as all Hangul characters
        span.style.display = "inline-block";
        range.insertNode(span);

        const characterRect = span.getBoundingClientRect();
        span.parentNode!.removeChild(span);

        // Take the current scroll position into account
        const scrollTop = window.scrollY;
        const scrollLeft = window.scrollX;

        const left = characterRect.left
            - characterRect.width // we created the compositing box after already rendering the character
            + scrollLeft;
        const top = characterRect.top + scrollTop;

        const selectionStyle = this.getAssignableStyles(selection.anchorNode as Element);

        const borderLeftWidth = 1;
        const borderTopWidth = 1;

        const style: Record<CSSStringKey, string> = {
            ...selectionStyle,
            padding: "0",
            display: "inline-block",
            position: "absolute",
            top: `${top - borderTopWidth}px`,
            left: `${left - borderLeftWidth}px`,
            width: `${characterRect.width}px`,
            height: `${characterRect.height}px`,
            backgroundColor: "#CDF",
            zIndex: "2147483647",
            borderLeft: `${borderLeftWidth}px solid #48F`,
            borderTop: `${borderTopWidth}px solid #48F`,
            borderRight: "1px solid #48F",
            borderBottom: "1px solid #48F",
        }

        const characterBox = document.createElement("div");
        Object.assign(characterBox.style, style);

        document.body.appendChild(characterBox);

        this.compositingBox = characterBox;
    }

    private getAssignableStyles(sourceElement: Element): Record<CSSStringKey, string> {
        const computedStyles = window.getComputedStyle(sourceElement);

        const styles: Record<CSSStringKey, string> = {} as any;

        for (let i = 0; i < computedStyles.length; i++) {
            const styleName = computedStyles[i] as CSSStringKey
            styles[styleName] = computedStyles.getPropertyValue(styleName);
        }

        return styles;
    }

    private removeCompositingBox() {
        if (this.compositingBox) {
            this.compositingBox.remove();
            this.compositingBox = undefined;
        }
    }
}

type StringStyleKeys<T> = {
    [K in keyof T]: T[K] extends string ? K : never;
}[keyof T];

type CSSStringKey = Extract<StringStyleKeys<CSSStyleDeclaration>, string>;
