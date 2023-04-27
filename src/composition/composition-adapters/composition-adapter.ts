import { isMethodSupported } from "../../decorators/method-not-supported";
import { KeyCode } from "../../content-script/on-screen-keyboard/korean-keyboard-map";
import { setAsKimeEvent } from "../../messaging/dom-events";

type DispatchableEvent = KeyboardEvent | CompositionEvent | InputEvent;

type MethodKeys<T extends object> = keyof T & {
    [K in keyof T]: T[K] extends (...args: any[]) => any ? K : never;
}[keyof T];

type KeysToFilter = "supportsMethods" | "getSupportedMethods";
type FilteredKeys<T extends object> = Exclude<MethodKeys<T>, KeysToFilter>;

export type SupportedCompositionFeatures =  Record<FilteredKeys<CompositionAdapter>, boolean>
export type DispatchableAction = DispatchableEvent | (() => void);

export abstract class CompositionAdapter {
    constructor(protected element: HTMLElement) { }

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
                view: window
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
                inputType: "insertText"
            }),
            new KeyboardEvent("keyup", {
                key: data,
                code: keyCode,
                bubbles: true,
                view: window
            })
        ];

        this.dispatchActions(eventsToDispatch);
    }


    abstract beginComposition(data: string, keyCode: KeyCode): void;
    abstract updateComposition(data: string, keyCode: KeyCode): void;

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
     * Dispatches a list of events and functions. Sets all events as Kime events unless
     * the events are dispatched from a function included in the list.
     * @param actions 
     */
    protected dispatchActions(actions: DispatchableAction[]) {
        actions.forEach(action => {
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
    supportsMethods(...name: FilteredKeys<CompositionAdapter>[]): boolean {
        return name.every(n => isMethodSupported(this, n));
    }

    getSupportedMethods(): SupportedCompositionFeatures {
        const prototype = Object.getPrototypeOf(this);

        const methodNames = Object
            .getOwnPropertyNames(prototype)
            .map(n => n as keyof CompositionAdapter)
            .filter(n => this[n] instanceof Function)
            .map(n => n as MethodKeys<CompositionAdapter>);

        const record = {} as Record<MethodKeys<CompositionAdapter>, boolean>;
        for (const name of methodNames) {
            record[name] = isMethodSupported(this, name);
        }
        return record;
    }
}

function isDispatchableFunction(action: DispatchableAction): action is () => void {
    return typeof action === "function";
}

function isDispatchableEvent(action: DispatchableAction): action is DispatchableEvent {
    return action instanceof Event;
}
