import { HangulImeController } from "./hangul-ime-controller";

function makeContentEditable(): HTMLElement {
    const element = document.createElement("div");
    // jsdom doesn't implement isContentEditable, so define it manually (same
    // approach as composition-adapter-factory.test.ts).
    Object.defineProperty(element, "isContentEditable", { value: true });
    return element;
}

describe("HangulImeController", () => {
    afterEach(() => jest.restoreAllMocks());

    it("dispose() removes the listeners it registered, including the one on document", () => {
        const element = makeContentEditable();
        const elementAdd = jest.spyOn(element, "addEventListener");
        const elementRemove = jest.spyOn(element, "removeEventListener");
        const documentAdd = jest.spyOn(document, "addEventListener");
        const documentRemove = jest.spyOn(document, "removeEventListener");

        const controller = new HangulImeController(element);

        // contenteditable routes mousedown to `document`; keydown/blur to the element
        const mousedownAdd = documentAdd.mock.calls.find(([type]) => type === "mousedown");
        expect(mousedownAdd).toBeDefined();
        expect(elementAdd.mock.calls.map(([type]) => type)).toEqual(expect.arrayContaining(["keydown", "blur"]));

        controller.dispose();

        // the document mousedown listener (the one that would otherwise leak) is
        // detached using the same reference that was attached
        const mousedownRemove = documentRemove.mock.calls.find(([type]) => type === "mousedown");
        expect(mousedownRemove).toBeDefined();
        expect(mousedownRemove![1]).toBe(mousedownAdd![1]);

        // the element listeners are removed too
        expect(elementRemove.mock.calls.map(([type]) => type)).toEqual(expect.arrayContaining(["keydown", "blur"]));
    });
});
