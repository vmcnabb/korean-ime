"use strict";

export class CompositionAdapterBase {
    /**
     * @param {HTMLElement} element 
     */
    constructor (element) {
        this.element = element;
    }

    /** call when focus has blurred from where the current character is being composited */
    blur() {}

    selectPreviousCharacter() {}

    /** @returns {EventTarget} */
    getListenerTarget(/** @type {string} */ eventType) {
        return this.element;
    }
}
