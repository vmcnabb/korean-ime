import { KeyCode } from "../../content-script/on-screen-keyboard/korean-keyboard-map";
import { setAsKimeEvent } from "../../messaging/dom-events";

export type DispatchableEvent = KeyboardEvent | CompositionEvent | InputEvent | (() => void);

export abstract class CompositionAdapter {
    constructor (protected element: HTMLElement) {}

    /** Is called when focus has blurred from where the current character is being composited */
    abstract blur(): void;

    getListenerTarget(_eventType: string): EventTarget {
        return this.element;
    }

    abstract deselect(): void;
    abstract selectPreviousCharacter(): string | undefined;

    /**
     * When there is a selection, delete it.
     * Otherwise, delete the character preceding the cursor when there is no selection.
     * Typically will delete to the left unless the element has a different text direction.
     * 
     * Both of these situations are typically handled by emulating a backspace keypress.
     */
    abstract deleteContentBackward(): void;

    /**
     * Inputs a character without triggering composition. Used for punctuation, numbers, and
     * other characters that are not part of the Korean alphabet. Typically this is done by
     * simulating a keypress series of events.
     * 
     * The caller should ensure that composition is not in progress before calling this method.
     * @param data the character to input
     */
    abstract inputCharacter(data: string, keyCode: KeyCode): void;

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
     * @param events 
     */
    protected dispatchEvents(events: DispatchableEvent[]) {
        events.forEach(event => {
            if (event instanceof Event) {
                setAsKimeEvent(event);
                this.element.dispatchEvent(event);
            } else {
                event();
            }
        });
    }

}
