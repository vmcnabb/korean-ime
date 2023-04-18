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
        keydown: (event: KeyboardEvent) => {
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
                    this.compositionAdapter.updateComposition(event.key);
                    this.compositionAdapter.endComposition(event.key);
                    event.preventDefault();
                    return false;
                }

                return true;
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
                    this.compositionAdapter.updateComposition(block);

                } else {
                    // hack for contentEditableProxy
                    // would prefer `editor.endComposition("")` and no `return` which works in the inputProxy.
                    // the hack works by replacing the character with an "x" then allowing the browser
                    // (or Google Docs) to handle the backspace which immediately removes the "x".
                    this.compositionAdapter.endComposition("x");
                    return true;
                }

                this.notifyChange();

                event.preventDefault();
                event.stopPropagation();
                return false;
            }

            // don't interfere with keyboard shortcuts or keys we don't understand
            if (!key || event.ctrlKey) {
                if (this.compositor.isCompositing()) {
                    this.compositionAdapter.deselect();
                    this.compositor.reset();
                }

                return true;
            }

            if (!key.jamo) {
                if (this.compositor.isCompositing()) {
                    this.compositionAdapter.endComposition(this.compositor.getCurrent());
                    this.compositor.reset();
                }

                return true;
            }

            const jamo = event.shiftKey && key.jamo.shift
                ? key.jamo.shift
                : key.jamo.normal;

            this.addJamo(jamo);

            event.preventDefault();
            return false;
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
    addCharacter(char: string) {
        if (this.compositor.isCompositing()) {
            this.compositionAdapter.endComposition(this.compositor.getCurrent());
            this.compositor.reset();
        }

        this.compositionAdapter.updateComposition(char);
        this.compositionAdapter.endComposition(char);
    }

    handleBackspace() { 
        if (this.compositor.isCompositing()) {
            const block = this.compositor.removeLastJamo();
            if (block) {
                this.compositionAdapter.updateComposition(block);
            } else {
                this.compositionAdapter.endComposition("");
            }

            this.notifyChange();

        } else {
            this.compositionAdapter.handleBackspace();
        }
    }

    addJamo(jamo: string) {
        const compositionProgress = this.compositor.addJamo(jamo);

        if (compositionProgress.completed) {
            this.compositionAdapter.endComposition(compositionProgress.completed);
        }

        if (compositionProgress.inProgress) {
            this.compositionAdapter.updateComposition(compositionProgress.inProgress);
            this.notifyChange();
        }
    }

    private addListener (target :EventTarget, type: string, listener: EventListener) {
        target.addEventListener(type, listener, true);
        this.eventListeners.push({ target, type, listener });
    }
}
