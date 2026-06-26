import { isKimeEvent } from "../messaging/dom-events";
import { CompositionAdapter } from "./composition-adapters/composition-adapter";
import { HangulController } from "./hangul-controller";
import { HanjaCandidateController } from "./hanja/hanja-candidate-controller";

export type KeyConsumer = (event: KeyboardEvent) => boolean;

export type KeyObserver = {
    keydown?: (event: KeyboardEvent) => boolean;
    keyup?: (event: KeyboardEvent) => boolean;
};

type ActiveCompositionRoute = {
    element: HTMLElement;
    hangul: HangulController;
    hanja: HanjaCandidateController;
};

/**
 * Frame-level physical-key dispatcher. It is the single content-script/page
 * runtime attach point for keydown/keyup; domain owners inject consumers and
 * observers so the ordering is visible here.
 *
 * Consumers return true to stop KeyListener's dispatch chain. Each consumer is
 * responsible for applying exactly the DOM cancellation it needs; this preserves
 * modifier-only Han/Yong toggle keys, which prevent the browser menu but still
 * propagate to composition so the held modifier can be tracked.
 *
 * Observers are passive side-effect hooks. Their return value is ignored and
 * they must never consume the event.
 */
export class KeyListener {
    private readonly eventListeners: {
        target: EventTarget;
        type: string;
        listener: EventListener;
        capture: boolean;
    }[] = [];
    private activeListeners: {
        target: EventTarget;
        type: string;
        listener: EventListener;
        capture: boolean;
    }[] = [];
    private activeRoute?: ActiveCompositionRoute;
    private toggleKeydownConsumer?: KeyConsumer;
    private toggleKeyupConsumer?: KeyConsumer;
    private readonly observers = new Map<string, KeyObserver>();

    constructor() {
        // A single target/phase for physical keys: window capture, so KIME runs
        // ahead of rich editors that otherwise act on keys before the editable's
        // own key handling gets a chance.
        this.addListener(window, "keydown", this.keydown as EventListener, true);
        this.addListener(window, "keyup", this.keyup as EventListener, true);
    }

    /**
     * Compatibility helper for non-content-script pages that use one fixed
     * editable (the romanization popup). Content scripts should create one
     * KeyListener for the frame and call setActiveCompositionRoute as focus moves.
     */
    static forElement(
        element: HTMLElement,
        compositionAdapter: CompositionAdapter,
        hangul: HangulController,
        hanja: HanjaCandidateController
    ): KeyListener {
        const listener = new KeyListener();
        listener.setActiveCompositionRoute(element, compositionAdapter, hangul, hanja);
        return listener;
    }

    setActiveCompositionRoute(
        element: HTMLElement,
        compositionAdapter: CompositionAdapter,
        hangul: HangulController,
        hanja: HanjaCandidateController
    ): void {
        this.clearActiveCompositionRoute();
        this.activeRoute = { element, hangul, hanja };

        this.addActiveListener(compositionAdapter.getListenerTarget("blur"), "blur", this.blur as EventListener);
        this.addActiveListener(
            compositionAdapter.getListenerTarget("mousedown"),
            "mousedown",
            this.mousedown as EventListener
        );
    }

    clearActiveCompositionRoute(): void {
        for (const { target, type, listener, capture } of this.activeListeners) {
            target.removeEventListener(type, listener, capture);
        }
        this.activeListeners = [];
        this.activeRoute = undefined;
    }

    setToggleConsumers(consumers: { keydown?: KeyConsumer; keyup?: KeyConsumer }): void {
        this.toggleKeydownConsumer = consumers.keydown;
        this.toggleKeyupConsumer = consumers.keyup;
    }

    setObserver(name: string, observer: KeyObserver | undefined): void {
        if (observer) {
            this.observers.set(name, observer);
        } else {
            this.observers.delete(name);
        }
    }

    /**
     * Tears down the frame-level key listeners plus the active route's blur and
     * mousedown listeners. Controller disposal remains owned by the component that
     * created those controllers.
     */
    dispose(): void {
        this.clearActiveCompositionRoute();
        for (const { target, type, listener, capture } of this.eventListeners) {
            target.removeEventListener(type, listener, capture);
        }
        this.eventListeners.length = 0;
        this.observers.clear();
    }

    private keydown = (event: KeyboardEvent): void => {
        if (isKimeEvent(event)) {
            return;
        }

        try {
            this.dispatchKeydown(event);
        } finally {
            this.notifyObservers("keydown", event);
        }
    };

    private keyup = (event: KeyboardEvent): void => {
        if (isKimeEvent(event)) {
            return;
        }

        try {
            this.toggleKeyupConsumer?.(event);
        } finally {
            this.notifyObservers("keyup", event);
        }
    };

    private dispatchKeydown(event: KeyboardEvent): void {
        const activeRoute = this.routeForEvent(event);

        // 1. Open Hanja candidate windows get first claim.
        if (activeRoute?.hanja.handleKey(event)) {
            return;
        }

        // 2. Hanja conversion key commits any in-progress Hangul first.
        if (activeRoute?.hanja.isConversionKey(event)) {
            activeRoute.hangul.endComposition();
            activeRoute.hanja.startConversion(event);
            return;
        }

        // 3. Han/Yong toggle runs before ordinary composition so printable
        // combos like Alt+S toggle instead of being inserted/composed.
        if (this.toggleKeydownConsumer?.(event)) {
            return;
        }

        // 4. Composition is last. If the event is outside the active editable,
        // do not route it to stale handlers.
        if (activeRoute) {
            activeRoute.hanja.cancelPendingLookup();
            activeRoute.hangul.handleKey(event);
        }
    }

    private blur = (): void => {
        // Only flush Hangul composition; deliberately leave an open Hanja candidate
        // window alone (see #206). Incidental focus loss — Tab away, switching
        // apps/tabs, or a focus shift caused by opening the window itself — should
        // not dismiss it. A deliberate mousedown elsewhere still closes it, as do a
        // focus change to another field, a mode toggle, and disposal.
        this.activeRoute?.hangul.flushComposition();
    };

    private mousedown = (): void => {
        this.activeRoute?.hanja.cancelPendingLookup();
        this.activeRoute?.hanja.close();
        this.activeRoute?.hangul.flushComposition();
    };

    private addListener(target: EventTarget, type: string, listener: EventListener, capture = false) {
        target.addEventListener(type, listener, capture);
        this.eventListeners.push({ target, type, listener, capture });
    }

    private addActiveListener(target: EventTarget, type: string, listener: EventListener, capture = false) {
        target.addEventListener(type, listener, capture);
        this.activeListeners.push({ target, type, listener, capture });
    }

    private notifyObservers(type: keyof KeyObserver, event: KeyboardEvent): void {
        for (const observer of this.observers.values()) {
            observer[type]?.(event);
        }
    }

    private routeForEvent(event: KeyboardEvent): ActiveCompositionRoute | undefined {
        const activeRoute = this.activeRoute;
        if (!activeRoute || !this.eventTargetsActiveElement(event, activeRoute.element)) {
            return undefined;
        }
        return activeRoute;
    }

    private eventTargetsActiveElement(event: KeyboardEvent, element: HTMLElement): boolean {
        if (event.composedPath().includes(element)) {
            return true;
        }

        const target = event.target;
        return target instanceof Node && (target === element || element.contains(target));
    }
}
