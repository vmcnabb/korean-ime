import { trace } from "../../decorators/trace";
import { KeyCode } from "../../keyboard/korean-keyboard-map";
import { ContentEditableAdapter } from "./content-editable-adapter";
import { BeforeCaretTextRange } from "./composition-adapter-interface";

@trace
export class CkEditorAdapter extends ContentEditableAdapter {
    inputCharacter(data: string, keyCode: KeyCode): void {
        this._inputCharacter(data, keyCode, () => {});
    }

    deleteContentBackwards(): void {
        this._deleteContentBackwards(() => {});
    }

    replaceTextBeforeCaret(range: BeforeCaretTextRange, data: string): boolean {
        const target = this.createRangeBeforeCaret(range);
        const selection = window.getSelection();
        if (!target || !selection) {
            return false;
        }

        // CKEditor owns its model and applies the replacement from beforeinput.
        // Give it the intended DOM selection, matching the no-direct-mutation
        // approach used by inputCharacter/deleteContentBackwards above.
        selection.removeAllRanges();
        selection.addRange(target);
        this._replaceText(data, () => {});
        return true;
    }
}
