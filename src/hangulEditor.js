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
    const editor = CompositionProxyFactory.createSelectionEditor(element);

    this.activate = activate;
    this.deactivate = deactivate;
    this.isActive = () => isActive;

    var self = this;

    function notifyChange() {
        if (self.onentry) {
            self.onentry();
        }
    }

    const eventHandlers = {
        keydown: (/** @type {KeyboardEvent} */ event) => {
            const code = event.code;
            const key = maps.keyboardMap[code];

            if (code === "Backspace" && compositor.isCompositing()) {
                const block = compositor.removeLastJamo();
                if (block) {
                    editor.updateComposition(block);

                } else {
                    editor.endComposition("");
                }
                notifyChange();

                event.preventDefault();
                event.stopPropagation();
                return false;
            }

            // ignore modifier keys
            if (["Shift", "Control", "Alt"].includes(event.key)) {
                return true;
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
            compositor.reset();
            editor.blur();
        },
        mousedown: () => {
            compositor.reset();
            editor.blur();
        }
    };
    const listeners = [];

    function activate () {
        if (isActive) return false;

        Object.keys(eventHandlers).forEach(key =>
            addListener(key, eventHandlers[key])
        );

        isActive = true;
        return true;
    }

    function deactivate ()  {
        if (!element) return false;

        if (compositor.isCompositing()) {
            compositor.reset();
            editor.deselect();
        }
        
        while (listeners.length) {
            let listener = listeners.pop();
            element.removeEventListener(listener.event, listener.fn, true);
        }

        isActive = false;
        return true;
    }

    function addListener (event, fn) {
        element.addEventListener(event, fn, true);
        listeners.push({ event, fn });
    }
}
