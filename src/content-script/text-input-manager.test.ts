import { TextInputManager, textInputElementsSelector } from "./text-input-manager";
import { HangulImeController } from "../composition/hangul-ime-controller";

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
