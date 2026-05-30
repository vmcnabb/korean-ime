import { KeyCode } from "../../content-script/on-screen-keyboard/korean-keyboard-map";
import { CompositionAdapter, DispatchableAction } from "./composition-adapter";
import { methodNotSupported } from "../../decorators/method-not-supported";

/**
 * Handles IME composition (and selection) for Google Docs.
 * Partially implements the W3C IME API: https://wicg.github.io/input-method-javaScript/
 * @param {HTMLElement} element
 */
export class GoogleDocsAdapter extends CompositionAdapter {
    private isCompositing = false;
    private currentBlock = "";

    constructor(element: HTMLElement) {
        super(element);
    }

    @methodNotSupported
    getPreviousCharacter(): string | undefined {
        return;
    }

    deleteContentBackwards(): void {
        if (this.isCompositing) {
            throw new Error("Cannot delete character backward when compositing");
        }

        super._deleteContentBackwards(() => {
            // do nothing as Google Docs handles this for us
        });
    }

    blur() {
        this.endComposition(this.currentBlock);
    }

    @methodNotSupported
    collapseSelection(toStart?: boolean) {
        if (this.isCompositing) {
            throw new Error("Cannot collapse selection when compositing");
        }

        this.guardSelection().getRangeAt(0).collapse(toStart);
        // todo: see if this actually does anything
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

        const actions: DispatchableAction[] = [
            new KeyboardEvent("keydown", {
                key: "Process",
                code: keyCode,
                view: window,
            }),
            new CompositionEvent("compositionstart", {
                view: window,
            }),
            new InputEvent("beforeinput", {
                data: data,
                isComposing: true,
                inputType: "insertCompositionText",
            }),
            new CompositionEvent("compositionupdate", {
                data: data,
                view: window,
            }),
            new InputEvent("input", {
                data: data,
                isComposing: true,
                inputType: "insertCompositionText",
            }),
            new KeyboardEvent("keyup", {
                key: "Process",
                code: keyCode,
                view: window,
            }),
        ];

        super.dispatchActions(actions);
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

        const actions: DispatchableAction[] = [
            new KeyboardEvent("keydown", {
                key: "Process",
                code: keyCode,
                isComposing: true,
                view: window,
            }),
            new InputEvent("beforeinput", {
                data: data,
                isComposing: true,
                inputType: "insertCompositionText",
            }),
            new CompositionEvent("compositionupdate", {
                data: data,
                view: window,
            }),
            new InputEvent("input", {
                data: data,
                isComposing: true,
                inputType: "insertCompositionText",
            }),
            new KeyboardEvent("keyup", {
                key: "Process",
                code: keyCode,
                isComposing: true,
                view: window,
            }),
        ];

        super.dispatchActions(actions);
        this.currentBlock = data;
    }

    /**
        When using Microsoft IME in Korean, the composition can be ended in various ways. Google Docs doesn't
        care how it is ended, so just the compositionend event is fired.
     */
    endComposition(data: string) {
        this.element.dispatchEvent(
            new CompositionEvent("compositionend", {
                data: data,
                view: window,
            })
        );
        this.currentBlock = "";
        this.isCompositing = false;
    }

    inputCharacter(data: string, keyCode: KeyCode): void {
        super._inputCharacter(data, keyCode, () => {
            // do nothing as Google Docs handles this for us
        });
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
