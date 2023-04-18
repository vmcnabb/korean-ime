"use strict";

import { CompositionAdapter } from "./compositionAdapter";

export class GoogleDocsAdapter extends CompositionAdapter {
    private isCompositing: boolean = false;
    private currentBlock: string | undefined;

    constructor (element: HTMLElement) {
        super(element);
    }

    selectPreviousCharacter(): string | undefined {
        // TODO: Implement
        return undefined;
    }

    handleBackspace(): void {
        // TODO: implement
    }

    blur () {
        this.endComposition(this.currentBlock);
    }

    deselect () {
        if (!this.currentBlock) {
            return;
        }

        this.element.dispatchEvent(new CompositionEvent("compositionend", { data: this.currentBlock }));
        this.currentBlock = undefined;
    }

    updateComposition (block: string | undefined) {
        if (!this.isCompositing) {
            this.element.dispatchEvent(new CompositionEvent("compositionstart"));
            this.isCompositing = true;
        }

        this.element.dispatchEvent(new CompositionEvent("compositionupdate", { data: block }));
        this.currentBlock = block;
    }

    endComposition (block: string | undefined) {
        this.element.dispatchEvent(new CompositionEvent("compositionend", { data: block }));
        this.currentBlock = undefined;
    }

    /** @returns {EventTarget} */
    getListenerTarget(eventType : string) : EventTarget {
        switch (eventType) {
            case "mousedown":
                return window.parent.document;

            default:
                return this.element;
        }
    }
}
