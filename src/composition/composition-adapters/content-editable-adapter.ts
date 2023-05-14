import { KeyCode } from "../../content-script/on-screen-keyboard/korean-keyboard-map";
import { CompositionAdapter, DispatchableAction } from "./composition-adapter";

/**
 * Handles IME composition for contentEditable elements.
 * Also works in CKEditor.
 *
 * Causes "interesting" behaviour in Google Docs. This suggests we are not quite
 * implementing our text entry exactly the same as the browser does - which is our goal.
 * @param {HTMLElement} element
 */
export class ContentEditableAdapter extends CompositionAdapter {
    private isCompositing: boolean = false;
    private _currentBlock: string = "";

    /**
     * Used to display or underline the current composition.
     */
    private compositingBox?: HTMLElement = undefined;

    constructor(element: HTMLElement) {
        super(element);
    }

    private get currentBlock(): string {
        return this._currentBlock;
    }

    private set currentBlock(value: string) {
        this._currentBlock = value;
        if (this.compositingBox) {
            this.compositingBox.innerText = value;
        }
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
        range.createContextualFragment;

        // if range is not caret, return undefined
        if (range.startOffset !== range.endOffset) {
            return undefined;
        }

        // if range start and end don't have this.element as an ancestor, return undefined
        if (
            !this.element.contains(range.startContainer) ||
            !this.element.contains(range.endContainer)
        ) {
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
            throw new Error(
                "Cannot begin composition when already compositing"
            );
        }

        const eventsToDispatch: DispatchableAction[] = [
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

        this.dispatchActions(eventsToDispatch);
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

        const eventsToDispatch: DispatchableAction[] = [
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
            }),
        ];

        this.dispatchActions(eventsToDispatch);
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
            this.removeCompositingBox();
        }
    }

    inputCharacter(data: string, keyCode: KeyCode): void {
        if (this.isCompositing) {
            throw new Error("Cannot input character when compositing");
        }

        const selection = window.getSelection();
        if (!selection) {
            throw new Error(
                "Cannot input character when there is no selection"
            );
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
     * Creates a box that is positioned at the current caret position. This box is used to indicate that the character
     * shown is being composed.
     */
    private createCompositingBox() {
        if (this.compositingBox) {
            this.removeCompositingBox();
        }

        const selection = window.getSelection();

        if (!selection || selection.rangeCount === 0) {
            console.error("no selection!");
            return;
        }

        // find x/y coordinates of caret
        const range = selection.getRangeAt(0);

        // Create a temporary span element at the caret position to measure the height/width of the
        // selection of a Hangul character as well as the x/y coordinates of the caret.
        const span = document.createElement("span");
        span.textContent = "아"; // same height/width as all Hangul characters
        span.style.display = "inline-block";
        range.insertNode(span);

        const characterRect = span.getBoundingClientRect();
        const selectionStyle = this.getAssignableStyles(span);
        span.parentNode!.removeChild(span);

        // Take the current scroll position into account
        const scrollTop = window.scrollY;
        const scrollLeft = window.scrollX;

        const left =
            characterRect.left -
            characterRect.width + // we created the compositing box after already rendering the character
            scrollLeft;
        const top = characterRect.top + scrollTop;

        const borderLeftWidth = 1;
        const borderTopWidth = 1;

        const style: Partial<CSSStyleDeclaration> = {
            ...selectionStyle,
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
        };

        const characterBox = document.createElement("div");
        Object.assign(characterBox.style, style);

        document.body.appendChild(characterBox);

        this.compositingBox = characterBox;
    }

    private getAssignableStyles(
        sourceElement: Element
    ): Partial<CSSStyleDeclaration> {
        const computedStyles = window.getComputedStyle(sourceElement);

        const styles: Record<CSSStringKey, string> = {} as any;

        // get the default styles for an element at document root
        const testElement = document.createElement("div");
        testElement.innerText = "test";
        document.body.appendChild(testElement);
        const defaultStyles = window.getComputedStyle(testElement);

        for (let i = 0; i < computedStyles.length; i++) {
            const styleName = computedStyles[i] as CSSStringKey;
            if (shouldExclude(styleName, computedStyles, defaultStyles)) {
                continue;
            }
            styles[styleName] = computedStyles.getPropertyValue(styleName);
        }

        testElement.remove();

        return styles;

        function shouldExclude(
            styleName: string,
            computedStyles: CSSStyleDeclaration,
            defaultStyles: CSSStyleDeclaration
        ) {
            const excludeStartWith = [
                "background",
                "border",
                "outline",
                "position",
                "display",
                "visibility",
            ];

            if (
                excludeStartWith.some((prefix) => styleName.startsWith(prefix))
            ) {
                return true;
            }

            if (
                computedStyles.getPropertyValue(styleName) ===
                defaultStyles.getPropertyValue(styleName)
            ) {
                return true;
            }

            return false;
        }
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

export function updateSelectionToIncludePreviousCharacter(
    topContainer: Element
): Range | undefined {
    const selection = document.getSelection();
    if (!selection) {
        return;
    }

    const range = selection.getRangeAt(0);

    if (range.startOffset > 0) {
        range.setStart(range.startContainer, range.startOffset - 1);
        return range;
    }

    const initialStartNode = range.startContainer;

    if (isTextNode(initialStartNode)) {
        const previousSibling = range.startContainer.previousSibling;
        if (previousSibling) {
            const lastDescendant = getLastDescendant(previousSibling);
            let startIndex = lastDescendant.textContent?.length ?? 0;
            if (startIndex > 0) {
                startIndex--;
            }

            range.setStart(lastDescendant, startIndex);
            return range;
        }
    }

    const previousNode = getPreviousNode(range.startContainer);
    if (!previousNode || !topContainer.contains(previousNode)) {
        return;
    }

    const lastDescendant = getLastDescendant(previousNode);

    let endIndex = lastDescendant.textContent?.length ?? 0;
    if (endIndex > 0) {
        endIndex--;
    }
    range.setStart(lastDescendant, endIndex);

    return range;
}

function isTextNode(node: Node): node is Text {
    return node.nodeType === Node.TEXT_NODE;
}

function getPreviousNode(node: Node): Node | undefined {
    if (node.previousSibling) {
        return node.previousSibling;
    }

    if (node.parentNode) {
        return getPreviousNode(node.parentNode);
    }

    return undefined;
}

function getLastDescendant(node: Node): Node {
    if (node.lastChild) {
        return getLastDescendant(node.lastChild);
    }

    return node;
}
