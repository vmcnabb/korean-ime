import { InputAdapter } from "./input-adapter";
import { KeyCode } from "../../keyboard/korean-keyboard-map";

/**
 * Records every event dispatched on `target`, in order, for the given types.
 * Returns the recorded list plus a helper to read just the type names.
 */
function recordEvents(target: EventTarget, types: string[]) {
    const events: Event[] = [];
    types.forEach((type) => target.addEventListener(type, (e) => events.push(e)));
    return {
        events,
        get types() {
            return events.map((e) => e.type);
        },
    };
}

const COMPOSITION_EVENT_TYPES = [
    "keydown",
    "keyup",
    "compositionstart",
    "compositionupdate",
    "compositionend",
    "beforeinput",
    "input",
];

function makeTextarea(value = ""): HTMLTextAreaElement {
    const element = document.createElement("textarea");
    document.body.appendChild(element);
    element.value = value;
    element.selectionStart = value.length;
    element.selectionEnd = value.length;
    return element;
}

// The factory selects InputAdapter for anything with `selectionStart` (inputs and
// textareas alike) via a type guard; a textarea is the simplest such element to
// drive in jsdom, so cast past the HTMLInputElement constructor signature.
function makeAdapter(element: HTMLTextAreaElement): InputAdapter {
    return new InputAdapter(element as unknown as HTMLInputElement);
}

describe("InputAdapter composition events", () => {
    afterEach(() => {
        document.body.innerHTML = "";
    });

    // The bug: while composing into a plain input the adapter mutated `value`
    // silently, so a page tracking its own value (Google search) never saw the
    // change until a non-composing key forced a real `input`. Composition must now
    // fire the same events a browser IME would.
    it("fires compositionstart + compositionupdate + input when a block begins", () => {
        const element = makeTextarea();
        const recorded = recordEvents(element, COMPOSITION_EVENT_TYPES);
        const adapter = makeAdapter(element);

        adapter.beginComposition("ㄱ", KeyCode.KeyR);

        expect(recorded.types).toEqual([
            "keydown",
            "compositionstart",
            "beforeinput",
            "compositionupdate",
            "input",
            "keyup",
        ]);
        expect(element.value).toBe("ㄱ");
    });

    // A real IME reports every consumed keystroke as key "Process" with
    // keyCode/which === 229. We mirror that so IME-aware pages know the key was
    // consumed.
    it("stamps key 'Process' + keyCode/which 229 on the composition keydown/keyup", () => {
        const element = makeTextarea();
        const recorded = recordEvents(element, ["keydown", "keyup"]);
        const adapter = makeAdapter(element);

        adapter.beginComposition("ㄱ", KeyCode.KeyR);
        adapter.updateComposition("가", KeyCode.KeyK);

        const keyEvents = recorded.events as KeyboardEvent[];
        expect(keyEvents).not.toHaveLength(0);
        keyEvents.forEach((e) => {
            expect(e.key).toBe("Process");
            expect(e.keyCode).toBe(229);
            expect(e.which).toBe(229);
        });
    });

    // Regression (Word for the Web): a composition update driven by Backspace must
    // NOT carry code "Backspace", or editors that key off event.code run their own
    // delete on top of our recomposition, eating an extra character before the block.
    it("does not leak an editing code onto the keydown when a block is recomposed via Backspace", () => {
        const element = makeTextarea();
        const adapter = makeAdapter(element);
        adapter.beginComposition("가", KeyCode.KeyK);

        const recorded = recordEvents(element, ["keydown", "keyup"]);
        adapter.updateComposition("ㄱ", KeyCode.Backspace); // Backspace removed ㅏ, block is now ㄱ

        const keyEvents = recorded.events as KeyboardEvent[];
        expect(keyEvents).not.toHaveLength(0);
        keyEvents.forEach((e) => {
            expect(e.code).toBe(""); // editing code dropped...
            expect(e.key).toBe("Process"); // ...but the IME signal stays
        });
    });

    // The harmless case must still pass the real code through for fidelity.
    it("keeps the real code on the keydown for ordinary jamo keys", () => {
        const element = makeTextarea();
        const recorded = recordEvents(element, ["keydown"]);
        const adapter = makeAdapter(element);

        adapter.beginComposition("ㄱ", KeyCode.KeyR);

        const keydown = recorded.events[0] as KeyboardEvent;
        expect(keydown.code).toBe("KeyR");
    });

    it("fires an input event on every update so the page sees each keystroke", () => {
        const element = makeTextarea();
        const adapter = makeAdapter(element);

        adapter.beginComposition("ㄱ", KeyCode.KeyR);

        const recorded = recordEvents(element, ["input", "compositionupdate", "compositionstart"]);
        adapter.updateComposition("가", KeyCode.KeyK);

        // an update is not a new composition...
        expect(recorded.types).not.toContain("compositionstart");
        // ...but it still emits compositionupdate + input with the new block
        expect(recorded.types).toEqual(["compositionupdate", "input"]);
        const input = recorded.events.find((e) => e.type === "input") as InputEvent;
        expect(input.data).toBe("가");
        expect(element.value).toBe("가");
    });

    it("fires compositionend (and a final input) when the block commits", () => {
        const element = makeTextarea();
        const adapter = makeAdapter(element);
        adapter.beginComposition("가", KeyCode.KeyK);

        const recorded = recordEvents(element, COMPOSITION_EVENT_TYPES);
        adapter.endComposition("가");

        expect(recorded.types).toContain("compositionend");
        expect(recorded.types).toContain("input");
        // compositionend precedes the committing input
        expect(recorded.types.indexOf("compositionend")).toBeLessThan(recorded.types.lastIndexOf("input"));
        expect(element.value).toBe("가");
        // selection collapses to the end of the committed text
        expect(element.selectionStart).toBe(element.selectionEnd);
    });

    // Symptom #2: typing only Hangul then clicking elsewhere left the page thinking
    // a composition was still active (no compositionend ever fired), so it wiped the
    // text on the next click. blur() — which the controller calls on blur/mousedown —
    // must commit the in-progress block.
    it("commits the in-progress block on blur, firing compositionend", () => {
        const element = makeTextarea();
        const adapter = makeAdapter(element);
        adapter.beginComposition("가", KeyCode.KeyK);

        const recorded = recordEvents(element, COMPOSITION_EVENT_TYPES);
        adapter.blur();

        expect(recorded.types).toContain("compositionend");
        expect(element.value).toBe("가");
    });

    it("does nothing on blur when no composition is in progress", () => {
        const element = makeTextarea("hello");
        const adapter = makeAdapter(element);

        const recorded = recordEvents(element, COMPOSITION_EVENT_TYPES);
        adapter.blur();

        expect(recorded.events).toHaveLength(0);
        expect(element.value).toBe("hello");
    });

    it("does not fire a second compositionend if blur runs after the block already committed", () => {
        const element = makeTextarea();
        const adapter = makeAdapter(element);
        adapter.beginComposition("가", KeyCode.KeyK);
        adapter.endComposition("가");

        const recorded = recordEvents(element, COMPOSITION_EVENT_TYPES);
        adapter.blur();

        expect(recorded.events).toHaveLength(0);
    });
});

describe("InputAdapter committed text ranges", () => {
    afterEach(() => {
        document.body.innerHTML = "";
    });

    it("reads all text before a collapsed caret", () => {
        const element = makeTextarea("앞 한국은 뒤");
        element.selectionStart = element.selectionEnd = 5;
        const adapter = makeAdapter(element);

        expect(adapter.getTextBeforeCaret()).toBe("앞 한국은");
    });

    it("does not expose text while a selection is active", () => {
        const element = makeTextarea("한국");
        element.selectionStart = 0;
        element.selectionEnd = 2;

        expect(makeAdapter(element).getTextBeforeCaret()).toBeUndefined();
    });

    it("replaces an earlier unequal-length range and preserves the logical caret position", () => {
        const element = makeTextarea("가가와현은");
        const adapter = makeAdapter(element);
        const recorded = recordEvents(element, ["beforeinput", "input"]);

        expect(adapter.replaceTextBeforeCaret({ text: "가가와현", offset: 1 }, "香川縣")).toBe(true);

        expect(element.value).toBe("香川縣은");
        expect(element.selectionStart).toBe(4);
        expect(element.selectionEnd).toBe(4);
        expect(recorded.types).toEqual(["beforeinput", "input"]);
        expect((recorded.events[1] as InputEvent).inputType).toBe("insertReplacementText");
    });

    it("refuses to replace a stale range", () => {
        const element = makeTextarea("한국은");
        const adapter = makeAdapter(element);

        expect(adapter.replaceTextBeforeCaret({ text: "한국", offset: 0 }, "韓國")).toBe(false);
        expect(element.value).toBe("한국은");
        expect(element.selectionStart).toBe(3);
    });
});

describe("InputAdapter glyph measurement", () => {
    beforeEach(() => {
        (Range.prototype as { getBoundingClientRect?: () => DOMRect }).getBoundingClientRect = () =>
            ({
                left: 11,
                top: 12,
                width: 13,
                height: 14,
                right: 24,
                bottom: 26,
                x: 11,
                y: 12,
                toJSON: () => ({}),
            }) as DOMRect;
    });

    afterEach(() => {
        document.body.innerHTML = "";
        delete (Range.prototype as { getBoundingClientRect?: () => DOMRect }).getBoundingClientRect;
    });

    it("measures the character immediately before the caret", () => {
        const element = makeTextarea("한");
        const adapter = makeAdapter(element);

        expect(adapter.getPreviousCharacterRect()).toEqual({ left: 11, top: 12, width: 13, height: 14 });
    });

    it("cleans up the temporary mirror element after measurement", () => {
        const element = makeTextarea("한");
        const adapter = makeAdapter(element);

        adapter.getPreviousCharacterRect();

        expect(document.body.childElementCount).toBe(1);
        expect(document.body.firstElementChild).toBe(element);
    });

    it("measures a committed range before the caret", () => {
        const element = makeTextarea("한국은");
        const adapter = makeAdapter(element);

        expect(adapter.getTextRangeRects({ text: "한국", offset: 1 })).toEqual([
            { left: 11, top: 12, width: 13, height: 14 },
        ]);
    });
});
