import { TextInputManager, textInputElementsSelector } from "./text-input-manager";
import { HangulImeController } from "../composition/hangul-ime-controller";
import { KeyCode } from "../keyboard/korean-keyboard-map";
import { macDefaultToggleKeyBinding } from "../keyboard/key-binding";
import { CompositionAdapterFactory } from "../composition/composition-adapter-factory";

jest.mock("../composition/hanja/hanja-candidate-window.scss", () => ({}), { virtual: true });

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

    it("disposes the current controller when focus moves to another editable", () => {
        const dispose = jest.spyOn(HangulImeController.prototype, "dispose");
        const manager = new TextInputManager();

        const first = document.createElement("textarea");
        const second = document.createElement("textarea");
        document.body.append(first, second);

        manager.setActiveElement(first);
        manager.setActiveElement(second);

        expect(dispose).toHaveBeenCalledTimes(1);
    });

    it("reuses the current controller when the same editable is reported twice", () => {
        const dispose = jest.spyOn(HangulImeController.prototype, "dispose");
        const manager = new TextInputManager();

        const textarea = document.createElement("textarea");
        document.body.appendChild(textarea);

        manager.setActiveElement(textarea);
        manager.setActiveElement(textarea);

        expect(dispose).not.toHaveBeenCalled();
    });

    it("disposes the current controller when focus leaves editable input", () => {
        const dispose = jest.spyOn(HangulImeController.prototype, "dispose");
        const manager = new TextInputManager();

        const textarea = document.createElement("textarea");
        const button = document.createElement("button");
        document.body.append(textarea, button);

        manager.setActiveElement(textarea);
        manager.setActiveElement(button);

        expect(dispose).toHaveBeenCalledTimes(1);
    });

    it("keeps only one window-capture keydown guard after replacing the controller", () => {
        const add = jest.spyOn(window, "addEventListener");
        const remove = jest.spyOn(window, "removeEventListener");
        const manager = new TextInputManager();

        const first = document.createElement("textarea");
        const second = document.createElement("textarea");
        document.body.append(first, second);

        manager.setActiveElement(first);
        manager.setActiveElement(second);

        const keydownCaptureAdds = add.mock.calls.filter(([type, _listener, capture]) => {
            return type === "keydown" && capture === true;
        });

        expect(keydownCaptureAdds).toHaveLength(2);
        expect(remove).toHaveBeenCalledWith("keydown", keydownCaptureAdds[0][1], true);
    });

    it("clears the current controller when the focused editable has no adapter", () => {
        const dispose = jest.spyOn(HangulImeController.prototype, "dispose");
        const createAdapter = jest.spyOn(CompositionAdapterFactory, "createCompositionAdapter");
        const manager = new TextInputManager();

        const textarea = document.createElement("textarea");
        const unsupported = element("<div contenteditable></div>");
        document.body.append(textarea, unsupported);

        manager.setActiveElement(textarea);
        createAdapter.mockReturnValueOnce(undefined);

        expect(manager.setActiveElement(unsupported)).toBeUndefined();
        expect(dispose).toHaveBeenCalledTimes(1);
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

    it("clears a stale controller when no editable element is focused", () => {
        const dispose = jest.spyOn(HangulImeController.prototype, "dispose");
        const manager = new TextInputManager();

        const textarea = document.createElement("textarea");
        document.body.appendChild(textarea);
        manager.setActiveElement(textarea);

        expect(manager.enterCharacter("a", KeyCode.KeyA)).toBe(false);
        expect(dispose).toHaveBeenCalledTimes(1);
    });

    it("creates a controller for the focused element and routes the character", () => {
        const addCharacter = jest.spyOn(HangulImeController.prototype, "addCharacter").mockImplementation(() => {});
        const manager = new TextInputManager();

        const input = document.createElement("input");
        document.body.appendChild(input);
        input.focus();

        // No setActiveElement call first: enterCharacter must create the
        // controller itself (via tryGetOrCreateController), not rely on a getter side effect.
        const handled = manager.enterCharacter("a", KeyCode.KeyA);

        expect(handled).toBe(true);
        expect(addCharacter).toHaveBeenCalledWith("a", KeyCode.KeyA);
    });

    it("replaces the controller with one for the focused element before routing the character", () => {
        const dispose = jest.spyOn(HangulImeController.prototype, "dispose");
        const addCharacter = jest.spyOn(HangulImeController.prototype, "addCharacter").mockImplementation(() => {});
        const manager = new TextInputManager();

        const first = document.createElement("textarea");
        const second = document.createElement("input");
        document.body.append(first, second);

        manager.setActiveElement(first);
        second.focus();

        const handled = manager.enterCharacter("a", KeyCode.KeyA);

        expect(handled).toBe(true);
        expect(dispose).toHaveBeenCalledTimes(1);
        expect(addCharacter).toHaveBeenCalledWith("a", KeyCode.KeyA);
    });
});

describe("TextInputManager.setToggleKeyBinding", () => {
    afterEach(() => {
        jest.restoreAllMocks();
        document.body.innerHTML = "";
    });

    it("forwards a binding change to the live controller", () => {
        const setToggleKeyBinding = jest.spyOn(HangulImeController.prototype, "setToggleKeyBinding");
        const manager = new TextInputManager();
        const textarea = document.createElement("textarea");
        document.body.appendChild(textarea);
        manager.setActiveElement(textarea); // creates the controller

        setToggleKeyBinding.mockClear();
        manager.setToggleKeyBinding(macDefaultToggleKeyBinding);

        expect(setToggleKeyBinding).toHaveBeenCalledWith(macDefaultToggleKeyBinding);
    });

    it("applies the current binding to a controller created later", () => {
        const setToggleKeyBinding = jest.spyOn(HangulImeController.prototype, "setToggleKeyBinding");
        const manager = new TextInputManager();
        manager.setToggleKeyBinding(macDefaultToggleKeyBinding); // no controller yet

        const textarea = document.createElement("textarea");
        document.body.appendChild(textarea);
        manager.setActiveElement(textarea); // controller created now

        expect(setToggleKeyBinding).toHaveBeenCalledWith(macDefaultToggleKeyBinding);
    });
});
