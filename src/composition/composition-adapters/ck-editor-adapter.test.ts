import { CkEditorAdapter } from "./ck-editor-adapter";
import { KeyCode } from "../../keyboard/korean-keyboard-map";

function makeContentEditable(text: string): HTMLElement {
    const element = document.createElement("div");
    Object.defineProperty(element, "isContentEditable", { value: true });
    element.textContent = text;
    document.body.appendChild(element);
    return element;
}

function placeCaretAtEnd(element: HTMLElement) {
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
}

describe("CkEditorAdapter Hanja replacement", () => {
    afterEach(() => {
        document.body.innerHTML = "";
        window.getSelection()?.removeAllRanges();
        jest.restoreAllMocks();
    });

    // CKEditor reverts direct DOM writes, so we can't splice the run in place.
    // Instead we delete the whole run backwards (caret-local, which CKEditor
    // honours) and insert the converted text.
    // @trace proxies the instance, so spy on the prototype (as the KeyListener
    // suite does) rather than the instance.
    let deleteContentBackwards: jest.SpyInstance;
    let inputCharacter: jest.SpyInstance;

    beforeEach(() => {
        deleteContentBackwards = jest
            .spyOn(CkEditorAdapter.prototype, "deleteContentBackwards")
            .mockImplementation(() => {});
        inputCharacter = jest.spyOn(CkEditorAdapter.prototype, "inputCharacter").mockImplementation(() => {});
    });

    it("deletes the run one character at a time, then inserts the converted text", () => {
        const element = makeContentEditable("한국말");
        placeCaretAtEnd(element);
        const adapter = new CkEditorAdapter(element);

        expect(adapter.replaceTextBeforeCaret({ text: "한국말", offset: 0 }, "韓國말", KeyCode.Enter)).toBe(true);

        expect(deleteContentBackwards).toHaveBeenCalledTimes(3);
        expect(inputCharacter).toHaveBeenCalledWith("韓國말", KeyCode.Enter);
    });

    it("refuses to replace when the run is no longer before the caret", () => {
        const element = makeContentEditable("한국");
        placeCaretAtEnd(element);
        const adapter = new CkEditorAdapter(element);

        expect(adapter.replaceTextBeforeCaret({ text: "한국말", offset: 0 }, "韓國말", KeyCode.Enter)).toBe(false);

        expect(deleteContentBackwards).not.toHaveBeenCalled();
        expect(inputCharacter).not.toHaveBeenCalled();
    });
});
