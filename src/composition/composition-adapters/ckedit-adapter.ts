"use strict";

import { KeyCode } from "../../content-script/on-screen-keyboard/korean-keyboard-map";
import { CompositionAdapter } from "./composition-adapter";
import { setAsKimeEvent } from "../../messaging/dom-events";

type DispatchableEvent = KeyboardEvent | CompositionEvent | InputEvent | (() => void);

/**
 * Handles IME composition (and selection) for the CKEditor
 * .
 * @param {HTMLElement} element
 */
export class CKEditorAdapter extends CompositionAdapter {
    private isCompositing: boolean = false;
    private currentBlock: string = "";

    constructor(element: HTMLElement) {
        super(element);
    }

    selectPreviousCharacter(): string | undefined {
        // TODO: Implement
        return undefined;
    }

    handleBackspace(): void {
        // TODO: implement
    }

    blur() {
        this.endComposition(this.currentBlock);
    }

    deselect() {
        if (!this.currentBlock) {
            return;
        }

        this.element.dispatchEvent(new CompositionEvent("compositionend", { data: this.currentBlock }));
        this.currentBlock = "";
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
                view: window
            }),
            new CompositionEvent("compositionstart", {
                view: window
            }),
            new InputEvent("beforeinput", {
                data: data,
                isComposing: true,
                inputType: "insertCompositionText"
            }),
            new CompositionEvent("compositionupdate", {
                data: data,
                view: window
            }),
            () => {
                // replace the current selection with the new data
                const selection = window.getSelection();
                if (selection) {
                    selection.deleteFromDocument();
                    selection.getRangeAt(0).insertNode(document.createTextNode(data));
                }
            },
            new InputEvent("input", {
                data: data,
                isComposing: true,
                inputType: "insertCompositionText"
            }),
            new KeyboardEvent("keyup", {
                key: "Process",
                code: keyCode,
                view: window
            }),
        ];

        this.dispatchEvents(eventsToDispatch);

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
                view: window
            }),
            new InputEvent("beforeinput", {
                data: data,
                isComposing: true,
                inputType: "insertCompositionText"
            }),
            new CompositionEvent("compositionupdate", {
                data: data,
                view: window
            }),
            () => {
                // replace the current selection with the new data
                const selection = window.getSelection();
                if (selection) {
                    selection.deleteFromDocument();
                    selection.getRangeAt(0).insertNode(document.createTextNode(data));
                }
            },
            new InputEvent("input", {
                data: data,
                isComposing: true,
                inputType: "insertCompositionText"
            }),
            new KeyboardEvent("keyup", {
                key: "Process",
                code: keyCode,
                isComposing: true,
                view: window
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
        this.element.dispatchEvent(new CompositionEvent("compositionend", {
            data: data,
            view: window
        }));
        this.currentBlock = "";
        this.isCompositing = false;
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

    private dispatchEvents(events: DispatchableEvent[]) {
        events.forEach(event => {
            if (event instanceof Event) {
                setAsKimeEvent(event);
                this.element.dispatchEvent(event);
            } else {
                event();
            }
        });
    }
}
