"use strict";

import { CompositionAdapterBase } from "./compositionAdapterBase";

export class GoogleDocsAdapter extends CompositionAdapterBase {
    constructor (element) {
        super(element);

        this.isCompositing = false;
        /** @type {string | undefined} */
        this.currentBlock = undefined;
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

    updateComposition (block) {
        if (!this.isCompositing) {
            this.element.dispatchEvent(new CompositionEvent("compositionstart"));
            this.isCompositing = true;
        }

        this.element.dispatchEvent(new CompositionEvent("compositionupdate", { data: block }));
        this.currentBlock = block;
    }

    endComposition (block) {
        this.element.dispatchEvent(new CompositionEvent("compositionend", { data: block }));
        this.currentBlock = undefined;
    }

    /** @returns {EventTarget} */
    getListenerTarget(/** @type {string} */ eventType) {
        switch (eventType) {
            case "mousedown":
                return window.parent.document;

            default:
                return this.element;
        }
    }
}
