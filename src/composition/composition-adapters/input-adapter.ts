import { KeyCode } from "src/content-script/on-screen-keyboard/korean-keyboard-map";
import { CompositionAdapter } from "./composition-adapter";

export class InputAdapter extends CompositionAdapter {
    constructor(protected element: HTMLInputElement) {
        super(element);
    }

    blur(): void {
        // do nothing
    }

    beginComposition(text: string): void {
        this.updateComposition(text);
    }

    updateComposition(text: string) {
        const element = this.element;
        const start = element.selectionStart;

        if (start == null) {
            return;
        }

        let end = element.selectionEnd || 0;

        element.value =
            element.value.substring(0, start) +
            text +
            element.value.substring(end, element.value.length);
        end = start + text.length;
        element.selectionStart = start;
        element.selectionEnd = end;
    }

    /**
     * @param {string} text
     */
    endComposition(text: string) {
        this.updateComposition(text);
        this.collapseSelection();
    }

    inputCharacter(data: string, keyCode: KeyCode): void {
        super._inputCharacter(data, keyCode, () => {
            const element = this.element;
            const start = element.selectionStart;

            if (start == null) {
                return;
            }

            let end = element.selectionEnd || 0;

            element.value =
                element.value.substring(0, start) +
                data +
                element.value.substring(end, element.value.length);
            end = start + data.length;
            element.selectionStart = end;
            element.selectionEnd = end;
        });
    }

    collapseSelection(toStart?: boolean) {
        if (toStart) {
            this.element.selectionEnd = this.element.selectionStart;
        } else {
            this.element.selectionStart = this.element.selectionEnd;
        }
    }

    getPreviousCharacter() {
        const element = this.element;

        const start = (element.selectionStart || 0) - 1;
        const end = start + 1;

        if (start < 0) {
            return;
        }

        const returnVal = element.value.substring(start, end);
        return returnVal;
    }

    deleteContentBackwards() {
        const element = this.element;

        super._deleteContentBackwards(() => {
            if (
                element.selectionStart == null ||
                element.selectionEnd == null
            ) {
                return;
            }

            // If there is a selection, delete it
            if (element.selectionStart !== this.element.selectionEnd) {
                element.value =
                    this.element.value.substring(0, element.selectionStart) +
                    this.element.value.substring(
                        element.selectionEnd,
                        element.value.length
                    );
                element.selectionEnd = element.selectionStart;
                return;
            }

            // If there is no selection, delete the previous character
            const caretPos = element.selectionStart; // get the current caret position
            if (caretPos > 0) {
                // make sure the caret is not at the beginning of the input field
                const newVal =
                    element.value.slice(0, caretPos - 1) +
                    element.value.slice(caretPos); // remove the character preceding the caret
                element.value = newVal; // set the new value of the input field
                element.selectionStart = caretPos - 1; // set the caret position to the deleted character's position
                element.selectionEnd = caretPos - 1;
            }
        });
    }
}
