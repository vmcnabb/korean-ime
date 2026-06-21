import { ContentEditableAdapter } from "./content-editable-adapter";
import { KeyCode } from "../../keyboard/korean-keyboard-map";

function makeContentEditable(): HTMLElement {
    const element = document.createElement("div");
    Object.defineProperty(element, "isContentEditable", { value: true });
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

// The overlay box is the only element appended to <body> with the max z-index.
function compositingBox(): HTMLElement | undefined {
    return Array.from(document.body.children).find(
        (element): element is HTMLElement => element instanceof HTMLElement && element.style.zIndex === "2147483647"
    );
}

describe("ContentEditableAdapter compositing box", () => {
    beforeEach(() => {
        // jsdom has no layout: Range has no getBoundingClientRect at all, and the
        // box bails on a zero-sized glyph. Define one with a real size to exercise
        // the drawing path. After the block is inserted the caret lands in the
        // *element*, not a text node — the case that regressed and drew nothing.
        (Range.prototype as { getBoundingClientRect?: () => DOMRect }).getBoundingClientRect = () =>
            ({
                left: 5,
                top: 6,
                width: 10,
                height: 12,
                right: 15,
                bottom: 18,
                x: 5,
                y: 6,
                toJSON: () => ({}),
            }) as DOMRect;
    });

    afterEach(() => {
        document.body.innerHTML = "";
        window.getSelection()?.removeAllRanges();
        delete (Range.prototype as { getBoundingClientRect?: () => DOMRect }).getBoundingClientRect;
    });

    it("draws the overlay box over the composing block", () => {
        const element = makeContentEditable();
        placeCaretAtEnd(element);
        const adapter = new ContentEditableAdapter(element);

        adapter.beginComposition("한", KeyCode.KeyR);

        const box = compositingBox();
        expect(box).toBeDefined();
        expect(box?.textContent).toBe("한");
    });

    it("removes the overlay box when composition ends", () => {
        const element = makeContentEditable();
        placeCaretAtEnd(element);
        const adapter = new ContentEditableAdapter(element);

        adapter.beginComposition("한", KeyCode.KeyR);
        adapter.endComposition("韓");

        expect(compositingBox()).toBeUndefined();
    });

    it("measures the character immediately before the caret", () => {
        const element = makeContentEditable();
        element.textContent = "한";
        placeCaretAtEnd(element);
        const adapter = new ContentEditableAdapter(element);

        expect(adapter.getPreviousCharacterRect()).toEqual({ left: 5, top: 6, width: 10, height: 12 });
    });
});
