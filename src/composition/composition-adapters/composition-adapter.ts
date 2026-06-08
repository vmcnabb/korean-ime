import { isMethodSupported } from "../../decorators/method-not-supported";
import { KeyCode } from "../../keyboard/korean-keyboard-map";
import { setAsKimeEvent } from "../../messaging/dom-events";
import { trace } from "../../decorators/trace";
import { DummyAdapter } from "./dummy-adapter";
import { MethodKeys } from "../../types/objects";
import { ICompositionAdapter, SupportedCompositionFeatures } from "./composition-adapter-interface";

type DispatchableEvent = KeyboardEvent | CompositionEvent | InputEvent;

export type DispatchableAction = DispatchableEvent | (() => void);

@trace
export abstract class CompositionAdapter implements ICompositionAdapter {
    constructor(protected element: HTMLElement) {}

    /** Is called when focus has blurred from where the current character is being composited */
    abstract blur(): void;

    getListenerTarget(_eventType: string): EventTarget {
        return this.element;
    }

    /**
     * Collapse selection to the end of the selection unless `toStart` is true.
     * @param toStart if true, collapse the selection to the start, otherwise collapse to the end
     */
    abstract collapseSelection(toStart?: boolean): void;

    /**
     * Throws if there is no selection or the selection exceeds the bounds of this.element.
     * @returns the current selection
     */
    protected guardSelection(): Selection {
        const selection = window.getSelection();

        // throw if selection doesn't contain our element
        if (!selection || !this.element.contains(selection.anchorNode) || !this.element.contains(selection.focusNode)) {
            throw new Error("Selection does not include element");
        }

        // throw if this is a multi-range selection
        if (selection.rangeCount !== 1) {
            throw new Error("Selection contains multiple ranges");
        }

        // throw if selection contains elements outside of `this.element`
        const range = selection.getRangeAt(0);
        const startNode = range.startContainer;
        const endNode = range.endContainer;
        if (!this.element.contains(startNode) || !this.element.contains(endNode)) {
            throw new Error("Selection contains nodes outside of element");
        }

        return selection;
    }

    /**
     * Returns the character immediately prior to the caret. If selection is not collapsed, returns undefined.
     */
    abstract getPreviousCharacter(): string | undefined;

    /**
     * Delete selection if exists, otherwise delete the character immediately before the caret.
     */
    abstract deleteContentBackwards(): void;
    protected _deleteContentBackwards(deleteFn: () => void) {
        const eventsToDispatch: DispatchableAction[] = [
            new KeyboardEvent("keydown", {
                key: "Backspace",
                code: KeyCode.Backspace,
                view: window,
                bubbles: true,
            }),
            new InputEvent("beforeinput", {
                inputType: "deleteContentBackward",
                bubbles: true,
            }),
            deleteFn,
            new InputEvent("input", {
                inputType: "deleteContentBackward",
                bubbles: true,
            }),
            new KeyboardEvent("keyup", {
                key: "Backspace",
                code: KeyCode.Backspace,
                view: window,
                bubbles: true,
            }),
        ];

        this.dispatchActions(eventsToDispatch);
    }

    /**
     * Inputs a character without triggering composition. Used for punctuation, numbers, and
     * other characters that are not part of the Korean alphabet. Typically this is done by
     * simulating a keypress series of events.
     *
     * The caller should ensure that composition is not in progress before calling this method.
     * @param data the character to input
     */
    abstract inputCharacter(data: string, keyCode: KeyCode): void;
    protected _inputCharacter(data: string, keyCode: KeyCode, inputCharacterFn: () => void) {
        // simulate the events that would be fired when typing a character
        const eventsToDispatch: DispatchableAction[] = [
            new KeyboardEvent("keydown", {
                key: data,
                code: keyCode,
                view: window,
                bubbles: true,
            }),
            new KeyboardEvent("keypress", {
                key: data,
                code: keyCode,
                bubbles: true,
                view: window,
            }),
            new InputEvent("beforeinput", {
                data: data,
                bubbles: true,
                inputType: "insertText",
            }),
            inputCharacterFn,
            new InputEvent("input", {
                data: data,
                bubbles: true,
                inputType: "insertText",
            }),
            new KeyboardEvent("keyup", {
                key: data,
                code: keyCode,
                bubbles: true,
                view: window,
            }),
        ];

        this.dispatchActions(eventsToDispatch);
    }

    abstract beginComposition(data: string, keyCode: KeyCode): void;
    /**
     * Dispatches the IME event sequence a browser fires when the *first* jamo of a
     * block is composed, with `mutate` slotted in where the browser would update the
     * DOM (after `compositionupdate`, before `input`):
     *
     *  keydown(Process) → compositionstart → beforeinput(insertCompositionText) →
     *  compositionupdate → [mutate] → input(insertCompositionText) → keyup(Process)
     *
     * Without these events a page that tracks its own value (e.g. Google search,
     * any framework-controlled input) never learns the composed text changed — the
     * value we write to the element is invisible to it until a non-composing key
     * forces a real `input`. See `_updateComposition`/`_endComposition` for the rest.
     */
    protected _beginComposition(data: string, keyCode: KeyCode, mutate: () => void) {
        this.dispatchActions([
            createProcessKeyEvent("keydown", keyCode),
            new CompositionEvent("compositionstart", { view: window, bubbles: true }),
            new InputEvent("beforeinput", {
                data,
                isComposing: true,
                inputType: "insertCompositionText",
                bubbles: true,
            }),
            new CompositionEvent("compositionupdate", { data, view: window, bubbles: true }),
            mutate,
            new InputEvent("input", { data, isComposing: true, inputType: "insertCompositionText", bubbles: true }),
            createProcessKeyEvent("keyup", keyCode),
        ]);
    }

    abstract updateComposition(data: string, keyCode: KeyCode): void;
    /**
     * Dispatches the IME event sequence a browser fires when a *subsequent* jamo
     * changes the in-progress block (same as `_beginComposition` minus the
     * `compositionstart`, since composition is already underway):
     *
     *  keydown(Process) → beforeinput(insertCompositionText) → compositionupdate →
     *  [mutate] → input(insertCompositionText) → keyup(Process)
     */
    protected _updateComposition(data: string, keyCode: KeyCode, mutate: () => void) {
        this.dispatchActions([
            createProcessKeyEvent("keydown", keyCode, true),
            new InputEvent("beforeinput", {
                data,
                isComposing: true,
                inputType: "insertCompositionText",
                bubbles: true,
            }),
            new CompositionEvent("compositionupdate", { data, view: window, bubbles: true }),
            mutate,
            new InputEvent("input", { data, isComposing: true, inputType: "insertCompositionText", bubbles: true }),
            createProcessKeyEvent("keyup", keyCode, true),
        ]);
    }

    /**
     * When using Microsoft IME with Korean and Chrome, the following events are fired when the composition
     * ends by typing a key that is not part of IME composition such as space or period, this example is for a period
     * when the current composition is "안":
     *
     *  1. keydown
     *     {..., key: "Process", code: "Period", isComposing: true }
     *  2. beforeinput
     *     {..., inputType: "insertCompositionText", data: "안", isComposing: true }
     *  3. compositionupdate
     *     {..., data: "안" }
     *  4. input
     *     {..., inputType: "insertCompositionText", data: "안", isComposing: true }
     *     This event seems unnecessary as the text is already updated with the composition text, but it may be
     *     because other IMEs such as Chinese may need to update the text differently.
     *  5. compositionend
     *     {..., data: "안" }
     *  6. keydown
     *     { key: ".", code: "Period", isComposing: false }
     *  7. keypress
     *     {... key: ".", code: "Period", isComposing: false }
     *  8. beforeinput
     *     {..., inputType: "insertText", data: ".", isComposing: false }
     *     Element text is updated with the extra "." immediately after the beforeinput as "안" was already committed.
     *  9. input
     *     {..., inputType: "insertText", data: ".", isComposing: false }
     * 10. keyup
     *     {..., key: "Process", code: "Period", isComposing: false }
     * 11. keyup
     *     {..., key: ".", code: "Period", isComposing: false }
     * @param data the final composition text
     */
    abstract endComposition(data: string): void;
    /**
     * Dispatches the events that commit the in-progress composition:
     *
     *  compositionend → [mutate] → input(insertCompositionText, isComposing: false)
     *
     * The `compositionend` tells the page composition is over (so it stops treating
     * the value as tentative), and the trailing non-composing `input` lets
     * value-tracking listeners read the committed text. This must fire even when the
     * composition is abandoned by a focus/caret change (blur/mousedown) — otherwise
     * the page is left believing a composition is still active and its model of the
     * value diverges from what we actually wrote.
     */
    protected _endComposition(data: string, mutate: () => void) {
        this.dispatchActions([
            new CompositionEvent("compositionend", { data, view: window, bubbles: true }),
            mutate,
            new InputEvent("input", { data, isComposing: false, inputType: "insertCompositionText", bubbles: true }),
        ]);
    }

    /**
     * Dispatches a list of events and functions. Sets all events as Kime events unless
     * the events are dispatched from a function included in the list.
     * @param actions
     */
    protected dispatchActions(actions: DispatchableAction[]) {
        actions.forEach((action) => {
            if (isDispatchableEvent(action)) {
                setAsKimeEvent(action);
                this.element.dispatchEvent(action);
            } else if (isDispatchableFunction(action)) {
                action();
            } else {
                throw new Error("Unknown action type");
            }
        });
    }

    /**
     * Takes in an method from the controller object e.g. `compositionAdapter.getListenerTarget` as a parameter
     * and returns true if this adapter supports that action.
     *
     * Methods are considered supported by default unless they are decorated with `@methodNotSupported`.
     * @param method
     */
    supportsMethods(...name: MethodKeys<ICompositionAdapter>[]): boolean {
        return name.every((n) => isMethodSupported(this, n));
    }

    getSupportedMethods(): SupportedCompositionFeatures {
        const prototype = DummyAdapter.prototype;

        const methodNames = Object.getOwnPropertyNames(prototype)
            .map((n) => n as keyof CompositionAdapter)
            .filter((n) => (n as string) !== "constructor")
            .filter((n) => this[n] instanceof Function)
            .map((n) => n as MethodKeys<CompositionAdapter>);

        const record = {} as Record<MethodKeys<CompositionAdapter>, boolean>;
        for (const name of methodNames) {
            record[name] = isMethodSupported(this, name);
        }
        return record;
    }
}

/**
 * keyCode/which value a browser reports for any key the IME consumed ("Process").
 * See `createProcessKeyEvent`.
 */
const IME_PROCESS_KEY_CODE = 229;

/**
 * `code` values that carry a default editing action in a contenteditable. We must
 * never put these on a synthetic composition keydown (see `createProcessKeyEvent`).
 */
const NATIVE_EDITING_CODES = new Set<KeyCode>([KeyCode.Backspace, KeyCode.Enter, KeyCode.Tab]);

/**
 * Builds the synthetic keydown/keyup a browser fires for a keystroke the IME has
 * consumed during composition: `key === "Process"` and `keyCode === which === 229`
 * (keyCode/which are legacy, readonly, and ignored by the KeyboardEvent
 * constructor, so they're stamped on after construction).
 *
 * Crucially, we drop the real `code` when it names a key with a native editing
 * action (Backspace/Enter/Tab). A composition update can be driven by Backspace
 * (recomposing a block, or the shift+Backspace "compose previous char" feature),
 * and some editors — notably Word for the Web — act on `event.code === "Backspace"`
 * directly, running their own delete *on top of* our composition update and eating
 * an extra character before the block. They do this even with `isComposing: true`
 * and `keyCode: 229` set, so signalling IME intent isn't enough; the editing code
 * simply must not be present. `key` stays `"Process"`, which is the real signal a
 * page reads during composition; plain jamo codes (KeyR, …) have no native action
 * and pass through unchanged for fidelity.
 */
function createProcessKeyEvent(type: "keydown" | "keyup", code: KeyCode, isComposing = false): KeyboardEvent {
    const safeCode = NATIVE_EDITING_CODES.has(code) ? "" : code;
    const event = new KeyboardEvent(type, { key: "Process", code: safeCode, isComposing, view: window, bubbles: true });
    Object.defineProperty(event, "keyCode", { value: IME_PROCESS_KEY_CODE });
    Object.defineProperty(event, "which", { value: IME_PROCESS_KEY_CODE });
    return event;
}

function isDispatchableFunction(action: DispatchableAction): action is () => void {
    return typeof action === "function";
}

function isDispatchableEvent(action: DispatchableAction): action is DispatchableEvent {
    return action instanceof Event;
}
