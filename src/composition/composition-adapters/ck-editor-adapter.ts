import { trace } from "../../decorators/trace";
import { KeyCode } from "../../keyboard/korean-keyboard-map";
import { ContentEditableAdapter } from "./content-editable-adapter";

@trace
export class CkEditorAdapter extends ContentEditableAdapter {
    inputCharacter(data: string, keyCode: KeyCode): void {
        this._inputCharacter(data, keyCode, () => {});
    }

    deleteContentBackwards(): void {
        this._deleteContentBackwards(() => {});
    }
}
