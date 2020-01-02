"use strict";

export class CompositionProxyBase {
    constructor (/** @type {HTMLElement} */ element) {
        this.element = element;
    }

    /** call when focus has blurred from where the current character is being composited */
    blur() {}

    selectPreviousCharacter() {}
}
