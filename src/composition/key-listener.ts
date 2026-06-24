import { isKimeEvent } from "../messaging/dom-events";
import { CompositionAdapter } from "./composition-adapters/composition-adapter";
import { HangulController } from "./hangul-controller";
import { HanjaCandidateController } from "./hanja/hanja-candidate-controller";

/**
 * Owns physical-key listener registration and routes each key to peer controllers.
 */
export class KeyListener {
    private eventListeners: {
        target: EventTarget;
        type: string;
        listener: EventListener;
        capture: boolean;
    }[] = [];

    constructor(
        compositionAdapter: CompositionAdapter,
        private readonly hangul: HangulController,
        private readonly hanja: HanjaCandidateController
    ) {
        // Backspace during composition must be intercepted in the capture phase, on
        // window (the earliest point in event propagation). Rich editors like Word for
        // the Web run their own Backspace handler before the event reaches us: because
        // our composition is synthetic, the real Backspace has isComposing=false, so
        // the editor treats it as a normal backspace and deletes the whole composing
        // block before our bubble-phase handler can stop it. Intercepting on window
        // capture puts us ahead of the editor so we can recompose and cancel the key.
        this.addListener(window, "keydown", this.keydownCaptureGuard as EventListener, true);

        Object.keys(this.eventHandlers).forEach((type) => {
            const key = type as keyof typeof this.eventHandlers;

            this.addListener(
                compositionAdapter.getListenerTarget(type),
                type,
                this.eventHandlers[key] as EventListener
            );
        });
    }

    /**
     * Tears down the listener and controller state it owns for the focused editor.
     * Some listeners live on `document` (e.g. mousedown for contenteditable), so
     * without this the controllers, their adapter, and listener targets would stay
     * retained after the element leaves the DOM.
     */
    dispose() {
        try {
            this.hanja.cancelPendingLookup();
            this.hanja.close();
            this.hangul.dispose();
        } finally {
            for (const { target, type, listener, capture } of this.eventListeners) {
                target.removeEventListener(type, listener, capture);
            }
            this.eventListeners = [];
        }
    }

    private eventHandlers = {
        keydown: (event: KeyboardEvent): void => {
            if (isKimeEvent(event)) {
                return;
            }

            if (this.hanja.handleKey(event)) {
                return;
            }

            if (this.hanja.isConversionKey(event)) {
                this.hangul.endComposition();
                this.hanja.startConversion(event);
                return;
            }

            this.hanja.cancelPendingLookup();
            this.hangul.handleKey(event);
        },
        blur: () => {
            // Only flush Hangul composition; deliberately leave an open Hanja candidate
            // window alone (see #206). Incidental focus loss — Tab away, switching
            // apps/tabs, or a focus shift caused by opening the window itself — should
            // not dismiss it. A deliberate mousedown elsewhere still closes it, as do a
            // focus change to another field, a mode toggle, and disposal.
            this.hangul.flushComposition();
        },
        mousedown: () => {
            this.hanja.cancelPendingLookup();
            this.hanja.close();
            this.hangul.flushComposition();
        },
    };

    /**
     * Capture-phase keydown guard, registered on window so it runs before any page
     * handler. The candidate window can be open regardless of Han/Yong mode, so it
     * gets first capture-phase handling. Everything else is delegated to Hangul's
     * capture-sensitive composition paths.
     */
    private keydownCaptureGuard = (event: KeyboardEvent): void => {
        if (isKimeEvent(event)) {
            return;
        }

        if (this.hanja.isOpen) {
            this.hanja.handleKey(event);
            return;
        }

        this.hangul.handleCaptureKey(event);
    };

    private addListener(target: EventTarget, type: string, listener: EventListener, capture = false) {
        target.addEventListener(type, listener, capture);
        this.eventListeners.push({ target, type, listener, capture });
    }
}
