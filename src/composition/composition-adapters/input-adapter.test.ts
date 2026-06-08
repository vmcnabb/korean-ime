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
