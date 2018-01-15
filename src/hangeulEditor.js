// Copyright © 2009-2018 Vincent McNabb

// Hangeul Editor
// Created: 29 May 2009 

// Romanization
// Created: 9 April 2012

import { hangeulMaps as maps } from "./mappings.js";
import { Block, Compositor } from "./composition.js";
import { SelectionEditorFactory } from "./selectionEditorFactory.js";

const keyCodes = Object.freeze({
    A: 65,
    Z: 90,
    Backspace: 8,
    Shift: 16,
    Ctrl: 17,
    Alt: 18
});

/**
 * @param {HTMLElement} element 
 */
export function HangeulEditor (element) {
    let isActive = false;
    const compositor = new Compositor();
    const editor = SelectionEditorFactory.createSelectionEditor(element);

    this.activate = activate;
    this.deactivate = deactivate;
    this.isActive = () => isActive;

    const eventHandlers = {
        keypress: event => {
            const charCode = event.charCode || event.keyCode;

            // allow combinations like "Ctrl+V" to work
            if (!charCode || event.ctrlKey) return true;

            const jamo = maps.qwertyHangeul[String.fromCharCode(charCode)];
            if (!jamo) {
                if (compositor.isCompositing()) {
                    editor.deselect();
                    compositor.reset();
                }
                return true;
            }

            const r = compositor.addJamo(jamo);

            if (r.completed) {
                editor.insert(r.completed);
            }

            if (r.inProgress) {
                editor.replace(r.inProgress);
            }

            event.preventDefault();
            return false;
        },
        keyup: event => {
            // hack to workaround Gmail compose from deselecting the
            // block when it is the first character in an email.
            editor.restore();
        },
        keydown: event => {
            const keycode = event.keyCode;

            if (!compositor.isCompositing()) {
                if (event.shiftKey && keycode === keyCodes.Backspace) {
                    const char = editor.selectPreviousCharacter();
                    compositor.setCharacter(char);

                } else {
                    // we're not editing a block.
                    return true;
                }
            }
            
            if (keycode >= keyCodes.A && keycode <= keyCodes.Z || keycode >= keyCodes.Shift && keycode <= keyCodes.Alt) {
                // this key doesn't effect editing the block, or is
                // part of editing the block.
                return true; 
                
            } else if (keycode == keyCodes.Backspace) { // backspace
                const block = compositor.removeLastJamo();
                if (block) {
                    editor.replace(block);
                    event.preventDefault();
                    return false;

                } else {
                    return true;
                }
                
            } else {
                // cancel the edit and allow character to be inserted
                compositor.reset();
                editor.deselect();
                return true;        
            }
        },
        blur: () => compositor.reset(),
        mousedown: () => compositor.reset()
    };
    const listeners = [];

    function activate () {
        if (isActive) return false;

        Object.keys(eventHandlers).forEach(key =>
            addListener(key, eventHandlers[key])
        );

        return isActive = true;
    };

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
    };

    function addListener (event, fn) {
        element.addEventListener(event, fn, true);
        listeners.push({ event, fn });
    }
};
