import { HangulImeController } from "./hangul-ime-controller";
import { InputAdapter } from "./composition-adapters/input-adapter";
import { ContentEditableAdapter } from "./composition-adapters/content-editable-adapter";
import { KeyCode } from "../keyboard/korean-keyboard-map";

function dispatchKeydown(target: EventTarget, code: string, key: string): KeyboardEvent {
    const event = new KeyboardEvent("keydown", { code, key, bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    return event;
}

// Each controller registers a capture-phase keydown listener on `window`. Tests
// don't route controllers through TextInputManager, so without cleanup a
// controller from one test keeps reacting to keystrokes dispatched by the next.
// Track every controller and dispose them all after each test to keep tests
// isolated.
const liveControllers: HangulImeController[] = [];
function makeController(element: HTMLElement): HangulImeController {
    const controller = new HangulImeController(element);
    liveControllers.push(controller);
    return controller;
}
afterEach(() => {
    liveControllers.forEach((controller) => controller.dispose());
    liveControllers.length = 0;
});

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

        const controller = makeController(element);

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

describe("HangulImeController intercepts Backspace during composition in the capture phase", () => {
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

describe("HangulImeController intercepts the first jamo over a selection in the capture phase", () => {
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

    // Without a selection there's nothing for the editor to type over, so the
    // capture guard must stay out of the way and let the normal bubble path run.
    it("leaves a no-selection jamo to the bubble handler (does not intercept in capture)", () => {
        const { element, beginComposition } = activeContentEditable("Hello .");
        selectWithin(element.firstChild as Node, 6, 6); // collapsed caret, no selection

        let reachedBodyCapture = false;
        document.body.addEventListener("keydown", () => (reachedBodyCapture = true), true);

        const keydown = pressJamo(element);

        expect(beginComposition).toHaveBeenCalledWith("ㅇ", KeyCode.KeyD); // still composed...
        expect(keydown.defaultPrevented).toBe(true);
        expect(reachedBodyCapture).toBe(true); // ...but via the bubble path, not capture
    });
});

describe("HangulImeController intercepts Shift+Backspace in the capture phase", () => {
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

describe("HangulImeController Hanja candidate selection (KIME_ENABLE_HANJA)", () => {
    afterEach(() => {
        jest.restoreAllMocks();
        delete process.env.KIME_ENABLE_HANJA;
        document.body.innerHTML = "";
    });

    // Drive composition state in jsdom by stubbing the adapter's DOM mutations, then
    // type the jamo for a syllable so the compositor is genuinely mid-composition.
    function composingController() {
        jest.spyOn(InputAdapter.prototype, "beginComposition").mockImplementation(() => {});
        jest.spyOn(InputAdapter.prototype, "updateComposition").mockImplementation(() => {});
        const endComposition = jest.spyOn(InputAdapter.prototype, "endComposition").mockImplementation(() => {});
        const deleteContentBackwards = jest
            .spyOn(InputAdapter.prototype, "deleteContentBackwards")
            .mockImplementation(() => {});
        const inputCharacter = jest.spyOn(InputAdapter.prototype, "inputCharacter").mockImplementation(() => {});

        const element = document.createElement("textarea");
        const controller = makeController(element);
        controller.activate();
        return { element, endComposition, deleteContentBackwards, inputCharacter };
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

    function candidateTexts() {
        return Array.from(document.querySelectorAll<HTMLElement>(".kime-hanja-candidate")).map((item) => {
            const number = item.querySelector("span:first-child")?.textContent;
            const hanja = item.querySelector(".kime-hanja-candidate-hanja")?.textContent;
            return `${number}${hanja}`;
        });
    }

    function candidateValues() {
        return Array.from(document.querySelectorAll<HTMLElement>(".kime-hanja-candidate")).map(
            (item) => item.querySelector(".kime-hanja-candidate-hanja")?.textContent
        );
    }

    function activeCandidateValue() {
        return document.querySelector<HTMLElement>(
            '.kime-hanja-candidate[aria-selected="true"] .kime-hanja-candidate-hanja'
        )?.textContent;
    }

    function controllerAfterCommittedSyllable(reading: string) {
        const element = document.createElement("textarea");
        element.value = reading;
        element.selectionStart = reading.length;
        element.selectionEnd = reading.length;
        const controller = makeController(element);
        controller.activate();
        pressRightCtrl(element);
        return { element };
    }

    function clickNextPage() {
        document.querySelector<HTMLButtonElement>(".kime-hanja-page-next")?.click();
    }

    function clickPreviousPage() {
        document.querySelector<HTMLButtonElement>(".kime-hanja-page-previous")?.click();
    }

    function scrollCandidates(deltaY: number) {
        document
            .querySelector<HTMLElement>(".kime-hanja-candidates")
            ?.dispatchEvent(new WheelEvent("wheel", { deltaY, bubbles: true, cancelable: true }));
    }

    function clickCandidate(index: number) {
        document.querySelectorAll<HTMLElement>(".kime-hanja-candidate")[index].click();
    }

    it("shows candidates for a composing 한 and swallows the Hanja key when the flag is on", () => {
        process.env.KIME_ENABLE_HANJA = "true";
        const { element, endComposition } = composingController();
        composeHan(element);

        const ctrl = pressRightCtrl(element);

        expect(candidateTexts()).toEqual(["1韓", "2寒", "3恨"]);
        expect(endComposition).toHaveBeenCalledWith("한");
        expect(endComposition).not.toHaveBeenCalledWith("韓");
        expect(ctrl.defaultPrevented).toBe(true);
    });

    it("shows candidates for a composing 안", () => {
        process.env.KIME_ENABLE_HANJA = "true";
        const { element } = composingController();
        composeAn(element);

        pressRightCtrl(element);

        expect(candidateTexts()).toEqual(["1安", "2岸"]);
    });

    it("commits a composing candidate selected by number", () => {
        process.env.KIME_ENABLE_HANJA = "true";
        const { element, deleteContentBackwards, inputCharacter } = composingController();
        composeHan(element);
        pressRightCtrl(element);

        const digit = dispatchKeydown(element, "Digit2", "2");

        expect(deleteContentBackwards).toHaveBeenCalled();
        expect(inputCharacter).toHaveBeenCalledWith("寒", KeyCode.Digit2);
        expect(document.querySelector(".kime-hanja-candidates")).toBeNull();
        expect(digit.defaultPrevented).toBe(true);
    });

    it("commits the active composing candidate with Down and Enter", () => {
        process.env.KIME_ENABLE_HANJA = "true";
        const { element, inputCharacter } = composingController();
        composeHan(element);
        pressRightCtrl(element);

        const arrow = dispatchKeydown(element, "ArrowDown", "ArrowDown");
        const enter = dispatchKeydown(element, "Enter", "Enter");

        expect(inputCharacter).toHaveBeenCalledWith("寒", KeyCode.Enter);
        expect(arrow.defaultPrevented).toBe(true);
        expect(enter.defaultPrevented).toBe(true);
    });

    it("closes the candidate list on Escape without committing", () => {
        process.env.KIME_ENABLE_HANJA = "true";
        const { element, endComposition } = composingController();
        composeHan(element);
        pressRightCtrl(element);

        const escape = dispatchKeydown(element, "Escape", "Escape");

        expect(endComposition).not.toHaveBeenCalledWith(expect.stringMatching(/[韓寒恨]/));
        expect(endComposition).toHaveBeenCalledWith("한");
        expect(document.querySelector(".kime-hanja-candidates")).toBeNull();
        expect(escape.defaultPrevented).toBe(true);
    });

    it("closes the candidate list on Backspace without deleting or committing", () => {
        process.env.KIME_ENABLE_HANJA = "true";
        const { element, deleteContentBackwards, inputCharacter } = composingController();
        composeHan(element);
        pressRightCtrl(element);

        deleteContentBackwards.mockClear();
        inputCharacter.mockClear();
        const backspace = dispatchKeydown(element, "Backspace", "Backspace");

        expect(deleteContentBackwards).not.toHaveBeenCalled();
        expect(inputCharacter).not.toHaveBeenCalled();
        expect(document.querySelector(".kime-hanja-candidates")).toBeNull();
        expect(backspace.defaultPrevented).toBe(true);
    });

    it("closes the candidate list on Delete without deleting or committing", () => {
        process.env.KIME_ENABLE_HANJA = "true";
        const { element, deleteContentBackwards, inputCharacter } = composingController();
        composeHan(element);
        pressRightCtrl(element);

        deleteContentBackwards.mockClear();
        inputCharacter.mockClear();
        const del = dispatchKeydown(element, "Delete", "Delete");

        expect(deleteContentBackwards).not.toHaveBeenCalled();
        expect(inputCharacter).not.toHaveBeenCalled();
        expect(document.querySelector(".kime-hanja-candidates")).toBeNull();
        expect(del.defaultPrevented).toBe(true);
    });

    it("selects candidates after a committed syllable", () => {
        process.env.KIME_ENABLE_HANJA = "true";
        const { element } = controllerAfterCommittedSyllable("한");

        dispatchKeydown(element, "Digit3", "3");

        expect(element.value).toBe("恨");
        expect(document.querySelector(".kime-hanja-candidates")).toBeNull();
    });

    it("shows a maxed one-page candidate list without a usable next page", () => {
        process.env.KIME_ENABLE_HANJA = "true";
        const { element } = controllerAfterCommittedSyllable("가");

        expect(candidateValues()).toHaveLength(9);

        dispatchKeydown(element, "ArrowRight", "ArrowRight");

        expect(candidateValues()).toEqual(["家", "加", "可", "假", "價", "佳", "街", "歌", "架"]);
    });

    it("wraps pages with Left and Right instead of moving between candidates", () => {
        process.env.KIME_ENABLE_HANJA = "true";
        const { element } = controllerAfterCommittedSyllable("나");

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

    it("commits a numbered candidate from the visible page", () => {
        process.env.KIME_ENABLE_HANJA = "true";
        const { element } = controllerAfterCommittedSyllable("나");

        dispatchKeydown(element, "ArrowRight", "ArrowRight");
        dispatchKeydown(element, "Digit1", "1");

        expect(element.value).toBe("儺");
    });

    it("moves Up from the first entry on a page to the last entry on the previous page", () => {
        process.env.KIME_ENABLE_HANJA = "true";
        const { element } = controllerAfterCommittedSyllable("나");

        dispatchKeydown(element, "ArrowRight", "ArrowRight");
        dispatchKeydown(element, "ArrowUp", "ArrowUp");

        expect(candidateValues()).toEqual(["羅", "那", "裸", "懶", "螺", "拿", "娜", "拏", "糯"]);
        expect(activeCandidateValue()).toBe("糯");
    });

    it("moves Down from the last entry on a page to the first entry on the next page", () => {
        process.env.KIME_ENABLE_HANJA = "true";
        const { element } = controllerAfterCommittedSyllable("나");

        for (let i = 0; i < 9; i += 1) {
            dispatchKeydown(element, "ArrowDown", "ArrowDown");
        }

        expect(candidateValues()).toEqual(["儺"]);
        expect(activeCandidateValue()).toBe("儺");
    });

    it("supports a maxed second page and a third page", () => {
        process.env.KIME_ENABLE_HANJA = "true";
        const { element } = controllerAfterCommittedSyllable("다");

        dispatchKeydown(element, "ArrowRight", "ArrowRight");
        expect(candidateValues()).toHaveLength(9);
        dispatchKeydown(element, "Escape", "Escape");

        const thirdPage = controllerAfterCommittedSyllable("라");
        dispatchKeydown(thirdPage.element, "ArrowRight", "ArrowRight");
        dispatchKeydown(thirdPage.element, "ArrowRight", "ArrowRight");
        expect(candidateValues()).toEqual(["籮"]);
    });

    it("moves between pages two and three with Down and Up", () => {
        process.env.KIME_ENABLE_HANJA = "true";
        const { element } = controllerAfterCommittedSyllable("라");

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

    it("wraps Up from the first item on the first page to the last item on the last page", () => {
        process.env.KIME_ENABLE_HANJA = "true";
        const { element } = controllerAfterCommittedSyllable("라");

        dispatchKeydown(element, "ArrowUp", "ArrowUp");

        expect(candidateValues()).toEqual(["籮"]);
        expect(activeCandidateValue()).toBe("籮");
    });

    it("wraps Down from the last item on the last page to the first item on the first page", () => {
        process.env.KIME_ENABLE_HANJA = "true";
        const { element } = controllerAfterCommittedSyllable("라");

        dispatchKeydown(element, "ArrowLeft", "ArrowLeft");
        dispatchKeydown(element, "ArrowDown", "ArrowDown");

        expect(candidateValues()).toEqual(["羅", "螺", "裸", "懶", "邏", "鑼", "喇", "蘿", "癩"]);
        expect(activeCandidateValue()).toBe("羅");
    });

    it("wraps pages with mouse buttons", () => {
        process.env.KIME_ENABLE_HANJA = "true";
        controllerAfterCommittedSyllable("나");

        clickPreviousPage();
        expect(candidateValues()).toEqual(["儺"]);

        clickNextPage();
        expect(candidateValues()).toEqual(["羅", "那", "裸", "懶", "螺", "拿", "娜", "拏", "糯"]);

        clickNextPage();
        expect(candidateValues()).toEqual(["儺"]);

        clickNextPage();
        expect(candidateValues()).toEqual(["羅", "那", "裸", "懶", "螺", "拿", "娜", "拏", "糯"]);
    });

    it("moves selection with mouse wheel scrolling", () => {
        process.env.KIME_ENABLE_HANJA = "true";
        controllerAfterCommittedSyllable("한");

        scrollCandidates(100);
        expect(activeCandidateValue()).toBe("寒");

        scrollCandidates(-100);
        expect(activeCandidateValue()).toBe("韓");
    });

    it("commits a clicked candidate from the visible page", () => {
        process.env.KIME_ENABLE_HANJA = "true";
        const { element } = controllerAfterCommittedSyllable("나");

        dispatchKeydown(element, "ArrowRight", "ArrowRight");
        clickCandidate(0);

        expect(element.value).toBe("儺");
        expect(document.querySelector(".kime-hanja-candidates")).toBeNull();
    });

    it("uses Right Option as the Hanja key on macOS", () => {
        jest.spyOn(window.navigator, "platform", "get").mockReturnValue("MacIntel");
        process.env.KIME_ENABLE_HANJA = "true";
        const { element } = composingController();
        composeHan(element);

        const option = pressRightOption(element);

        expect(candidateTexts()).toEqual(["1韓", "2寒", "3恨"]);
        expect(option.defaultPrevented).toBe(true);
    });

    it("does nothing when the flag is off (Right-Ctrl is just a modifier)", () => {
        const { element, endComposition } = composingController(); // flag unset
        composeHan(element);

        const ctrl = pressRightCtrl(element);

        expect(endComposition).not.toHaveBeenCalled();
        expect(document.querySelector(".kime-hanja-candidates")).toBeNull();
        expect(ctrl.defaultPrevented).toBe(false);
    });

    it("leaves a composing syllable that isn't in the dictionary alone, even with the flag on", () => {
        process.env.KIME_ENABLE_HANJA = "true";
        const { element, endComposition } = composingController();
        dispatchKeydown(element, "KeyR", "r"); // ㄱ
        dispatchKeydown(element, "KeyM", "m"); // ㅡ → 그
        dispatchKeydown(element, "KeyF", "f"); // ㄹ → 글

        const ctrl = pressRightCtrl(element);

        expect(endComposition).not.toHaveBeenCalled();
        expect(ctrl.defaultPrevented).toBe(false);
    });
});
