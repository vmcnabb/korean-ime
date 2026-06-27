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

    /**
     * CKEditor owns its model and reverts direct DOM writes, so splicing the run
     * in place fails — it discards our edit and re-applies the insert at its own
     * caret (which appended the Hanja beside the Hangul). It does, however, honour
     * edits made *at its caret*, which is exactly where the run sits: the committed
     * text immediately before the caret. So delete the whole run backwards and
     * insert the converted text — the same caret-local primitives single-syllable
     * conversion already used, just repeated for each character of the run.
     */
    replaceTextBeforeCaret(range: BeforeCaretTextRange, data: string, keyCode: KeyCode): boolean {
        const beforeCaret = this.getTextBeforeCaret();
        if (beforeCaret === undefined || !beforeCaret.endsWith(range.text)) {
            return false;
        }

        const runLength = [...range.text].length;
        for (let i = 0; i < runLength; i += 1) {
            this.deleteContentBackwards();
        }
        this.inputCharacter(data, keyCode);
        return true;
    }
}
