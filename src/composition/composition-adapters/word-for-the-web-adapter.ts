import { methodNotSupported } from "../../decorators/method-not-supported";
import { ContentEditableAdapter } from "./content-editable-adapter";

export class WordForTheWebAdapter extends ContentEditableAdapter {
    @methodNotSupported
    deleteContentBackwards() {
        // the implementation in ContentEditableAdapter almost works, but
        // doesn't handle various scenarios. It also can cause Word for the Web
        // to crash in those scenarios.
    }
}
