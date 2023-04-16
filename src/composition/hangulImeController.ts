import { hangulMaps as maps, isHangulCharacter } from "../mappings";
import { Compositor } from "./composition";
import { CompositionAdapterFactory } from "./compositionAdapterFactory";
import { CompositionAdapter } from "./compositionAdapters/compositionAdapter";

/**
 * @param {HTMLElement} element 
 */
export class HangulImeController {
    private _isActive = false;
    private compositor = new Compositor();
    private compositionAdapter: CompositionAdapter;

    private changeListeners: (() => void)[] = [];
    private eventListeners: { target: EventTarget, type: string, listener: EventListener }[] = [];

    private lastAlt = "";

    constructor(element: HTMLElement) {
        const compositionAdapter = CompositionAdapterFactory.createCompositionAdapter(element);
        if (!compositionAdapter) {
            throw "Could not create composition adapter for element";
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
            const code = event.code as keyof typeof maps.keyboardMap;

            // record which alt was down last, so we know if the "han/yeong" key is down
            if (["AltRight", "AltLeft"].includes(code)) {
                this.lastAlt = code;
                return;
            }

            // don't process modifier keys
            if (["ShiftLeft", "ShiftRight", "CtrlLeft", "CtrlRight", "Meta"].includes(code)) {
                return;
            }

            if (!this._isActive) {
                if (event.altKey && this.lastAlt === "AltRight") {
                    // insert character manually when "han/yeong" key is down so that a menu isn't triggered
                    this.compositionAdapter.updateComposition(event.key);
                    this.compositionAdapter.endComposition(event.key);
                    event.preventDefault();
                    return false;
                }

                return true;
            }

            if (!this.compositor.isCompositing() && event.shiftKey && code === "Backspace") {
                // select previous character if it is Hangul and put it into composition mode
                const character = this.compositionAdapter.selectPreviousCharacter();
                if (isHangulCharacter(character)) {
                    this.compositor.setCharacter(character);
                }
            }

            const key = maps.keyboardMap[code as keyof typeof maps.keyboardMap];

            if (code === "Backspace" && this.compositor.isCompositing()) {
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

            if (!("jamo" in key)) {
                if (this.compositor.isCompositing()) {
                    this.compositionAdapter.endComposition(this.compositor.getCurrent());
                    this.compositor.reset();
                }

                return true;
            }

            const jamo = "shift" in key.jamo && event.shiftKey
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
