import { TextInputManager, textInputElementsSelector } from "./text-input-manager";
import { HangulImeController } from "../composition/hangul-ime-controller";
import { KeyCode } from "../keyboard/korean-keyboard-map";

function element(html: string): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = html;
    return wrapper.firstElementChild as HTMLElement;
}

describe("textInputElementsSelector", () => {
    // contenteditable is an enumerated attribute: a bare attribute, "" and
    // "true" (and "plaintext-only") all make the element editable.
    it.each([
        "<div contenteditable></div>",
        '<div contenteditable=""></div>',
        '<div contenteditable="true"></div>',
        '<div contenteditable="plaintext-only"></div>',
        "<textarea></textarea>",
        "<input />",
        '<input type="text" />',
        '<input type="search" />',
    ])("matches editable element %s", (html) => {
        expect(element(html).matches(textInputElementsSelector)).toBe(true);
    });

    it.each([
        '<div contenteditable="false"></div>',
        "<div></div>",
        '<input type="checkbox" />',
        '<input type="password" />',
        '<input type="radio" />',
        "<button></button>",
    ])("does not match non-text-input %s", (html) => {
        expect(element(html).matches(textInputElementsSelector)).toBe(false);
    });
});

describe("TextInputManager DOM-removal cleanup", () => {
    afterEach(() => jest.restoreAllMocks());

    it("disposes a controller when its element leaves the DOM", async () => {
        const dispose = jest.spyOn(HangulImeController.prototype, "dispose");
        const manager = new TextInputManager();

        const textarea = document.createElement("textarea");
        document.body.appendChild(textarea);
        manager.setActiveElement(textarea); // creates a controller + starts the observer

        textarea.remove();
        // MutationObserver callbacks run as microtasks; a macrotask tick lets it fire.
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(dispose).toHaveBeenCalledTimes(1);
    });
});

describe("TextInputManager.setActiveElement", () => {
    afterEach(() => {
        jest.restoreAllMocks();
        document.body.innerHTML = "";
    });

    // Firefox delivers focus events whose target is the `document` (or other
    // non-Element nodes) when focus enters the page/frame; those have no
    // `.matches`, so setActiveElement must not call it blindly. Regression for
    // "TypeError: element.matches is not a function".
    it.each([
        ["document", document],
        ["null", null],
    ])("returns undefined for a non-element focus target (%s)", (_label, target) => {
        const manager = new TextInputManager();

        expect(() => manager.setActiveElement(target)).not.toThrow();
        expect(manager.setActiveElement(target)).toBeUndefined();
    });

    it("returns undefined for a focused element that is not a text input", () => {
        const manager = new TextInputManager();
        const button = element("<button></button>");
        document.body.appendChild(button);

        expect(manager.setActiveElement(button)).toBeUndefined();
    });
});

describe("TextInputManager.enterCharacter", () => {
    afterEach(() => {
        jest.restoreAllMocks();
        document.body.innerHTML = "";
    });

    it("returns false when no editable element is focused", () => {
        const manager = new TextInputManager();

        expect(manager.enterCharacter("a", KeyCode.KeyA)).toBe(false);
    });

    it("creates a controller for the focused element and routes the character", () => {
        const addCharacter = jest.spyOn(HangulImeController.prototype, "addCharacter").mockImplementation(() => {});
        const manager = new TextInputManager();

        const input = document.createElement("input");
        document.body.appendChild(input);
        input.focus();

        // No setActiveElement call first: enterCharacter must create the
        // controller itself (via ensureController), not rely on a getter side effect.
        const handled = manager.enterCharacter("a", KeyCode.KeyA);

        expect(handled).toBe(true);
        expect(addCharacter).toHaveBeenCalledWith("a", KeyCode.KeyA);
    });
});
