"use strict";

import { CompositionProxyBase } from "./compositionProxyBase";

export class GoogleDocsProxy extends CompositionProxyBase {
    constructor (element) {
        super(element);

        this.isCompositing = false;
        /** @type {string} */
        this.currentBlock = undefined;
    }

    blur () {
        this.endComposition(this.currentBlock);
    }

    deselect () {
        if (this.currentBlock) {
            this.element.dispatchEvent(new CompositionEvent("compositionend", { data: this.currentBlock }));
            this.currentBlock = undefined;
        }
    }

    updateComposition (block) {
        if (!this.isCompositing) {
            this.element.dispatchEvent(new CompositionEvent("compositionstart"));
            this.isCompositing = true;
        }

        this.element.dispatchEvent(new CompositionEvent("compositionupdate", { data: block }));
        this.currentBlock = block;
    }

    endComposition (completed) {
        this.element.dispatchEvent(new CompositionEvent("compositionend", { data: completed }));
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
