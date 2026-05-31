import { textInputElementsSelector } from "./text-input-manager";

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
