import { KeyCode } from "src/content-script/on-screen-keyboard/korean-keyboard-map";
import { WordForTheWebAdapter } from "./word-for-the-web-adapter";

export class CkEditorAdapater extends WordForTheWebAdapter {
    inputCharacter(data: string, keyCode: KeyCode): void {
        this.beginComposition(data, keyCode);
        this.updateComposition(data, keyCode);
        this.endComposition(data);
    }
}
