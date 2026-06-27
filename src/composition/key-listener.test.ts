import { CompositionAdapterFactory } from "./composition-adapter-factory";
import { InputAdapter } from "./composition-adapters/input-adapter";
import { ContentEditableAdapter } from "./composition-adapters/content-editable-adapter";
import { HangulController } from "./hangul-controller";
import { HanjaCandidateController, HanjaImeOptions } from "./hanja/hanja-candidate-controller";
import { KeyListener } from "./key-listener";
import { KeyCode } from "../keyboard/korean-keyboard-map";
import { KeyBinding, defaultToggleKeyBinding, macDefaultToggleKeyBinding } from "../keyboard/key-binding";
import {
    HanjaDictionaryMatch,
    HanjaDictionaryProvider,
    StaticHanjaDictionaryProvider,
} from "./hanja/hanja-dictionary-provider";
import { HanjaCandidate } from "./hanja/hanja-candidate";
import { HANJA_CANDIDATE_WINDOW_SELECTOR } from "./hanja/hanja-candidate-window";

jest.mock("./hanja/hanja-candidate-window.scss", () => ({}), { virtual: true });

function dispatchKeydown(
    target: EventTarget,
    code: string,
    key: string,
    init: Omit<KeyboardEventInit, "code" | "key"> = {}
): KeyboardEvent {
    const event = new KeyboardEvent("keydown", { code, key, bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(event);
    return event;
}

function dispatchKeyup(
    target: EventTarget,
    code: string,
    key: string,
    init: Omit<KeyboardEventInit, "code" | "key"> = {}
): KeyboardEvent {
    const event = new KeyboardEvent("keyup", { code, key, bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(event);
    return event;
}

// Each KeyListener registers capture-phase key listeners on `window`. Tests
// don't route controllers through TextInputManager, so without cleanup a
// listener from one test keeps reacting to keystrokes dispatched by the next.
// Track every listener and dispose them all after each test to keep tests
// isolated.
const liveListeners: KeyListener[] = [];

function makeControllerFixture(
    element: HTMLElement,
    hanjaDictionaryProvider?: HanjaDictionaryProvider,
    hanjaOptions?: Partial<HanjaImeOptions>
): {
    hangul: HangulController;
    hanja: HanjaCandidateController;
    listener: KeyListener;
} {
    const compositionAdapter = CompositionAdapterFactory.createCompositionAdapter(element);
    if (!compositionAdapter) {
        throw new Error("Could not create composition adapter for test element");
    }

    const hangul = new HangulController(compositionAdapter);
    const hanja = new HanjaCandidateController(
        element,
        compositionAdapter,
        hanjaDictionaryProvider ?? new StaticHanjaDictionaryProvider(),
        () => {},
        hanjaOptions
    );
    if (!element.isConnected) {
        document.body.appendChild(element);
    }

    const listener = new KeyListener();
    listener.setActiveCompositionRoute(element, compositionAdapter, hangul, hanja);
    liveListeners.push(listener);
    return { hangul, hanja, listener };
}

function makeController(
    element: HTMLElement,
    hanjaDictionaryProvider?: HanjaDictionaryProvider,
    hanjaOptions?: Partial<HanjaImeOptions>
): HangulController {
    return makeControllerFixture(element, hanjaDictionaryProvider, hanjaOptions).hangul;
}
afterEach(() => {
    liveListeners.forEach((listener) => listener.dispose());
    liveListeners.length = 0;
    document.body.innerHTML = "";
});

function makeContentEditable(): HTMLElement {
    const element = document.createElement("div");
    // jsdom doesn't implement isContentEditable, so define it manually (same
    // approach as composition-adapter-factory.test.ts).
    Object.defineProperty(element, "isContentEditable", { value: true });
    return element;
}

describe("KeyListener", () => {
    afterEach(() => jest.restoreAllMocks());

    it("dispose() removes the listeners it registered, including the one on document", () => {
        const element = makeContentEditable();
        const elementAdd = jest.spyOn(element, "addEventListener");
        const elementRemove = jest.spyOn(element, "removeEventListener");
        const documentAdd = jest.spyOn(document, "addEventListener");
        const documentRemove = jest.spyOn(document, "removeEventListener");
        const windowAdd = jest.spyOn(window, "addEventListener");
        const windowRemove = jest.spyOn(window, "removeEventListener");

        const { listener } = makeControllerFixture(element);

        const keydownAdd = windowAdd.mock.calls.find(([type, _listener, capture]) => {
            return type === "keydown" && capture === true;
        });
        const keyupAdd = windowAdd.mock.calls.find(([type, _listener, capture]) => {
            return type === "keyup" && capture === true;
        });
        expect(keydownAdd).toBeDefined();
        expect(keyupAdd).toBeDefined();

        // contenteditable routes mousedown to `document`; blur to the element.
        // Physical keys stay on the frame-level window-capture dispatcher.
        const mousedownAdd = documentAdd.mock.calls.find(([type]) => type === "mousedown");
        expect(mousedownAdd).toBeDefined();
        expect(elementAdd.mock.calls.map(([type]) => type)).toEqual(expect.arrayContaining(["blur"]));
        expect(elementAdd.mock.calls.map(([type]) => type)).not.toContain("keydown");

        listener.dispose();

        expect(windowRemove).toHaveBeenCalledWith("keydown", keydownAdd![1], true);
        expect(windowRemove).toHaveBeenCalledWith("keyup", keyupAdd![1], true);

        // the document mousedown listener (the one that would otherwise leak) is
        // detached using the same reference that was attached
        const mousedownRemove = documentRemove.mock.calls.find(([type]) => type === "mousedown");
        expect(mousedownRemove).toBeDefined();
        expect(mousedownRemove![1]).toBe(mousedownAdd![1]);

        // the element blur listener is removed too
        expect(elementRemove.mock.calls.map(([type]) => type)).toEqual(expect.arrayContaining(["blur"]));
        expect(elementRemove.mock.calls.map(([type]) => type)).not.toContain("keydown");
    });

    it("runs an injected printable-combo toggle consumer before composition", () => {
        const beginComposition = jest.spyOn(InputAdapter.prototype, "beginComposition").mockImplementation(() => {});
        jest.spyOn(InputAdapter.prototype, "updateComposition").mockImplementation(() => {});
        jest.spyOn(InputAdapter.prototype, "endComposition").mockImplementation(() => {});

        const element = document.createElement("textarea");
        const { hangul, listener } = makeControllerFixture(element);
        hangul.activate();
        const toggleConsumer = jest.fn((event: KeyboardEvent) => {
            event.preventDefault();
            event.stopImmediatePropagation();
            return true;
        });
        const observer = jest.fn(() => false);
        listener.setToggleConsumers({ keydown: toggleConsumer });
        listener.setObserver("test", { keydown: observer });

        const event = new KeyboardEvent("keydown", {
            code: "KeyS",
            key: "s",
            altKey: true,
            bubbles: true,
            cancelable: true,
        });
        element.dispatchEvent(event);

        expect(toggleConsumer).toHaveBeenCalledWith(event);
        expect(beginComposition).not.toHaveBeenCalled();
        expect(event.defaultPrevented).toBe(true);
        expect(observer).toHaveBeenCalledWith(event);
    });
});

describe("KeyListener functional keys during composition", () => {
    afterEach(() => jest.restoreAllMocks());

    function activeControllerOnTextarea() {
        // Stub the adapter's DOM mutations so we can drive composition state in jsdom.
        jest.spyOn(InputAdapter.prototype, "beginComposition").mockImplementation(() => {});
        jest.spyOn(InputAdapter.prototype, "updateComposition").mockImplementation(() => {});
        const endComposition = jest.spyOn(InputAdapter.prototype, "endComposition").mockImplementation(() => {});

        const element = document.createElement("textarea");
        const controller = makeController(element);
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

describe("KeyListener lets Cmd/Ctrl shortcut chords through in Hangul mode", () => {
    afterEach(() => jest.restoreAllMocks());

    function activeControllerOnTextarea() {
        const beginComposition = jest.spyOn(InputAdapter.prototype, "beginComposition").mockImplementation(() => {});
        jest.spyOn(InputAdapter.prototype, "updateComposition").mockImplementation(() => {});
        jest.spyOn(InputAdapter.prototype, "endComposition").mockImplementation(() => {});

        const element = document.createElement("textarea");
        const controller = makeController(element);
        controller.activate();
        return { element, beginComposition };
    }

    // KeyC's jamo is ㅊ: without the fix this composed instead of triggering the
    // shortcut, swallowing the key.
    function pressC(element: HTMLElement, modifiers: { ctrlKey?: boolean; metaKey?: boolean }) {
        const event = new KeyboardEvent("keydown", {
            code: "KeyC",
            key: "c",
            bubbles: true,
            cancelable: true,
            ...modifiers,
        });
        element.dispatchEvent(event);
        return event;
    }

    // Regression (macOS): in Hangul mode, Cmd+C used to compose the jamo ㅊ instead of
    // copying, because the shortcut bypass only checked ctrlKey, not metaKey (Command).
    it("does not compose Cmd+C (metaKey) and lets it reach the browser", () => {
        const { element, beginComposition } = activeControllerOnTextarea();

        const event = pressC(element, { metaKey: true });

        expect(beginComposition).not.toHaveBeenCalled();
        expect(event.defaultPrevented).toBe(false);
    });

    // Ctrl shortcuts (Windows/Linux) keep working exactly as before.
    it("does not compose Ctrl+C (ctrlKey) and lets it reach the browser", () => {
        const { element, beginComposition } = activeControllerOnTextarea();

        const event = pressC(element, { ctrlKey: true });

        expect(beginComposition).not.toHaveBeenCalled();
        expect(event.defaultPrevented).toBe(false);
    });
});

describe("KeyListener treats a held toggle key as the IME key, not a modifier", () => {
    afterEach(() => jest.restoreAllMocks());

    function controllerOnTextarea(binding: KeyBinding | null) {
        const beginComposition = jest.spyOn(InputAdapter.prototype, "beginComposition").mockImplementation(() => {});
        jest.spyOn(InputAdapter.prototype, "updateComposition").mockImplementation(() => {});
        jest.spyOn(InputAdapter.prototype, "endComposition").mockImplementation(() => {});
        const inputCharacter = jest.spyOn(InputAdapter.prototype, "inputCharacter").mockImplementation(() => {});

        const element = document.createElement("textarea");
        const controller = makeController(element);
        controller.setToggleKeyBinding(binding);
        return { element, controller, beginComposition, inputCharacter };
    }

    // A bare modifier keydown: only its `code` is tracked (as the last modifier),
    // which is how the controller tells the toggle key from its other-side sibling.
    function pressModifier(element: HTMLElement, code: string) {
        element.dispatchEvent(new KeyboardEvent("keydown", { code, key: "Meta", bubbles: true, cancelable: true }));
    }

    // KeyC's jamo is ㅊ, so a successful compose is observable via beginComposition.
    function pressC(element: HTMLElement, modifiers: { ctrlKey?: boolean; altKey?: boolean; metaKey?: boolean }) {
        const event = new KeyboardEvent("keydown", {
            code: "KeyC",
            key: "c",
            bubbles: true,
            cancelable: true,
            ...modifiers,
        });
        element.dispatchEvent(event);
        return event;
    }

    // Inactive (English) + the Mac toggle (Right Command) held: it's the IME key, so
    // the letter is typed instead of letting Cmd+letter act as a shortcut/menu.
    it("inserts the letter literally when the Right Command toggle is held — inactive", () => {
        const { element, inputCharacter } = controllerOnTextarea(macDefaultToggleKeyBinding); // not activated

        pressModifier(element, "MetaRight");
        const event = pressC(element, { metaKey: true });

        expect(inputCharacter).toHaveBeenCalledWith("c", KeyCode.KeyC);
        expect(event.defaultPrevented).toBe(true);
    });

    // Active (Hangul) + the toggle held: it must compose the jamo, NOT be treated as a
    // Cmd shortcut (the companion to Part 1 — metaKey alone would otherwise pass through).
    it("composes the jamo when the Right Command toggle is held — active", () => {
        const { element, controller, beginComposition } = controllerOnTextarea(macDefaultToggleKeyBinding);
        controller.activate();

        pressModifier(element, "MetaRight");
        const event = pressC(element, { metaKey: true }); // KeyC → ㅊ

        expect(beginComposition).toHaveBeenCalledWith("ㅊ", KeyCode.KeyC);
        expect(event.defaultPrevented).toBe(true);
    });

    // The OTHER Command (Left) is a real modifier, so Cmd+C is a real shortcut and must
    // pass through — this is the actual reported bug's happy path.
    it("passes a real Cmd+C through when the held Command is not the toggle key — active", () => {
        const { element, controller, beginComposition } = controllerOnTextarea(macDefaultToggleKeyBinding);
        controller.activate();

        pressModifier(element, "MetaLeft");
        const event = pressC(element, { metaKey: true });

        expect(beginComposition).not.toHaveBeenCalled();
        expect(event.defaultPrevented).toBe(false);
    });

    // Regression: the default Right Alt toggle keeps its long-standing behavior.
    it("still inserts the letter when the default Right Alt toggle is held — inactive", () => {
        const { element, inputCharacter } = controllerOnTextarea(defaultToggleKeyBinding); // Right Alt

        pressModifier(element, "AltRight");
        const event = pressC(element, { altKey: true });

        expect(inputCharacter).toHaveBeenCalledWith("c", KeyCode.KeyC);
        expect(event.defaultPrevented).toBe(true);
    });

    // The flag check guards against a stale last-modifier: once the toggle key is
    // released, a plain letter is left to the browser.
    it("does not insert once the toggle key has been released — inactive", () => {
        const { element, inputCharacter } = controllerOnTextarea(macDefaultToggleKeyBinding);

        pressModifier(element, "MetaRight"); // pressed...
        const event = pressC(element, { metaKey: false }); // ...but no longer held

        expect(inputCharacter).not.toHaveBeenCalled();
        expect(event.defaultPrevented).toBe(false);
    });

    // With the toggle turned off, the key is an ordinary modifier again.
    it("does not insert when the toggle key is turned off (null)", () => {
        const { element, inputCharacter } = controllerOnTextarea(null);

        pressModifier(element, "MetaRight");
        const event = pressC(element, { metaKey: true });

        expect(inputCharacter).not.toHaveBeenCalled();
        expect(event.defaultPrevented).toBe(false);
    });
});

describe("KeyListener flushes OSK-driven compositions while inactive", () => {
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
        const controller = makeController(element); // deliberately NOT activated
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

    it("flushes an in-progress OSK composition when a physical key is pressed, and lets the key through", () => {
        const { element, controller, blur } = inactiveController();

        controller.addJamo("ㅂ", KeyCode.KeyQ); // OSK-driven composition begins
        const keydown = dispatchKeydown(element, "KeyS", "s"); // physical Latin key

        expect(blur).toHaveBeenCalled(); // Korean composition committed/cleared
        expect(keydown.defaultPrevented).toBe(false); // physical key still types Latin
    });

    it("does nothing on blur when there is no composition", () => {
        const { element, blur } = inactiveController();

        element.dispatchEvent(new FocusEvent("blur"));

        expect(blur).not.toHaveBeenCalled();
    });
});

describe("KeyListener intercepts Backspace during composition in the capture phase", () => {
    afterEach(() => {
        jest.restoreAllMocks();
        document.body.innerHTML = "";
    });

    // The element must be attached to the document so events propagate through the
    // window-capture listener (that's the whole point of the fix). Adapter DOM
    // mutations are stubbed so we can drive composition state in jsdom.
    function activeConnectedController() {
        jest.spyOn(InputAdapter.prototype, "beginComposition").mockImplementation(() => {});
        const updateComposition = jest.spyOn(InputAdapter.prototype, "updateComposition").mockImplementation(() => {});
        const endComposition = jest.spyOn(InputAdapter.prototype, "endComposition").mockImplementation(() => {});

        const element = document.createElement("textarea");
        document.body.appendChild(element);
        const controller = makeController(element);
        controller.activate();
        return { element, controller, updateComposition, endComposition };
    }

    // Regression (Word for the Web): rich editors delete the whole composing block in
    // their own capture-phase Backspace handler before our bubble handler runs. We
    // must intercept in the capture phase, recompose, and stop the event so it never
    // reaches the editor.
    it("recomposes the block and stops Backspace before it reaches the page", () => {
        const { element, updateComposition } = activeConnectedController();

        dispatchKeydown(element, "KeyR", "r"); // ㄱ
        dispatchKeydown(element, "KeyK", "k"); // 가

        // A page listener on the element stands in for the editor's own handler.
        let reachedPage = false;
        element.addEventListener("keydown", () => (reachedPage = true));

        const backspace = new KeyboardEvent("keydown", {
            code: "Backspace",
            key: "Backspace",
            bubbles: true,
            cancelable: true,
        });
        element.dispatchEvent(backspace);

        expect(updateComposition).toHaveBeenCalledWith("ㄱ", KeyCode.Backspace); // 가 → ㄱ
        expect(backspace.defaultPrevented).toBe(true); // key cancelled
        expect(reachedPage).toBe(false); // stopped in the capture phase, never reached the editor
    });

    // When the block empties, we fall back to the contenteditable "x" hack and let the
    // editor's own Backspace through — so the key must NOT be cancelled here.
    it("commits 'x' and lets Backspace through when the block becomes empty", () => {
        const { element, endComposition, updateComposition } = activeConnectedController();

        dispatchKeydown(element, "KeyR", "r"); // single jamo ㄱ

        const backspace = new KeyboardEvent("keydown", {
            code: "Backspace",
            key: "Backspace",
            bubbles: true,
            cancelable: true,
        });
        element.dispatchEvent(backspace);

        expect(endComposition).toHaveBeenCalledWith("x");
        expect(updateComposition).not.toHaveBeenCalled();
        expect(backspace.defaultPrevented).toBe(false); // editor's Backspace deletes the "x"
    });

    it("ignores Backspace when not composing (lets the editor handle it)", () => {
        const { element, updateComposition, endComposition } = activeConnectedController();

        const backspace = new KeyboardEvent("keydown", {
            code: "Backspace",
            key: "Backspace",
            bubbles: true,
            cancelable: true,
        });
        element.dispatchEvent(backspace);

        expect(updateComposition).not.toHaveBeenCalled();
        expect(endComposition).not.toHaveBeenCalled();
        expect(backspace.defaultPrevented).toBe(false);
    });
});

describe("KeyListener intercepts the first jamo over a selection in the capture phase", () => {
    afterEach(() => {
        jest.restoreAllMocks();
        document.body.innerHTML = "";
        document.getSelection()?.removeAllRanges();
    });

    function activeContentEditable(text: string) {
        const beginComposition = jest
            .spyOn(ContentEditableAdapter.prototype, "beginComposition")
            .mockImplementation(() => {});
        jest.spyOn(ContentEditableAdapter.prototype, "updateComposition").mockImplementation(() => {});
        jest.spyOn(ContentEditableAdapter.prototype, "endComposition").mockImplementation(() => {});

        const element = document.createElement("div");
        // jsdom doesn't implement isContentEditable; define it so the factory picks
        // the ContentEditableAdapter.
        Object.defineProperty(element, "isContentEditable", { value: true });
        element.textContent = text;
        document.body.appendChild(element);

        const controller = makeController(element);
        controller.activate();
        return { element, controller, beginComposition };
    }

    function selectWithin(node: Node, start: number, end: number) {
        const range = document.createRange();
        range.setStart(node, start);
        range.setEnd(node, end);
        const selection = document.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
    }

    function pressJamo(element: HTMLElement) {
        const keydown = new KeyboardEvent("keydown", { code: "KeyD", key: "d", bubbles: true, cancelable: true });
        element.dispatchEvent(keydown);
        return keydown;
    }

    // Regression (Word for the Web): with text selected, the editor replaces the
    // selection with the typed key's literal character in its capture-phase handler
    // before our bubble handler runs. We must begin composition in the capture phase
    // (which deletes the selection) and stop the key so the editor never sees it.
    it("begins composition and stops the key before it propagates past window-capture", () => {
        const { element, beginComposition } = activeContentEditable("Hello Anyeon.");
        selectWithin(element.firstChild as Node, 6, 12); // select "Anyeon"

        // A capture listener on <body> fires only if the event propagated past
        // window-capture — i.e. only if we did NOT intercept it there.
        let reachedBodyCapture = false;
        document.body.addEventListener("keydown", () => (reachedBodyCapture = true), true);

        const keydown = pressJamo(element); // "d" → ㅇ

        expect(beginComposition).toHaveBeenCalledWith("ㅇ", KeyCode.KeyD);
        expect(keydown.defaultPrevented).toBe(true);
        expect(reachedBodyCapture).toBe(false); // intercepted at window-capture, ahead of the editor
    });

    // With physical keys centralized, ordinary composition also runs from
    // window-capture; no-selection jamo still compose, just no longer through a
    // separate element bubble listener.
    it("handles a no-selection jamo in the window-capture dispatcher", () => {
        const { element, beginComposition } = activeContentEditable("Hello .");
        selectWithin(element.firstChild as Node, 6, 6); // collapsed caret, no selection

        let reachedBodyCapture = false;
        document.body.addEventListener("keydown", () => (reachedBodyCapture = true), true);

        const keydown = pressJamo(element);

        expect(beginComposition).toHaveBeenCalledWith("ㅇ", KeyCode.KeyD);
        expect(keydown.defaultPrevented).toBe(true);
        expect(reachedBodyCapture).toBe(false);
    });

    // Regression (macOS): Cmd+C over a selection must reach the browser so copy works.
    // The capture guard must NOT begin composition — otherwise it deletes the selection
    // and types the jamo ㅊ over it instead of copying.
    it("leaves a Cmd-chord over a selection to the browser (does not begin composition)", () => {
        const { element, beginComposition } = activeContentEditable("Hello Anyeon.");
        selectWithin(element.firstChild as Node, 6, 12); // select "Anyeon"

        let reachedBodyCapture = false;
        document.body.addEventListener("keydown", () => (reachedBodyCapture = true), true);

        const keydown = new KeyboardEvent("keydown", {
            code: "KeyC", // jamo ㅊ
            key: "c",
            metaKey: true,
            bubbles: true,
            cancelable: true,
        });
        element.dispatchEvent(keydown);

        expect(beginComposition).not.toHaveBeenCalled();
        expect(keydown.defaultPrevented).toBe(false);
        expect(reachedBodyCapture).toBe(true); // not intercepted at window-capture
    });
});

describe("KeyListener intercepts Shift+Backspace in the capture phase", () => {
    afterEach(() => {
        jest.restoreAllMocks();
        document.body.innerHTML = "";
    });

    function activeContentEditable(previousCharacter: string | undefined) {
        const getPreviousCharacter = jest
            .spyOn(ContentEditableAdapter.prototype, "getPreviousCharacter")
            .mockReturnValue(previousCharacter);
        const deleteContentBackwards = jest
            .spyOn(ContentEditableAdapter.prototype, "deleteContentBackwards")
            .mockImplementation(() => {});
        const beginComposition = jest
            .spyOn(ContentEditableAdapter.prototype, "beginComposition")
            .mockImplementation(() => {});

        const element = document.createElement("div");
        Object.defineProperty(element, "isContentEditable", { value: true });
        document.body.appendChild(element);

        const controller = makeController(element);
        controller.activate();
        return { element, controller, getPreviousCharacter, deleteContentBackwards, beginComposition };
    }

    function pressShiftBackspace(element: HTMLElement) {
        const keydown = new KeyboardEvent("keydown", {
            code: "Backspace",
            key: "Backspace",
            shiftKey: true,
            bubbles: true,
            cancelable: true,
        });
        element.dispatchEvent(keydown);
        return keydown;
    }

    // Regression (Word for the Web): the editor deletes the previous character in its
    // own capture-phase handler before our bubble handler can read it, so we'd lift
    // the character *before* it. Intercepting in the capture phase reads the correct
    // previous character (still present) and stops the editor's delete.
    it("lifts the still-present previous character and stops the key before the editor", () => {
        const { element, deleteContentBackwards, beginComposition } = activeContentEditable("녕");

        let reachedBodyCapture = false;
        document.body.addEventListener("keydown", () => (reachedBodyCapture = true), true);

        const keydown = pressShiftBackspace(element);

        expect(deleteContentBackwards).toHaveBeenCalled();
        expect(beginComposition).toHaveBeenCalledWith("녕", KeyCode.Backspace);
        expect(keydown.defaultPrevented).toBe(true);
        expect(reachedBodyCapture).toBe(false); // intercepted at window-capture, ahead of the editor
    });

    // If the previous character isn't composable Hangul, we do nothing and let the
    // editor handle Shift+Backspace as an ordinary delete.
    it("does not intercept when the previous character isn't composable Hangul", () => {
        const { element, beginComposition } = activeContentEditable("o");

        let reachedBodyCapture = false;
        document.body.addEventListener("keydown", () => (reachedBodyCapture = true), true);

        const keydown = pressShiftBackspace(element);

        expect(beginComposition).not.toHaveBeenCalled();
        expect(keydown.defaultPrevented).toBe(false);
        expect(reachedBodyCapture).toBe(true);
    });
});

describe("KeyListener Hanja candidate selection (KIME_ENABLE_HANJA)", () => {
    afterEach(() => {
        jest.restoreAllMocks();
        delete process.env.KIME_ENABLE_HANJA;
        document.body.innerHTML = "";
    });

    // Use real textarea mutations here: Hanja conversion now reads the committed
    // previous character through the adapter after KeyListener ends Hangul composition.
    function composingController(hanjaOptions?: Partial<HanjaImeOptions>) {
        const endComposition = jest.spyOn(InputAdapter.prototype, "endComposition");
        const replaceTextBeforeCaret = jest.spyOn(InputAdapter.prototype, "replaceTextBeforeCaret");

        const element = document.createElement("textarea");
        const { hangul: controller, hanja } = makeControllerFixture(element, undefined, hanjaOptions);
        controller.activate();
        return { element, controller, hanja, endComposition, replaceTextBeforeCaret };
    }

    function composeHan(element: HTMLElement) {
        dispatchKeydown(element, "KeyG", "g"); // ㅎ
        dispatchKeydown(element, "KeyK", "k"); // ㅏ → 하
        dispatchKeydown(element, "KeyS", "s"); // ㄴ → 한
    }

    function composeAn(element: HTMLElement) {
        dispatchKeydown(element, "KeyD", "d"); // ㅇ
        dispatchKeydown(element, "KeyK", "k"); // ㅏ → 아
        dispatchKeydown(element, "KeyS", "s"); // ㄴ → 안
    }

    function pressRightCtrl(element: HTMLElement) {
        return dispatchKeydown(element, "ControlRight", "Control");
    }

    function pressRightOption(element: HTMLElement) {
        return dispatchKeydown(element, "AltRight", "Alt");
    }

    async function settleHanjaLookup() {
        await Promise.resolve();
        await Promise.resolve();
    }

    function candidateTexts() {
        return Array.from(document.querySelectorAll<HTMLElement>(`${HANJA_CANDIDATE_WINDOW_SELECTOR} .candidate`)).map(
            (item) => {
                const number = item.querySelector("span:first-child")?.textContent;
                const hanja = item.querySelector(".can-hanja")?.textContent;
                return `${number}${hanja}`;
            }
        );
    }

    function candidateValues() {
        return Array.from(document.querySelectorAll<HTMLElement>(`${HANJA_CANDIDATE_WINDOW_SELECTOR} .candidate`)).map(
            (item) => item.querySelector(".can-hanja")?.textContent
        );
    }

    function activeCandidateValue() {
        return document.querySelector<HTMLElement>(
            `${HANJA_CANDIDATE_WINDOW_SELECTOR} .candidate[aria-selected="true"] .can-hanja`
        )?.textContent;
    }

    async function controllerAfterCommittedSyllable(
        reading: string,
        options: {
            hanjaOptions?: Partial<HanjaImeOptions>;
            provider?: HanjaDictionaryProvider;
        } = {}
    ) {
        const element = document.createElement("textarea");
        element.value = reading;
        element.selectionStart = reading.length;
        element.selectionEnd = reading.length;
        const controller = makeController(element, options.provider, options.hanjaOptions);
        controller.activate();
        pressRightCtrl(element);
        await settleHanjaLookup();
        return { element };
    }

    function simplifiedProvider(): HanjaDictionaryProvider {
        return new StaticHanjaDictionaryProvider(
            new Map([
                [
                    "한",
                    [
                        { hanja: "韓", korean: "나라 이름 한, 한나라 한", simplified: "韩", pinyin: "hán" },
                        { hanja: "寒", korean: "찰 한" },
                        { hanja: "漢", korean: "한수 한", simplified: "汉", pinyin: "hàn" },
                    ],
                ],
            ])
        );
    }

    function simplifiedValues() {
        return Array.from(
            document.querySelectorAll<HTMLElement>(`${HANJA_CANDIDATE_WINDOW_SELECTOR} .can-simplified`)
        ).map((item) => item.textContent);
    }

    function highlightedSimplifiedValues() {
        return Array.from(
            document.querySelectorAll<HTMLElement>(
                `${HANJA_CANDIDATE_WINDOW_SELECTOR} .can-simplified.is-selecting-simplified`
            )
        ).map((item) => item.textContent);
    }

    function clickNextPage() {
        document.querySelector<HTMLButtonElement>(`${HANJA_CANDIDATE_WINDOW_SELECTOR} .page-button.next`)?.click();
    }

    function clickPreviousPage() {
        document.querySelector<HTMLButtonElement>(`${HANJA_CANDIDATE_WINDOW_SELECTOR} .page-button.previous`)?.click();
    }

    function scrollCandidates(deltaY: number) {
        document
            .querySelector<HTMLElement>(HANJA_CANDIDATE_WINDOW_SELECTOR)
            ?.dispatchEvent(new WheelEvent("wheel", { deltaY, bubbles: true, cancelable: true }));
    }

    function clickCandidate(index: number) {
        document.querySelectorAll<HTMLElement>(`${HANJA_CANDIDATE_WINDOW_SELECTOR} .candidate`)[index].click();
    }

    function shiftClickCandidate(index: number) {
        document
            .querySelectorAll<HTMLElement>(`${HANJA_CANDIDATE_WINDOW_SELECTOR} .candidate`)
            [index].dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, shiftKey: true }));
    }

    it("shows candidates for a composing 한 and swallows the Hanja key when the flag is on", async () => {
        process.env.KIME_ENABLE_HANJA = "true";
        const { element, endComposition } = composingController();
        composeHan(element);

        const ctrl = pressRightCtrl(element);
        await settleHanjaLookup();

        expect(candidateTexts()).toEqual(["1韓", "2寒", "3恨"]);
        expect(endComposition).toHaveBeenCalledWith("한");
        expect(endComposition).not.toHaveBeenCalledWith("韓");
        expect(ctrl.defaultPrevented).toBe(true);
    });

    it("shows candidates for a composing 안", async () => {
        process.env.KIME_ENABLE_HANJA = "true";
        const { element } = composingController();
        composeAn(element);

        pressRightCtrl(element);
        await settleHanjaLookup();

        expect(candidateTexts()).toEqual(["1安", "2岸"]);
    });

    it("closes an open candidate list when the Hanja key is pressed again", async () => {
        process.env.KIME_ENABLE_HANJA = "true";
        const { element } = composingController();
        composeHan(element);
        pressRightCtrl(element);
        await settleHanjaLookup();

        const ctrl = pressRightCtrl(element);
        await settleHanjaLookup();

        expect(element.value).toBe("한");
        expect(document.querySelector(HANJA_CANDIDATE_WINDOW_SELECTOR)).toBeNull();
        expect(ctrl.defaultPrevented).toBe(true);
    });

    it("commits a composing candidate selected by number", async () => {
        process.env.KIME_ENABLE_HANJA = "true";
        const { element, replaceTextBeforeCaret } = composingController();
        composeHan(element);
        pressRightCtrl(element);
        await settleHanjaLookup();

        const digit = dispatchKeydown(element, "Digit2", "2");

        expect(replaceTextBeforeCaret).toHaveBeenCalledWith({ text: "한", offset: 0 }, "寒", KeyCode.Digit2);
        expect(element.value).toBe("寒");
        expect(document.querySelector(HANJA_CANDIDATE_WINDOW_SELECTOR)).toBeNull();
        expect(digit.defaultPrevented).toBe(true);
    });

    it("commits the active composing candidate with Down and Enter", async () => {
        process.env.KIME_ENABLE_HANJA = "true";
        const { element, replaceTextBeforeCaret } = composingController();
        composeHan(element);
        pressRightCtrl(element);
        await settleHanjaLookup();

        const arrow = dispatchKeydown(element, "ArrowDown", "ArrowDown");
        const enter = dispatchKeydown(element, "Enter", "Enter");

        expect(replaceTextBeforeCaret).toHaveBeenCalledWith({ text: "한", offset: 0 }, "寒", KeyCode.Enter);
        expect(arrow.defaultPrevented).toBe(true);
        expect(enter.defaultPrevented).toBe(true);
    });

    it("closes the candidate list on Escape without committing", async () => {
        process.env.KIME_ENABLE_HANJA = "true";
        const { element, endComposition } = composingController();
        composeHan(element);
        pressRightCtrl(element);
        await settleHanjaLookup();

        const escape = dispatchKeydown(element, "Escape", "Escape");

        expect(endComposition).not.toHaveBeenCalledWith(expect.stringMatching(/[韓寒恨]/));
        expect(endComposition).toHaveBeenCalledWith("한");
        expect(document.querySelector(HANJA_CANDIDATE_WINDOW_SELECTOR)).toBeNull();
        expect(escape.defaultPrevented).toBe(true);
    });

    it("closes the candidate list on Backspace without deleting or committing", async () => {
        process.env.KIME_ENABLE_HANJA = "true";
        const { element, replaceTextBeforeCaret } = composingController();
        composeHan(element);
        pressRightCtrl(element);
        await settleHanjaLookup();

        replaceTextBeforeCaret.mockClear();
        const backspace = dispatchKeydown(element, "Backspace", "Backspace");

        expect(replaceTextBeforeCaret).not.toHaveBeenCalled();
        expect(document.querySelector(HANJA_CANDIDATE_WINDOW_SELECTOR)).toBeNull();
        expect(backspace.defaultPrevented).toBe(true);
    });

    it("closes the candidate list on Delete without deleting or committing", async () => {
        process.env.KIME_ENABLE_HANJA = "true";
        const { element, replaceTextBeforeCaret } = composingController();
        composeHan(element);
        pressRightCtrl(element);
        await settleHanjaLookup();

        replaceTextBeforeCaret.mockClear();
        const del = dispatchKeydown(element, "Delete", "Delete");

        expect(replaceTextBeforeCaret).not.toHaveBeenCalled();
        expect(document.querySelector(HANJA_CANDIDATE_WINDOW_SELECTOR)).toBeNull();
        expect(del.defaultPrevented).toBe(true);
    });

    it("selects candidates after a committed syllable", async () => {
        process.env.KIME_ENABLE_HANJA = "true";
        const { element } = await controllerAfterCommittedSyllable("한");

        dispatchKeydown(element, "Digit3", "3");

        expect(element.value).toBe("恨");
        expect(document.querySelector(HANJA_CANDIDATE_WINDOW_SELECTOR)).toBeNull();
    });

    it("highlights simplified forms while either Shift key is held", async () => {
        process.env.KIME_ENABLE_HANJA = "true";
        const { element } = await controllerAfterCommittedSyllable("한", { provider: simplifiedProvider() });

        expect(simplifiedValues()).toEqual(["韩", "", "汉"]);
        expect(highlightedSimplifiedValues()).toEqual([]);

        const leftDown = dispatchKeydown(element, "ShiftLeft", "Shift", { shiftKey: true });
        const rightDown = dispatchKeydown(element, "ShiftRight", "Shift", { shiftKey: true });
        const leftUp = dispatchKeyup(element, "ShiftLeft", "Shift", { shiftKey: true });

        expect(highlightedSimplifiedValues()).toEqual(["韩", "汉"]);

        const rightUp = dispatchKeyup(element, "ShiftRight", "Shift", { shiftKey: false });

        expect(highlightedSimplifiedValues()).toEqual([]);
        expect(leftDown.defaultPrevented).toBe(true);
        expect(rightDown.defaultPrevented).toBe(true);
        expect(leftUp.defaultPrevented).toBe(true);
        expect(rightUp.defaultPrevented).toBe(true);
    });

    it("commits the simplified form when a numbered candidate is chosen while Shift is down", async () => {
        process.env.KIME_ENABLE_HANJA = "true";
        const { element } = await controllerAfterCommittedSyllable("한", { provider: simplifiedProvider() });

        const digit = dispatchKeydown(element, "Digit1", "!", { shiftKey: true });

        expect(element.value).toBe("韩");
        expect(document.querySelector(HANJA_CANDIDATE_WINDOW_SELECTOR)).toBeNull();
        expect(digit.defaultPrevented).toBe(true);
    });

    it("selects by physical number-row position when the host layout reports a symbol", async () => {
        process.env.KIME_ENABLE_HANJA = "true";
        const { element } = await controllerAfterCommittedSyllable("한", { provider: simplifiedProvider() });

        const digit = dispatchKeydown(element, "Digit1", "&");

        expect(element.value).toBe("韓");
        expect(document.querySelector(HANJA_CANDIDATE_WINDOW_SELECTOR)).toBeNull();
        expect(digit.defaultPrevented).toBe(true);
    });

    it("commits the simplified form with Enter while Shift is held", async () => {
        process.env.KIME_ENABLE_HANJA = "true";
        const { element } = await controllerAfterCommittedSyllable("한", { provider: simplifiedProvider() });

        dispatchKeydown(element, "ShiftLeft", "Shift", { shiftKey: true });
        const enter = dispatchKeydown(element, "Enter", "Enter", { shiftKey: true });

        expect(element.value).toBe("韩");
        expect(document.querySelector(HANJA_CANDIDATE_WINDOW_SELECTOR)).toBeNull();
        expect(enter.defaultPrevented).toBe(true);
    });

    it("commits the normal form with a number after Shift is released", async () => {
        process.env.KIME_ENABLE_HANJA = "true";
        const { element } = await controllerAfterCommittedSyllable("한", { provider: simplifiedProvider() });

        dispatchKeydown(element, "ShiftLeft", "Shift", { shiftKey: true });
        dispatchKeyup(element, "ShiftLeft", "Shift", { shiftKey: false });
        const digit = dispatchKeydown(element, "Digit1", "1");

        expect(element.value).toBe("韓");
        expect(document.querySelector(HANJA_CANDIDATE_WINDOW_SELECTOR)).toBeNull();
        expect(digit.defaultPrevented).toBe(true);
    });

    it("falls back to normal Hanja when a shifted candidate has no simplified form", async () => {
        process.env.KIME_ENABLE_HANJA = "true";
        const { element } = await controllerAfterCommittedSyllable("한", { provider: simplifiedProvider() });

        dispatchKeydown(element, "Digit2", "@", { shiftKey: true });

        expect(element.value).toBe("寒");
    });

    it("does not select simplified forms when simplified display is disabled", async () => {
        process.env.KIME_ENABLE_HANJA = "true";
        const { element } = await controllerAfterCommittedSyllable("한", {
            hanjaOptions: { showSimplified: false },
            provider: simplifiedProvider(),
        });

        expect(simplifiedValues()).toEqual([]);
        dispatchKeydown(element, "ShiftLeft", "Shift", { shiftKey: true });
        expect(highlightedSimplifiedValues()).toEqual([]);
        dispatchKeydown(element, "Digit1", "!", { shiftKey: true });

        expect(element.value).toBe("韓");
    });

    it("commits the simplified form when a candidate is shift-clicked", async () => {
        process.env.KIME_ENABLE_HANJA = "true";
        const { element } = await controllerAfterCommittedSyllable("한", { provider: simplifiedProvider() });

        shiftClickCandidate(2);

        expect(element.value).toBe("汉");
        expect(document.querySelector(HANJA_CANDIDATE_WINDOW_SELECTOR)).toBeNull();
    });

    // Hanja conversion is independent of Han/Yong mode: it must work on a preceding
    // Hangul syllable even when the controller is inactive (영 mode, or our Hangul
    // typing disabled while the OS IME supplies the Hangul).
    it("opens candidates and commits while inactive", async () => {
        process.env.KIME_ENABLE_HANJA = "true";
        const element = document.createElement("textarea");
        element.value = "한";
        element.selectionStart = element.selectionEnd = 1;
        const controller = makeController(element); // deliberately NOT activated
        expect(controller.isActive).toBe(false);

        pressRightCtrl(element);
        await settleHanjaLookup();

        expect(candidateValues()).toEqual(["韓", "寒", "恨"]);

        dispatchKeydown(element, "Digit1", "1");
        expect(element.value).toBe("韓");
    });

    // Deliberate behaviour (#206): incidental focus loss must not dismiss an open
    // candidate window — only a mousedown / focus change / mode toggle / disposal does.
    it("keeps an open candidate window open on blur", async () => {
        process.env.KIME_ENABLE_HANJA = "true";
        const element = document.createElement("textarea");
        element.value = "한";
        element.selectionStart = element.selectionEnd = 1;
        makeController(element);

        pressRightCtrl(element);
        await settleHanjaLookup();
        expect(document.querySelector(HANJA_CANDIDATE_WINDOW_SELECTOR)).not.toBeNull();

        element.dispatchEvent(new FocusEvent("blur"));

        expect(document.querySelector(HANJA_CANDIDATE_WINDOW_SELECTOR)).not.toBeNull();
    });

    it("does not route candidate keys after the active composition route is cleared", async () => {
        process.env.KIME_ENABLE_HANJA = "true";
        const element = document.createElement("textarea");
        element.value = "한";
        element.selectionStart = element.selectionEnd = 1;
        const { hangul, hanja, listener } = makeControllerFixture(element);

        pressRightCtrl(element);
        await settleHanjaLookup();
        expect(document.querySelector(HANJA_CANDIDATE_WINDOW_SELECTOR)).not.toBeNull();

        const handleKey = jest.spyOn(hanja, "handleKey");
        listener.clearActiveCompositionRoute();
        hangul.dispose();

        const digit = dispatchKeydown(element, "Digit1", "1");

        expect(handleKey).not.toHaveBeenCalled();
        expect(digit.defaultPrevented).toBe(false);
    });

    // The candidate window can be open while inactive, so candidate keys must be
    // intercepted in the capture phase (ahead of a rich editor) regardless of mode —
    // not just by the bubble handler. A body capture listener fires only if the
    // event got past window-capture.
    it("intercepts candidate keys in the capture phase while inactive", async () => {
        process.env.KIME_ENABLE_HANJA = "true";
        const element = document.createElement("textarea");
        element.value = "한";
        element.selectionStart = element.selectionEnd = 1;
        document.body.appendChild(element); // connected so the window-capture guard runs
        const controller = makeController(element); // deliberately NOT activated
        expect(controller.isActive).toBe(false);

        pressRightCtrl(element);
        await settleHanjaLookup();
        expect(document.querySelector(HANJA_CANDIDATE_WINDOW_SELECTOR)).not.toBeNull();

        let reachedBodyCapture = false;
        document.body.addEventListener("keydown", () => (reachedBodyCapture = true), true);

        const arrow = new KeyboardEvent("keydown", {
            code: "ArrowDown",
            key: "ArrowDown",
            bubbles: true,
            cancelable: true,
        });
        element.dispatchEvent(arrow);

        expect(arrow.defaultPrevented).toBe(true); // handled
        expect(reachedBodyCapture).toBe(false); // intercepted at window-capture, not left to the editor
    });

    // The active-state guard was dropped, but staleness must still hold: a mode
    // change mid-lookup bumps the lookup generation, so the resolved window is
    // discarded rather than shown late.
    it("does not open a stale candidate window when the mode changes mid-lookup", async () => {
        process.env.KIME_ENABLE_HANJA = "true";
        const { element, controller, hanja } = composingController();
        composeHan(element);

        pressRightCtrl(element); // starts the async lookup
        hanja.cancelPendingLookup(); // mode change bumps the lookup generation
        hanja.close();
        controller.deactivate();
        await settleHanjaLookup();

        expect(document.querySelector(HANJA_CANDIDATE_WINDOW_SELECTOR)).toBeNull();
    });

    it("shows a maxed one-page candidate list without a usable next page", async () => {
        process.env.KIME_ENABLE_HANJA = "true";
        const { element } = await controllerAfterCommittedSyllable("가");

        expect(candidateValues()).toHaveLength(9);

        dispatchKeydown(element, "ArrowRight", "ArrowRight");

        expect(candidateValues()).toEqual(["家", "加", "可", "假", "價", "佳", "街", "歌", "架"]);
    });

    it("wraps pages with Left and Right instead of moving between candidates", async () => {
        process.env.KIME_ENABLE_HANJA = "true";
        const { element } = await controllerAfterCommittedSyllable("나");

        expect(activeCandidateValue()).toBe("羅");

        dispatchKeydown(element, "ArrowLeft", "ArrowLeft");
        expect(candidateValues()).toEqual(["儺"]);
        expect(activeCandidateValue()).toBe("儺");

        dispatchKeydown(element, "ArrowRight", "ArrowRight");
        expect(candidateValues()).toEqual(["羅", "那", "裸", "懶", "螺", "拿", "娜", "拏", "糯"]);
        expect(activeCandidateValue()).toBe("羅");

        dispatchKeydown(element, "ArrowRight", "ArrowRight");
        expect(candidateValues()).toEqual(["儺"]);

        dispatchKeydown(element, "ArrowRight", "ArrowRight");
        expect(candidateValues()).toEqual(["羅", "那", "裸", "懶", "螺", "拿", "娜", "拏", "糯"]);
    });

    it("commits a numbered candidate from the visible page", async () => {
        process.env.KIME_ENABLE_HANJA = "true";
        const { element } = await controllerAfterCommittedSyllable("나");

        dispatchKeydown(element, "ArrowRight", "ArrowRight");
        dispatchKeydown(element, "Digit1", "1");

        expect(element.value).toBe("儺");
    });

    it("moves Up from the first entry on a page to the last entry on the previous page", async () => {
        process.env.KIME_ENABLE_HANJA = "true";
        const { element } = await controllerAfterCommittedSyllable("나");

        dispatchKeydown(element, "ArrowRight", "ArrowRight");
        dispatchKeydown(element, "ArrowUp", "ArrowUp");

        expect(candidateValues()).toEqual(["羅", "那", "裸", "懶", "螺", "拿", "娜", "拏", "糯"]);
        expect(activeCandidateValue()).toBe("糯");
    });

    it("moves Down from the last entry on a page to the first entry on the next page", async () => {
        process.env.KIME_ENABLE_HANJA = "true";
        const { element } = await controllerAfterCommittedSyllable("나");

        for (let i = 0; i < 9; i += 1) {
            dispatchKeydown(element, "ArrowDown", "ArrowDown");
        }

        expect(candidateValues()).toEqual(["儺"]);
        expect(activeCandidateValue()).toBe("儺");
    });

    it("supports a maxed second page and a third page", async () => {
        process.env.KIME_ENABLE_HANJA = "true";
        const { element } = await controllerAfterCommittedSyllable("다");

        dispatchKeydown(element, "ArrowRight", "ArrowRight");
        expect(candidateValues()).toHaveLength(9);
        dispatchKeydown(element, "Escape", "Escape");

        const thirdPage = await controllerAfterCommittedSyllable("라");
        dispatchKeydown(thirdPage.element, "ArrowRight", "ArrowRight");
        dispatchKeydown(thirdPage.element, "ArrowRight", "ArrowRight");
        expect(candidateValues()).toEqual(["籮"]);
    });

    it("moves between pages two and three with Down and Up", async () => {
        process.env.KIME_ENABLE_HANJA = "true";
        const { element } = await controllerAfterCommittedSyllable("라");

        dispatchKeydown(element, "ArrowRight", "ArrowRight");
        for (let i = 0; i < 9; i += 1) {
            dispatchKeydown(element, "ArrowDown", "ArrowDown");
        }

        expect(candidateValues()).toEqual(["籮"]);
        expect(activeCandidateValue()).toBe("籮");

        dispatchKeydown(element, "ArrowUp", "ArrowUp");

        expect(candidateValues()).toEqual(["瘰", "臝", "騾", "驘", "囉", "砢", "摞", "欏", "玀"]);
        expect(activeCandidateValue()).toBe("玀");
    });

    it("wraps Up from the first item on the first page to the last item on the last page", async () => {
        process.env.KIME_ENABLE_HANJA = "true";
        const { element } = await controllerAfterCommittedSyllable("라");

        dispatchKeydown(element, "ArrowUp", "ArrowUp");

        expect(candidateValues()).toEqual(["籮"]);
        expect(activeCandidateValue()).toBe("籮");
    });

    it("wraps Down from the last item on the last page to the first item on the first page", async () => {
        process.env.KIME_ENABLE_HANJA = "true";
        const { element } = await controllerAfterCommittedSyllable("라");

        dispatchKeydown(element, "ArrowLeft", "ArrowLeft");
        dispatchKeydown(element, "ArrowDown", "ArrowDown");

        expect(candidateValues()).toEqual(["羅", "螺", "裸", "懶", "邏", "鑼", "喇", "蘿", "癩"]);
        expect(activeCandidateValue()).toBe("羅");
    });

    it("wraps pages with mouse buttons", async () => {
        process.env.KIME_ENABLE_HANJA = "true";
        await controllerAfterCommittedSyllable("나");

        clickPreviousPage();
        expect(candidateValues()).toEqual(["儺"]);

        clickNextPage();
        expect(candidateValues()).toEqual(["羅", "那", "裸", "懶", "螺", "拿", "娜", "拏", "糯"]);

        clickNextPage();
        expect(candidateValues()).toEqual(["儺"]);

        clickNextPage();
        expect(candidateValues()).toEqual(["羅", "那", "裸", "懶", "螺", "拿", "娜", "拏", "糯"]);
    });

    it("moves selection with mouse wheel scrolling", async () => {
        process.env.KIME_ENABLE_HANJA = "true";
        await controllerAfterCommittedSyllable("한");

        scrollCandidates(100);
        expect(activeCandidateValue()).toBe("寒");

        scrollCandidates(-100);
        expect(activeCandidateValue()).toBe("韓");
    });

    it("commits a clicked candidate from the visible page", async () => {
        process.env.KIME_ENABLE_HANJA = "true";
        const { element } = await controllerAfterCommittedSyllable("나");

        dispatchKeydown(element, "ArrowRight", "ArrowRight");
        clickCandidate(0);

        expect(element.value).toBe("儺");
        expect(document.querySelector(HANJA_CANDIDATE_WINDOW_SELECTOR)).toBeNull();
    });

    it("uses Right Option as the Hanja key on macOS", async () => {
        jest.spyOn(window.navigator, "platform", "get").mockReturnValue("MacIntel");
        process.env.KIME_ENABLE_HANJA = "true";
        const { element } = composingController();
        composeHan(element);

        const option = pressRightOption(element);
        await settleHanjaLookup();

        expect(candidateTexts()).toEqual(["1韓", "2寒", "3恨"]);
        expect(option.defaultPrevented).toBe(true);
    });

    it("does not open candidates when Hanja conversion is disabled", async () => {
        process.env.KIME_ENABLE_HANJA = "true";
        const { element, endComposition } = composingController({ enabled: false });
        composeHan(element);

        const ctrl = pressRightCtrl(element);
        await settleHanjaLookup();

        expect(endComposition).not.toHaveBeenCalledWith("한");
        expect(document.querySelector(HANJA_CANDIDATE_WINDOW_SELECTOR)).toBeNull();
        expect(ctrl.defaultPrevented).toBe(false);
    });

    it("uses a configured Hanja key binding", async () => {
        process.env.KIME_ENABLE_HANJA = "true";
        const { element } = composingController({
            keyBinding: { code: KeyCode.KeyH, ctrl: false, alt: true, shift: false, meta: false },
        });
        composeHan(element);

        const rightCtrl = pressRightCtrl(element);
        const altH = new KeyboardEvent("keydown", {
            code: "KeyH",
            key: "h",
            altKey: true,
            bubbles: true,
            cancelable: true,
        });
        element.dispatchEvent(altH);
        await settleHanjaLookup();

        expect(rightCtrl.defaultPrevented).toBe(false);
        expect(candidateTexts()).toEqual(["1韓", "2寒", "3恨"]);
        expect(altH.defaultPrevented).toBe(true);
    });

    it("does nothing when the flag is off (Right-Ctrl is just a modifier)", () => {
        const { element, endComposition } = composingController(); // flag unset
        composeHan(element);

        const ctrl = pressRightCtrl(element);

        expect(endComposition).not.toHaveBeenCalled();
        expect(document.querySelector(HANJA_CANDIDATE_WINDOW_SELECTOR)).toBeNull();
        expect(ctrl.defaultPrevented).toBe(false);
    });

    it("converts the leftmost-longest word and preserves trailing Hangul", async () => {
        process.env.KIME_ENABLE_HANJA = "true";
        const provider = new StaticHanjaDictionaryProvider(
            new Map([
                [
                    "한국",
                    [
                        { hanja: "寒國", korean: "" },
                        { hanja: "韓國", korean: "대한민국" },
                    ],
                ],
                ["중국", [{ hanja: "中國", korean: "" }]],
                ["한", [{ hanja: "韓", korean: "" }]],
            ])
        );
        const element = document.createElement("textarea");
        element.value = "한국중국";
        element.selectionStart = element.selectionEnd = element.value.length;
        makeController(element, provider);

        pressRightCtrl(element);
        await settleHanjaLookup();

        expect(candidateValues()).toEqual(["寒國", "韓國"]);
        dispatchKeydown(element, "Digit2", "2");
        expect(element.value).toBe("韓國중국");
        expect(element.selectionStart).toBe(4);
    });

    it("preserves the logical caret after an unequal-length word conversion", async () => {
        process.env.KIME_ENABLE_HANJA = "true";
        const provider = new StaticHanjaDictionaryProvider(new Map([["가가와현", [{ hanja: "香川縣", korean: "" }]]]));
        const element = document.createElement("textarea");
        element.value = "가가와현은";
        element.selectionStart = element.selectionEnd = element.value.length;
        makeController(element, provider);

        pressRightCtrl(element);
        await settleHanjaLookup();
        dispatchKeydown(element, "Digit1", "1");

        expect(element.value).toBe("香川縣은");
        expect(element.selectionStart).toBe(4);
        expect(element.selectionEnd).toBe(4);
    });

    it("converts dictionary entries containing compatibility Jamo", async () => {
        process.env.KIME_ENABLE_HANJA = "true";
        const provider = new StaticHanjaDictionaryProvider(new Map([["ㄱㄴ순", [{ hanja: "ㄱㄴ順", korean: "" }]]]));
        const element = document.createElement("textarea");
        element.value = "ㄱㄴ순";
        element.selectionStart = element.selectionEnd = element.value.length;
        makeController(element, provider);

        pressRightCtrl(element);
        await settleHanjaLookup();
        dispatchKeydown(element, "Digit1", "1");

        expect(element.value).toBe("ㄱㄴ順");
    });

    it("commits a composing syllable and shows no candidates when the lookup is empty", async () => {
        process.env.KIME_ENABLE_HANJA = "true";
        const { element, endComposition } = composingController();
        dispatchKeydown(element, "KeyR", "r"); // ㄱ
        dispatchKeydown(element, "KeyM", "m"); // ㅡ → 그
        dispatchKeydown(element, "KeyF", "f"); // ㄹ → 글

        const ctrl = pressRightCtrl(element);
        await settleHanjaLookup();

        expect(endComposition).toHaveBeenCalledWith("글");
        expect(element.value).toBe("글");
        expect(document.querySelector(HANJA_CANDIDATE_WINDOW_SELECTOR)).toBeNull();
        expect(ctrl.defaultPrevented).toBe(true);
    });

    it("ignores stale Hanja lookup results after later input", async () => {
        process.env.KIME_ENABLE_HANJA = "true";
        const candidates: readonly HanjaCandidate[] = [{ hanja: "韓", korean: "나라 이름 한, 한나라 한" }];
        let resolveLookup!: (match: HanjaDictionaryMatch) => void;
        const provider: HanjaDictionaryProvider = {
            lookup: jest.fn(
                () =>
                    new Promise<HanjaDictionaryMatch>((resolve) => {
                        resolveLookup = resolve;
                    })
            ),
        };
        const element = document.createElement("textarea");
        element.value = "한";
        element.selectionStart = 1;
        element.selectionEnd = 1;
        const controller = makeController(element, provider);
        controller.activate();

        const ctrl = pressRightCtrl(element);
        const input = dispatchKeydown(element, "KeyR", "r");
        resolveLookup({ start: 0, length: 1, reading: "한", candidates });
        await settleHanjaLookup();

        expect(ctrl.defaultPrevented).toBe(true);
        expect(input.defaultPrevented).toBe(true);
        expect(document.querySelector(HANJA_CANDIDATE_WINDOW_SELECTOR)).toBeNull();
    });

    it("still opens candidates when the Hanja key is followed by blur before lookup resolves", async () => {
        process.env.KIME_ENABLE_HANJA = "true";
        const candidates: readonly HanjaCandidate[] = [
            { hanja: "安", korean: "편안할 안, 어찌 안" },
            { hanja: "岸", korean: "물가 언덕 안" },
        ];
        let resolveLookup!: (match: HanjaDictionaryMatch) => void;
        const provider: HanjaDictionaryProvider = {
            lookup: jest.fn(
                () =>
                    new Promise<HanjaDictionaryMatch>((resolve) => {
                        resolveLookup = resolve;
                    })
            ),
        };
        const element = document.createElement("textarea");
        element.value = "안";
        element.selectionStart = 1;
        element.selectionEnd = 1;
        const controller = makeController(element, provider);
        controller.activate();

        pressRightCtrl(element);
        element.dispatchEvent(new FocusEvent("blur"));
        resolveLookup({ start: 0, length: 1, reading: "안", candidates });
        await settleHanjaLookup();

        expect(candidateTexts()).toEqual(["1安", "2岸"]);
    });
});
