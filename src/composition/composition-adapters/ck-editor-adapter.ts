import { KeyCode } from "../../keyboard/korean-keyboard-map";
import { ContentEditableAdapter } from "./content-editable-adapter";

export class CkEditorAdapter extends ContentEditableAdapter {
    inputCharacter(data: string, keyCode: KeyCode): void {
        this.beginComposition(data, keyCode);
        this.updateComposition(data, keyCode);
        this.endComposition(data);
    }
}
