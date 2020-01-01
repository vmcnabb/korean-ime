export class GoogleDocsProxy {
    constructor (element) {
        this.element = element;
        this.isCompositing = false;
        /** @type {string} */
        this.currentBlock = undefined;
    }

    reset () {
        this.element.dispatchEvent(new CompositionEvent("compositionend", { data: "" }));
        this.currentBlock = undefined;
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
}
