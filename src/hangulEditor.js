"use strict";

import { hangulMaps as maps, isHangul } from "./mappings";
import { Compositor } from "./composition";
import { CompositionProxyFactory } from "./compositionProxyFactory";

/**
 * @param {HTMLElement} element 
 */
export function HangulEditor (element) {
    let isActive = false;

    const compositor = new Compositor();
    const editor = CompositionProxyFactory.createCompositionProxy(element);

    this.activate = activate;
    this.deactivate = deactivate;
    this.isActive = () => isActive;

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
                    editor.updateComposition(event.key);
                    editor.endComposition(event.key);
                    event.preventDefault();
                    return false;
                }

                return true;
            }

            if (!compositor.isCompositing() && event.shiftKey && code === "Backspace") {
                // select previous character if it is hanguel and put it into composition mode
                const character = editor.selectPreviousCharacter();
                if (isHangul(character)) {
                    compositor.setCharacter(character);
                }
            }

            const key = maps.keyboardMap[code];

            if (code === "Backspace" && compositor.isCompositing()) {
                const block = compositor.removeLastJamo();
                if (block) {
                    editor.updateComposition(block);

                } else {
                    // hack for contentEditableProxy
                    // would prefer `editor.endComposition("")` and no `return` which works in the inputProxy.
                    // the hack works by replacing the character with an "x" then allowing the browser
                    // (or Google Docs) to handle the backspace which immediately removes the "x".
                    editor.endComposition("x");
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
                    editor.deselect();
                    compositor.reset();
                }

                return true;
            }

            const jamo = key.shift && event.shiftKey ? key.shift : key.normal;

            if (!isHangul(jamo)) {
                if (compositor.isCompositing()) {
                    editor.endComposition(compositor.getCurrent());
                    compositor.reset();
                }

                return true;
            }

            const block = compositor.addJamo(jamo);

            if (block.completed) {
                editor.endComposition(block.completed);
            }

            if (block.inProgress) {
                editor.updateComposition(block.inProgress);
                notifyChange();
            }

            event.preventDefault();
            return false;
        },
        blur: () => {
            if (!isActive) return;

            compositor.reset();
            editor.blur();
        },
        mousedown: () => {
            if (!isActive) return;

            compositor.reset();
            editor.blur();
        }
    };

    /** @type {{target:EventTarget,type:string,listener:EventListener}[]} */
    const listeners = [];
    Object.keys(eventHandlers).forEach(type =>
        addListener(editor.getListenerTarget(type), type, eventHandlers[type])
    );

    function activate () {
        isActive = true;
    }

    function deactivate ()  {
        if (compositor.isCompositing()) {
            compositor.reset();
            editor.deselect();
        }
        
        isActive = false;
    }

    function addListener (/** @type {EventTarget} */ target, /** @type {string} */ type, /** @type {EventListener} */ listener) {
        target.addEventListener(type, listener, true);
        listeners.push({ target, type, listener });
    }
}
