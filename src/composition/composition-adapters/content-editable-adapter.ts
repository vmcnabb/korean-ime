import { CompositionAdapter } from "./composition-adapter";

export class ContentEditableAdapter extends CompositionAdapter {
    blur() {
        // Do nothing
    }

    beginComposition(text: string): void {
        this.updateComposition(text);
    }

    updateComposition(text: string) {
        const selection = this.element.ownerDocument.getSelection();

        if (!selection || selection.rangeCount === 0) {
            return; 
        }

        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode(text));
        selection.removeAllRanges();
        selection.addRange(range);
    }

    endComposition(text: string) {
        this.updateComposition(text);
        this.deselect();
    }

    deselect() {
        const selection = this.element.ownerDocument.getSelection();

        if (!selection || selection.rangeCount === 0) {
            return; 
        }

        const range = selection.getRangeAt(0);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
    }

    selectPreviousCharacter() {
        const selection = this.element.ownerDocument.getSelection();
        if (!selection) {
            return undefined;
        }

        const startOffset = selection.focusOffset;

        const isCaret = selection.type === "Caret";
        const isNotAtBeginning = startOffset > 0;
        const hasRange = selection.rangeCount > 0;

        if (!isCaret || !isNotAtBeginning || !hasRange || !selection.focusNode?.nodeValue) {
            return undefined;
        }

        const range = selection.getRangeAt(0);
        range.setStart(selection.focusNode, startOffset - 1);
        return selection.focusNode.nodeValue.substring(startOffset - 1, startOffset);
    }

    handleBackspace(): void {
        // todo: implement
    }
}
