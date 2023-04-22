"use strict";

import { KeyCode } from "../../content-script/on-screen-keyboard/korean-keyboard-map";
import { CompositionAdapter } from "./composition-adapter";
import { setAsKimeEvent } from "../../messaging/dom-events";

/**
 * Handles IME composition (and selection) for Google Docs.
 * Partially implements the W3C IME API: https://wicg.github.io/input-method-javaScript/
 * @param {HTMLElement} element
 */
export class GoogleDocsAdapter extends CompositionAdapter {
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

        const eventsToDispatch = [
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

        eventsToDispatch.forEach(event => {
            setAsKimeEvent(event);
            this.element.dispatchEvent(event);
        });

        this.isCompositing = true;
    }

    /*
        When using Microsoft IME in Korean, the following events are fired when subsequent character
        have been entered:
        - keydown
        - beforeinput
        - compositionupdate
        - input
        - keyup
    */
    updateComposition(data: string, keyCode: KeyCode) {
        if (!this.isCompositing) {
            throw new Error("Cannot update composition when not compositing");
        }

        const eventsToDispatch = [
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

        eventsToDispatch.forEach(event => {
            setAsKimeEvent(event);
            this.element.dispatchEvent(event);
        });

        this.currentBlock = data;
    }

    /**
        When using Microsoft IME in Korean, the composition can be ended in various ways. Google Docs doesn't
        care how it is ended, so just the compositionend event is fired.
     */
    endComposition(data: string) {
        this.element.dispatchEvent(new CompositionEvent("compositionend", {
            data: data,
            view: window
        }));
        this.currentBlock = "";
        this.isCompositing = false;
    }

    inputCharacter(data: string, keyCode: KeyCode): void {
        // simulate typing a character
        const eventsToDispatch = [
            new KeyboardEvent("keydown", {
                key: data,
                code: keyCode,
                view: window
            }),
            new KeyboardEvent("keypress", {
                key: data,
                code: keyCode,
                view: window
            }),
            new InputEvent("beforeinput", {
                data: data,
                inputType: "insertText"
            }),
            new InputEvent("input", {
                data: data,
                inputType: "insertText"
            }),
            new KeyboardEvent("keyup", {
                key: data,
                code: keyCode,
                view: window
            })
        ];

        this.dispatchEvents(eventsToDispatch);
    }

    /** @returns {EventTarget} */
    getListenerTarget(eventType: string): EventTarget {
        switch (eventType) {
            case "mousedown":
                return window.document;

            default:
                return this.element;
        }
    }
}
