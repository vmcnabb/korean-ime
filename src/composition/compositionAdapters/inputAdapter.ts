"use strict";

import { CompositionAdapter } from "./compositionAdapter";

export class InputAdapter extends CompositionAdapter {
    constructor (protected element: HTMLInputElement) {
        super(element);
    }

    blur(): void {
        // do nothing
    }

    updateComposition (text: string) {
        const element = this.element;
        const start = element.selectionStart;

        if (start == null) {
            return;
        }

        let end = element.selectionEnd || 0;

        element.value = element.value.substring(0, start) +
            text +
            element.value.substring(end, element.value.length);
        end = start + text.length;
        element.selectionStart = start;
        element.selectionEnd = end;
    }

    deselect () {
        this.element.selectionStart = this.element.selectionEnd;
    }

    /**
     * @param {string} text 
     */
    endComposition (text: string) {
        this.updateComposition(text);
        this.deselect();
    }

    selectPreviousCharacter () {
        const element = this.element;
        const start = element.selectionStart || 0 - 1;
        const end = start + 1;

        if (start < 0) {
            return;
        }

        element.selectionStart = start;
        element.selectionEnd = end;
        return element.value.substring(start, end);
    }
}
