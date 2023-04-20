import { isKimeEvent } from "../messaging/dom-events";
import { isModifierKey, KeyCode } from "../content-script/on-screen-keyboard/korean-keyboard-map";
import { hangulMaps as maps, isHangulCharacter } from "../mappings";
import { Compositor } from "./composition";
import { CompositionAdapterFactory } from "./composition-adapter-factory";
import { CompositionAdapter } from "./composition-adapters/composition-adapter";

/**
 * @param {HTMLElement} element 
 */
export class HangulImeController {
    private _isActive = false;
    private compositor = new Compositor();
    private compositionAdapter: CompositionAdapter;

    private changeListeners: (() => void)[] = [];
    private eventListeners: { target: EventTarget, type: string, listener: EventListener }[] = [];

    private lastAlt = KeyCode.AltLeft;

    constructor(element: HTMLElement) {
        const compositionAdapter = CompositionAdapterFactory.createCompositionAdapter(element);
        if (!compositionAdapter) {
            throw new Error("Could not create composition adapter for element");
        }

        this.compositionAdapter = compositionAdapter;
        const self = this;

        Object.keys(this.eventHandlers).forEach(type => {
            const key = type as keyof typeof self.eventHandlers;

            this.addListener(
                compositionAdapter.getListenerTarget(type),
                type,
                this.eventHandlers[key] as EventListener)
        });
    }

    isActive () {
        return this._isActive;
    };

    // todo: find out why we are notifying a change and for who
    notifyChange() {
        this.changeListeners.forEach(listener => {
            try {
                listener()

            } catch (e) {
                console.error(e);
            }
        });
    }

    onEntry(listener: () => void) {
        this.changeListeners.push(listener);
    }

    private eventHandlers = {
        keydown: (event: KeyboardEvent): void => {
            if (isKimeEvent(event)) {
                return;
            }

            const code = event.code as KeyCode;

            // record which alt was down last, so we know if the "han/yeong" key is down
            if ([KeyCode.AltRight, KeyCode.AltLeft].includes(code)) {
                this.lastAlt = code;
                return;
            }

            // don't process modifier keys
            if (isModifierKey(code)) {
                return;
            }

            if (!this._isActive) {
                if (event.altKey && this.lastAlt === KeyCode.AltRight) {
                    // insert character manually when "han/yeong" key is down so that a menu isn't triggered
                    this.compositionAdapter.beginComposition(event.key, code);
                    this.compositionAdapter.updateComposition(event.key, code);
                    this.compositionAdapter.endComposition(event.key);

                    event.preventDefault();
                    event.stopPropagation();
                    event.stopImmediatePropagation();
                    return;
                }

                return;
            }

            if (!this.compositor.isCompositing() && event.shiftKey && code === KeyCode.Backspace) {
                // select previous character if it is Hangul and put it into composition mode
                const character = this.compositionAdapter.selectPreviousCharacter();
                if (isHangulCharacter(character) && character) {
                    this.compositor.setCharacter(character);
                }
            }

            const key = maps.keyboardMap[code];

            if (code === KeyCode.Backspace && this.compositor.isCompositing()) {
                const block = this.compositor.removeLastJamo();
                if (block) {
                    this.compositionAdapter.updateComposition(block, code);

                } else {
                    // hack for contentEditableProxy
                    // would prefer `editor.endComposition("")` and no `return` which works in the inputProxy.
                    // the hack works by replacing the character with an "x" then allowing the browser
                    // (or Google Docs) to handle the backspace which immediately removes the "x".
                    // todo: find a better way to do this
                    this.compositionAdapter.endComposition("x");
                    return;
                }

                this.notifyChange();

                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
                return;
            }

            // don't interfere with keyboard shortcuts or keys we don't understand
            if (!key || event.ctrlKey) {
                if (this.compositor.isCompositing()) {
                    this.compositionAdapter.endComposition(this.compositor.getCurrent());
                    this.compositor.reset();
                }

                return;
            }

            if (!key.jamo) {
                if (this.compositor.isCompositing()) {
                    this.compositionAdapter.endComposition(this.compositor.getCurrent());
                    this.compositor.reset();
                }

                return;
            }

            const jamo = event.shiftKey && key.jamo.shift
                ? key.jamo.shift
                : key.jamo.normal;

            this.addJamo(jamo, code);

            event.preventDefault();
            event.stopImmediatePropagation();
            event.stopPropagation();
        },
        blur: () => {
            if (!this._isActive) {
                return;
            }

            this.compositor.reset();
            this.compositionAdapter.blur();
        },
        mousedown: () => {
            if (!this._isActive)
            {
                 return;
            }

            this.compositor.reset();
            this.compositionAdapter.blur();
        }
    };

    activate () {
        this._isActive = true;
    }

    deactivate ()  {
        if (this.compositor.isCompositing()) {
            this.compositor.reset();
            this.compositionAdapter.deselect();
        }
        
        this._isActive = false;
    }

    /**
     * Add a non-Hangul character to the composition adapter.
     * This will end any current composition.
     * @param char 
     */
    addCharacter(char: string, keyCode: KeyCode) {
        if (this.compositor.isCompositing()) {
            this.compositionAdapter.endComposition(this.compositor.getCurrent());
            this.compositor.reset();
        }

        this.compositionAdapter.beginComposition(char, keyCode);
        this.compositionAdapter.updateComposition(char, keyCode);
        this.compositionAdapter.endComposition(char);
    }

    handleBackspace() { 
        if (this.compositor.isCompositing()) {
            const block = this.compositor.removeLastJamo();
            if (block) {
                this.compositionAdapter.updateComposition(block, KeyCode.Backspace);
            } else {
                this.compositionAdapter.endComposition("");
            }

            this.notifyChange();

        } else {
            this.compositionAdapter.handleBackspace();
        }
    }

    addJamo(jamo: string, keyCode: KeyCode) {
        const compositionProgress = this.compositor.addJamo(jamo);

        if (compositionProgress.completed) {
            this.compositionAdapter.endComposition(compositionProgress.completed);
        }

        if (compositionProgress.initial) {
            this.compositionAdapter.beginComposition(compositionProgress.initial, keyCode);
        }

        if (compositionProgress.inProgress) {
            this.compositionAdapter.updateComposition(compositionProgress.inProgress, keyCode);
        }

        this.notifyChange();
    }

    private addListener (target: EventTarget, type: string, listener: EventListener) {
        target.addEventListener(type, listener, true);
        this.eventListeners.push({ target, type, listener });
    }
}
