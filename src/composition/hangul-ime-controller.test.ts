import { HangulImeController } from "./hangul-ime-controller";
import { InputAdapter } from "./composition-adapters/input-adapter";
import { KeyCode } from "../keyboard/korean-keyboard-map";

function dispatchKeydown(target: EventTarget, code: string, key: string): KeyboardEvent {
    const event = new KeyboardEvent("keydown", { code, key, bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    return event;
}

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

describe("HangulImeController functional keys during composition", () => {
    afterEach(() => jest.restoreAllMocks());

    function activeControllerOnTextarea() {
        // Stub the adapter's DOM mutations so we can drive composition state in jsdom.
        jest.spyOn(InputAdapter.prototype, "beginComposition").mockImplementation(() => {});
        jest.spyOn(InputAdapter.prototype, "updateComposition").mockImplementation(() => {});
        const endComposition = jest.spyOn(InputAdapter.prototype, "endComposition").mockImplementation(() => {});

        const element = document.createElement("textarea");
        const controller = new HangulImeController(element);
        controller.activate();
        return { element, endComposition };
    }

    // Regression: while composing, Tab/Enter used to be inserted as the literal text
    // "Tab"/"Enter" (and their default action suppressed), because keyMap has label-only
    // entries for them and the handler fed event.key to inputCharacter.
    it("lets the browser handle Tab while composing, and commits the composition", () => {
        const { element, endComposition } = activeControllerOnTextarea();

        dispatchKeydown(element, "KeyR", "r"); // start composing ㄱ
        const tab = dispatchKeydown(element, "Tab", "Tab");

        expect(tab.defaultPrevented).toBe(false); // not swallowed → browser tabs away
        expect(endComposition).toHaveBeenCalled(); // in-progress block was committed
    });

    it("lets the browser handle Enter while composing", () => {
        const { element } = activeControllerOnTextarea();

        dispatchKeydown(element, "KeyR", "r");
        const enter = dispatchKeydown(element, "Enter", "Enter");

        expect(enter.defaultPrevented).toBe(false);
    });

    it("still intercepts jamo keys (preventDefault)", () => {
        const { element } = activeControllerOnTextarea();

        const r = dispatchKeydown(element, "KeyR", "r");

        expect(r.defaultPrevented).toBe(true);
    });
});

describe("HangulImeController flushes OSK-driven compositions while inactive", () => {
    afterEach(() => jest.restoreAllMocks());

    // Mirrors "Hangul typing disabled": the on-screen keyboard drives composition
    // through the public addJamo() path while the controller is inactive (the
    // physical keyboard stays Latin). A focus/caret change must still flush the
    // in-progress composition, otherwise the next OSK jamo attaches to the stale
    // block. (addJamo is the same entry point enterCharacter / the OSK uses; the
    // inactive keydown path is intentionally ignored, so we can't go via keydown.)
    function inactiveController() {
        jest.spyOn(InputAdapter.prototype, "beginComposition").mockImplementation(() => {});
        jest.spyOn(InputAdapter.prototype, "updateComposition").mockImplementation(() => {});
        jest.spyOn(InputAdapter.prototype, "endComposition").mockImplementation(() => {});
        const blur = jest.spyOn(InputAdapter.prototype, "blur");

        const element = document.createElement("textarea");
        const controller = new HangulImeController(element); // deliberately NOT activated
        return { element, controller, blur };
    }

    it("flushes an in-progress OSK composition on blur", () => {
        const { element, controller, blur } = inactiveController();

        controller.addJamo("ㅂ", KeyCode.KeyQ); // OSK-driven composition begins
        element.dispatchEvent(new FocusEvent("blur"));

        expect(blur).toHaveBeenCalled();
    });

    it("flushes an in-progress OSK composition on mousedown", () => {
        const { element, controller, blur } = inactiveController();

        controller.addJamo("ㅂ", KeyCode.KeyQ);
        element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));

        expect(blur).toHaveBeenCalled();
    });

    it("does nothing on blur when there is no composition", () => {
        const { element, blur } = inactiveController();

        element.dispatchEvent(new FocusEvent("blur"));

        expect(blur).not.toHaveBeenCalled();
    });
});
