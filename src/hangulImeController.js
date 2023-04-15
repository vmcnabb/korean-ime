"use strict";

import { hangulMaps as maps, isHangulCharacter } from "./mappings";
import { Compositor } from "./composition";
import { CompositionAdapterFactory } from "./compositionAdapterFactory";

/**
 * @param {HTMLElement} element 
 */
export function HangulImeController (element) {
    let isActive = false;

    const compositor = new Compositor();
    const compositionAdapter = CompositionAdapterFactory.createCompositionAdapter(element);

    if (!compositionAdapter) {
        throw "Could not create composition adapter for element";
    }

    this.activate = activate;
    this.deactivate = deactivate;
    this.isActive = () => isActive;
    this.addJamo = addJamo;

    var self = this;

    function notifyChange() {
        if (self.onentry) {
            self.onentry();
        }
    }

    let lastAlt = "";

    const eventHandlers = {
        keydown: (/** @type {KeyboardEvent} */ event) => {
            const code = event.code;

            // record which alt was down last, so we know if the "han/yeong" key is down
            if (["AltRight", "AltLeft"].includes(code)) {
                lastAlt = code;
                return;
            }

            // don't process modifier keys
            if (["ShiftLeft", "ShiftRight", "CtrlLeft", "CtrlRight", "Meta"].includes(code)) {
                return;
            }

            if (!isActive) {
                if (event.altKey && lastAlt === "AltRight") {
                    // insert character manually when "han/yeong" key is down so that a menu isn't triggered
                    compositionAdapter.updateComposition(event.key);
                    compositionAdapter.endComposition(event.key);
                    event.preventDefault();
                    return false;
                }

                return true;
            }

            if (!compositor.isCompositing() && event.shiftKey && code === "Backspace") {
                // select previous character if it is hanguel and put it into composition mode
                const character = compositionAdapter.selectPreviousCharacter();
                if (isHangulCharacter(character)) {
                    compositor.setCharacter(character);
                }
            }

            const key = maps.keyboardMap[code];

            if (code === "Backspace" && compositor.isCompositing()) {
                const block = compositor.removeLastJamo();
                if (block) {
                    compositionAdapter.updateComposition(block);

                } else {
                    // hack for contentEditableProxy
                    // would prefer `editor.endComposition("")` and no `return` which works in the inputProxy.
                    // the hack works by replacing the character with an "x" then allowing the browser
                    // (or Google Docs) to handle the backspace which immediately removes the "x".
                    compositionAdapter.endComposition("x");
                    return true;
                }

                notifyChange();

                event.preventDefault();
                event.stopPropagation();
                return false;
            }

            // don't interfere with keyboard shortcuts or keys we don't understand
            if (!key || event.ctrlKey) {
                if (compositor.isCompositing()) {
                    compositionAdapter.deselect();
                    compositor.reset();
                }

                return true;
            }

            if (!key.jamo) {
                if (compositor.isCompositing()) {
                    compositionAdapter.endComposition(compositor.getCurrent());
                    compositor.reset();
                }

                return true;
            }

            const jamo = key.jamo.shift && event.shiftKey ? key.jamo.shift : key.jamo.normal;

            addJamo(jamo);

            event.preventDefault();
            return false;
        },
        blur: () => {
            if (!isActive) return;

            compositor.reset();
            compositionAdapter.blur();
        },
        mousedown: () => {
            if (!isActive) return;

            compositor.reset();
            compositionAdapter.blur();
        }
    };

    /** @type {{target:EventTarget,type:string,listener:EventListener}[]} */
    const listeners = [];
    Object.keys(eventHandlers).forEach(type =>
        addListener(compositionAdapter.getListenerTarget(type), type, eventHandlers[type])
    );

    function activate () {
        isActive = true;
    }

    function deactivate ()  {
        if (compositor.isCompositing()) {
            compositor.reset();
            compositionAdapter.deselect();
        }
        
        isActive = false;
    }

    function addJamo(jamo) {
        const block = compositor.addJamo(jamo);

        if (block.completed) {
            compositionAdapter.endComposition(block.completed);
        }

        if (block.inProgress) {
            compositionAdapter.updateComposition(block.inProgress);
            notifyChange();
        }
    }

    function addListener (/** @type {EventTarget} */ target, /** @type {string} */ type, /** @type {EventListener} */ listener) {
        target.addEventListener(type, listener, true);
        listeners.push({ target, type, listener });
    }
}
