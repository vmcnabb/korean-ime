import { isKimeEvent } from "../messaging/dom-events";
import { isModifierKey, isModifierKeyActive, KeyCode, keyMap } from "../keyboard/korean-keyboard-map";
import {
    KeyBinding,
    defaultToggleKeyBindingForPlatform,
    isModifierOnlyBinding,
    matchesKeyBinding,
} from "../keyboard/key-binding";
import { HangulCompositor } from "./hangul-compositor";
import { CompositionAdapterFactory } from "./composition-adapter-factory";
import { CompositionAdapter } from "./composition-adapters/composition-adapter";
import { HanjaCandidatePager } from "./hanja/hanja-candidate-pager";
import {
    HanjaCandidateDisplayOptions,
    HanjaCandidateWindow,
    HanjaCandidateWindowPage,
} from "./hanja/hanja-candidate-window";
import { HanjaCompositionOverlay } from "./hanja/hanja-composition-overlay";
import { commitHanjaCandidate, getHanjaConversionTarget, HanjaConversionTarget } from "./hanja/hanja-converter";
import { HanjaCandidate } from "./hanja/hanja-candidate";
import { HanjaDictionaryProvider, StaticHanjaDictionaryProvider } from "./hanja/hanja-dictionary-provider";
import { defaultHanjaKeyBindingForPlatform } from "./hanja/hanja-key";

type HanjaCandidateSelection = {
    target: HanjaConversionTarget;
    pager: HanjaCandidatePager<HanjaCandidate>;
    overlay: HanjaCompositionOverlay;
    window: HanjaCandidateWindow;
};

export type HanjaImeOptions = {
    enabled: boolean;
    keyBinding: KeyBinding | null;
    showSimplified: boolean;
    showPinyin: boolean;
};

function defaultHanjaImeOptions(): HanjaImeOptions {
    return {
        enabled: true,
        keyBinding: defaultHanjaKeyBindingForPlatform(),
        showSimplified: true,
        showPinyin: true,
    };
}

/**
 * Controls the Hangul IME for a given element.
 * @param {HTMLElement} element
 */
export class HangulImeController {
    private _isActive = false;
    private compositor = new HangulCompositor();
    private compositionAdapter: CompositionAdapter;
    private hanjaCandidateSelection?: HanjaCandidateSelection;
    private hanjaLookupGeneration = 0;
    private hanjaOptions: HanjaImeOptions;

    private changeListeners: (() => void)[] = [];
    private eventListeners: {
        target: EventTarget;
        type: string;
        listener: EventListener;
        capture: boolean;
    }[] = [];

    // The most recent modifier key pressed (any side). Combined with the event's live
    // modifier flags, this lets isToggleKeyHeld tell the configured toggle key apart
    // from its same-type sibling on the other side — `event.code` is the key pressed
    // now, and a flag like `metaKey` doesn't say which side is down.
    private lastModifierKey?: KeyCode = undefined;

    // The configured Han/Yong toggle key. When it's a modifier-only key (e.g. Right
    // Alt, or Right Command on macOS) and held down, it acts as the IME key rather
    // than a Ctrl/Cmd/Alt modifier. Defaults to the platform default; the content
    // script pushes the user's actual binding via setToggleKeyBinding.
    private toggleKeyBinding: KeyBinding | null = defaultToggleKeyBindingForPlatform();

    constructor(
        private readonly element: HTMLElement,
        compositionAdapter = CompositionAdapterFactory.createCompositionAdapter(element),
        private readonly hanjaDictionaryProvider: HanjaDictionaryProvider = new StaticHanjaDictionaryProvider(),
        hanjaOptions: Partial<HanjaImeOptions> = {}
    ) {
        if (!compositionAdapter) {
            throw new Error("Could not create composition adapter for element");
        }

        this.compositionAdapter = compositionAdapter;
        this.hanjaOptions = { ...defaultHanjaImeOptions(), ...hanjaOptions };

        // Backspace during composition must be intercepted in the *capture* phase, on
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

    get isActive() {
        return this._isActive;
    }

    onEntry(listener: () => void) {
        this.changeListeners.push(listener);
    }

    activate() {
        this._isActive = true;
    }

    deactivate() {
        this.invalidateHanjaLookup();
        this.closeHanjaCandidateSelection();

        if (this.compositor.isCompositing()) {
            // Ending the composition with the current value is the correct thing to do with Korean.
            // If we implement other languages, we may need to change this.
            this.compositionAdapter.endComposition(this.compositor.getCurrentChar());
            this.compositor.reset();
        }

        this._isActive = false;
    }

    /**
     * Tears down the controller and removes every event listener it registered.
     * Some listeners live on `document` (e.g. mousedown for contenteditable), so
     * without this the controller, its adapter, and listener targets would stay
     * retained after the element leaves the DOM.
     */
    dispose() {
        try {
            this.invalidateHanjaLookup();
            this.flushComposition();
        } finally {
            this.closeHanjaCandidateSelection();
            this._isActive = false;
            for (const { target, type, listener, capture } of this.eventListeners) {
                target.removeEventListener(type, listener, capture);
            }
            this.eventListeners = [];
            this.changeListeners = [];
        }
    }

    getCompositionFeatures() {
        return this.compositionAdapter.getSupportedMethods();
    }

    /**
     * Set the configured Han/Yong toggle key (or null when the user turned it off).
     * Pushed in by the content script so the controller knows which physical modifier
     * key currently acts as the IME key rather than a Ctrl/Cmd/Alt modifier.
     */
    setToggleKeyBinding(binding: KeyBinding | null) {
        this.toggleKeyBinding = binding;
    }

    setHanjaOptions(options: Partial<HanjaImeOptions>) {
        const previousDisplayOptions = this.hanjaCandidateDisplayOptions();
        this.hanjaOptions = { ...this.hanjaOptions, ...options };

        if (!this.hanjaOptions.enabled || !this.hanjaOptions.keyBinding) {
            this.invalidateHanjaLookup();
            this.closeHanjaCandidateSelection();
            return;
        }

        const nextDisplayOptions = this.hanjaCandidateDisplayOptions();
        if (
            previousDisplayOptions.showSimplified !== nextDisplayOptions.showSimplified ||
            previousDisplayOptions.showPinyin !== nextDisplayOptions.showPinyin
        ) {
            this.refreshHanjaCandidateWindow();
        }
    }

    private notifyOnEntry() {
        this.changeListeners.forEach((listener) => {
            try {
                listener();
            } catch (e) {
                console.error(e);
            }
        });
    }

    private eventHandlers = {
        keydown: (event: KeyboardEvent): void => {
            // don't process events that were generated by KIME
            if (isKimeEvent(event)) {
                return;
            }

            const code = event.code as KeyCode;

            if (this.hanjaCandidateSelection && this.handleHanjaCandidateSelectionKey(event)) {
                return;
            }

            if (this.hanjaCandidateSelection) {
                this.closeHanjaCandidateSelection();
            }

            if (
                process.env.KIME_ENABLE_HANJA === "true" &&
                this.hanjaOptions.enabled &&
                this.hanjaOptions.keyBinding &&
                matchesKeyBinding(event, this.hanjaOptions.keyBinding)
            ) {
                if (this.startHanjaCandidateSelection(event)) {
                    return;
                }
            }

            this.invalidateHanjaLookup();

            // Record the most recent modifier key (any side) and stop — modifier keys
            // aren't text. Tracking which one lets isToggleKeyHeld tell the configured
            // toggle key apart from its same-type sibling on the other side.
            if (isModifierKey(code)) {
                this.lastModifierKey = code;
                return;
            }

            if (!this._isActive) {
                // The on-screen keyboard may have a composition in progress even
                // though the physical keyboard is inactive (Hangul typing disabled).
                // A physical keystroke moves past it, so commit/clear it first —
                // otherwise the next OSK jamo would attach to a stale block.
                this.flushComposition();

                if (this.isToggleKeyHeld(event)) {
                    // The configured toggle key (e.g. Right Alt, or Right Command on
                    // macOS) is held: it's the IME key, not a modifier, so insert the
                    // character instead of letting the OS treat Alt/Cmd+key as a
                    // shortcut or menu trigger.
                    this.compositionAdapter.inputCharacter(event.key, code);
                    this.cancelEvent(event);
                    return;
                }

                return;
            }

            // Shift+Backspace lifts the previous character back into composition.
            // Normally already handled in the capture phase (see keydownCaptureGuard);
            // this is the fallback for when the capture listener didn't run (a detached
            // element, as in unit tests).
            const reqPrevCharComposition =
                !this.compositor.isCompositing() && event.shiftKey && code === KeyCode.Backspace;

            if (reqPrevCharComposition && this.handlePreviousCharComposition(event)) {
                return;
            }

            const key = keyMap[code];
            // event.key is a single character for printable keys, but a multi-character name
            // for functional keys ("Tab", "Enter", "CapsLock", …). keyMap lists those so the
            // on-screen keyboard can label them — but they must never be inserted as text, so
            // only single-character keys are treated as input below.
            const isCharacterKey = event.key.length === 1;

            // Normally already handled in the capture phase (see keydownCaptureGuard);
            // this remains as a fallback for cases where the capture listener didn't
            // run (e.g. an element detached from the document, as in unit tests).
            if (code === KeyCode.Backspace && this.compositor.isCompositing()) {
                this.handleComposingBackspace(event);
                return;
            }

            // don't interfere with shortcuts, functional keys (Tab, Enter, …), or keys we
            // don't understand — commit any in-progress composition and let the browser
            // handle them natively
            if (!key || this.isShortcutChord(event) || !isCharacterKey) {
                if (this.compositor.isCompositing()) {
                    this.compositionAdapter.endComposition(this.compositor.getCurrentChar());
                    this.compositor.reset();
                }

                return;
            }

            if (!key.jamo) {
                if (!this.compositor.isCompositing()) {
                    return;
                }

                this.compositionAdapter.endComposition(this.compositor.getCurrentChar());
                this.compositor.reset();

                // CKEditor throws errors and the character is not inputted unless we add this timeout.
                window.setTimeout(() => {
                    this.compositionAdapter.inputCharacter(event.key, code);
                }, 0);

                event.preventDefault();
                event.stopImmediatePropagation();
                event.stopPropagation();
                return;
            }

            // Fallback for when the capture guard didn't run (no selection to replace,
            // or a detached element as in unit tests). On a connected element with a
            // selection the guard already handled this jamo and stopped the event.
            this.handleJamoKey(event);
        },
        blur: () => {
            this.flushComposition();
        },
        mousedown: () => {
            this.invalidateHanjaLookup();
            this.flushComposition();
        },
    };

    /**
     * Capture-phase keydown guard, registered on window so it runs before any page
     * handler. It intercepts the two cases where a rich editor (Word for the Web)
     * acts on a key in its own capture-phase handler before our bubble handler can
     * run — see the note in the constructor:
     *
     *   1. Backspace while composing: the editor deletes the whole composing block.
     *   2. The composition-starting jamo while text is selected: the editor replaces
     *      the selection with the key's literal character ("type over selection").
     *
     * Everything else is left to the bubble-phase handler.
     */
    private keydownCaptureGuard = (event: KeyboardEvent): void => {
        if (isKimeEvent(event) || !this._isActive) {
            return;
        }

        if (this.hanjaCandidateSelection && this.handleHanjaCandidateSelectionKey(event)) {
            return;
        }

        if (this.hanjaCandidateSelection) {
            this.closeHanjaCandidateSelection();
            return;
        }

        const code = event.code as KeyCode;

        if (code === KeyCode.Backspace) {
            if (this.compositor.isCompositing()) {
                this.handleComposingBackspace(event);
            } else if (event.shiftKey) {
                // Shift+Backspace must run here, ahead of the editor deleting the
                // previous character itself — otherwise getPreviousCharacter() returns
                // the character *before* the one the editor just removed, and we lift
                // the wrong one into composition.
                this.handlePreviousCharComposition(event);
            }
            // A plain (non-shift) Backspace while not composing is left to the editor.
            return;
        }

        // Begin composition ahead of the editor's "type over selection" only when
        // there's a real, non-collapsed document selection to replace. The
        // no-selection path and plain <input> elements (whose selection isn't a
        // document selection) stay on the bubble handler, unchanged.
        if (!this.compositor.isCompositing() && this.isJamoKey(event) && this.hasNonCollapsedSelection()) {
            this.handleJamoKey(event);
        }
    };

    private isJamoKey(event: KeyboardEvent): boolean {
        const code = event.code as KeyCode;
        return !this.isShortcutChord(event) && event.key.length === 1 && !!keyMap[code]?.jamo;
    }

    /**
     * Whether the configured Han/Yong toggle key is a modifier-only key that is
     * currently held. When true, that key is acting as the IME key, not as a
     * Ctrl/Cmd/Alt modifier, so a letter pressed with it should be composed/typed
     * rather than treated as a browser shortcut. We require both that the toggle key
     * was the last modifier pressed (so it's that side, not its sibling) and that its
     * modifier flag is still down (so it wasn't already released).
     */
    private isToggleKeyHeld(event: KeyboardEvent): boolean {
        const binding = this.toggleKeyBinding;
        if (!binding || !isModifierOnlyBinding(binding)) {
            return false;
        }
        return this.lastModifierKey === binding.code && isModifierKeyActive(event, binding.code);
    }

    /**
     * Whether the event is a browser/OS shortcut chord the IME must not consume: a
     * Ctrl/Cmd modifier is held and it isn't the toggle key being held (which would
     * make it the IME key, not a modifier — see isToggleKeyHeld).
     */
    private isShortcutChord(event: KeyboardEvent): boolean {
        return hasShortcutModifier(event) && !this.isToggleKeyHeld(event);
    }

    private hasNonCollapsedSelection(): boolean {
        const selection = document.getSelection();
        return !!selection && selection.rangeCount > 0 && !selection.getRangeAt(0).collapsed;
    }

    /**
     * Shift+Backspace: lift the character before the caret back into composition so
     * its last jamo can be edited. Deletes the character and re-enters composition
     * with it. Returns false (handling nothing) when the adapter can't read/delete
     * the previous character or it isn't composable Hangul, so the caller can fall
     * through. Shared by the capture-phase guard (normal path) and the bubble handler.
     */
    private handlePreviousCharComposition(event: KeyboardEvent): boolean {
        if (!this.compositionAdapter.supportsMethods("getPreviousCharacter", "deleteContentBackwards")) {
            return false;
        }

        const character = this.compositionAdapter.getPreviousCharacter();
        if (!this.compositor.setCharacter(character)) {
            return false;
        }

        this.compositionAdapter.deleteContentBackwards();
        this.compositionAdapter.beginComposition(character!, KeyCode.Backspace);

        this.cancelEvent(event);
        return true;
    }

    /**
     * Process a jamo key: add it to the in-progress block and cancel the key so the
     * editor doesn't also act on it. Shared by the capture-phase guard (for the
     * composition-starting jamo over a selection) and the bubble-phase handler.
     */
    private handleJamoKey(event: KeyboardEvent): void {
        const code = event.code as KeyCode;
        const key = keyMap[code];
        if (!key?.jamo) {
            return;
        }

        const jamo = event.shiftKey && key.jamo.shift ? key.jamo.shift : key.jamo.normal;
        this.addJamo(jamo, code);

        this.cancelEvent(event);
    }

    /**
     * Backspace pressed mid-composition: drop the last jamo and re-render the now
     * shorter block, cancelling the key so the editor doesn't also act on it. If the
     * block is now empty, fall back to the long-standing contenteditable hack —
     * commit a throwaway "x" and let the editor's own Backspace delete it (so we
     * deliberately do NOT cancel the key in that case).
     *
     * Called from both the capture-phase guard (the normal path) and the bubble-phase
     * handler (fallback for detached elements); whichever runs first handles it, and
     * the other is skipped because the compositor is no longer compositing.
     */
    private handleComposingBackspace(event: KeyboardEvent): void {
        const block = this.compositor.removeLastJamo();
        if (block) {
            this.compositionAdapter.updateComposition(block, KeyCode.Backspace);
            this.notifyOnEntry();

            this.cancelEvent(event);
        } else {
            this.compositionAdapter.endComposition("x");
        }
    }

    private startHanjaCandidateSelection(event: KeyboardEvent): boolean {
        const target = getHanjaConversionTarget(this.compositor, this.compositionAdapter);
        if (!target) {
            return false;
        }

        this.closeHanjaCandidateSelection();
        const lookupGeneration = this.beginHanjaLookup();
        this.cancelEvent(event);

        if (target.kind === "composition") {
            this.compositionAdapter.endComposition(target.reading);
            this.compositor.reset();
        }

        const committedTarget: HanjaConversionTarget = {
            ...target,
            kind: "previous-character",
        };
        void this.openHanjaCandidateSelection(committedTarget, lookupGeneration);
        return true;
    }

    private async openHanjaCandidateSelection(target: HanjaConversionTarget, lookupGeneration: number): Promise<void> {
        let candidates: readonly HanjaCandidate[];
        try {
            candidates = await this.hanjaDictionaryProvider.lookup(target.reading);
        } catch (error) {
            console.error(error);
            return;
        }

        if (lookupGeneration !== this.hanjaLookupGeneration || candidates.length === 0 || !this._isActive) {
            return;
        }

        const overlay = new HanjaCompositionOverlay(this.element, this.compositionAdapter);
        const overlayRect = overlay.show(target.reading);
        const pager = new HanjaCandidatePager(candidates);
        this.hanjaCandidateSelection = {
            target,
            pager,
            overlay,
            window: new HanjaCandidateWindow(this.element, this.hanjaCandidatePage(pager), overlayRect, {
                onPreviousPage: () => this.moveHanjaCandidatePage(-1),
                onNextPage: () => this.moveHanjaCandidatePage(1),
                onMoveSelection: (delta) => this.moveHanjaCandidateSelection(delta),
                onSelectCandidate: (visibleIndex) => this.commitVisibleHanjaCandidate(visibleIndex, KeyCode.Lang2),
                displayOptions: this.hanjaCandidateDisplayOptions(),
            }),
        };
    }

    private handleHanjaCandidateSelectionKey(event: KeyboardEvent): boolean {
        const selection = this.hanjaCandidateSelection;
        if (!selection) {
            return false;
        }

        const numberedIndex = hanjaCandidateNumberIndex(event);
        const candidateIndex =
            numberedIndex === undefined ? undefined : selection.pager.selectByVisibleIndex(numberedIndex);
        if (candidateIndex !== undefined) {
            this.commitHanjaCandidate(candidateIndex, event.code as KeyCode);
            this.cancelEvent(event);
            return true;
        }

        switch (event.key) {
            case "ArrowDown":
                this.moveHanjaCandidateSelection(1);
                this.cancelEvent(event);
                return true;

            case "ArrowUp":
                this.moveHanjaCandidateSelection(-1);
                this.cancelEvent(event);
                return true;

            case "ArrowRight":
                this.moveHanjaCandidatePage(1);
                this.cancelEvent(event);
                return true;

            case "ArrowLeft":
                this.moveHanjaCandidatePage(-1);
                this.cancelEvent(event);
                return true;

            case "Enter":
                this.commitHanjaCandidate(selection.pager.selectedIndex, event.code as KeyCode);
                this.cancelEvent(event);
                return true;

            case "Escape":
                this.closeHanjaCandidateSelection();
                this.cancelEvent(event);
                return true;

            case "Backspace":
            case "Delete":
                this.closeHanjaCandidateSelection();
                this.cancelEvent(event);
                return true;

            default:
                return false;
        }
    }

    private moveHanjaCandidateSelection(delta: number): void {
        const selection = this.hanjaCandidateSelection;
        if (!selection) {
            return;
        }

        selection.pager.moveSelection(delta);
        this.refreshHanjaCandidateWindow();
    }

    private moveHanjaCandidatePage(delta: number): void {
        const selection = this.hanjaCandidateSelection;
        if (!selection) {
            return;
        }

        selection.pager.movePage(delta);
        this.refreshHanjaCandidateWindow();
    }

    private commitVisibleHanjaCandidate(visibleIndex: number, keyCode: KeyCode): void {
        const selection = this.hanjaCandidateSelection;
        if (!selection) {
            return;
        }

        const candidateIndex = selection.pager.selectByVisibleIndex(visibleIndex);
        if (candidateIndex === undefined) {
            return;
        }

        this.commitHanjaCandidate(candidateIndex, keyCode);
    }

    private commitHanjaCandidate(index: number, keyCode: KeyCode): void {
        const selection = this.hanjaCandidateSelection;
        if (!selection) {
            return;
        }

        const candidate = selection.pager.candidateAt(index);
        if (!candidate) {
            return;
        }

        this.closeHanjaCandidateSelection();
        commitHanjaCandidate(selection.target, candidate, this.compositor, this.compositionAdapter, keyCode);
        this.notifyOnEntry();
    }

    private hanjaCandidatePage(pager: HanjaCandidatePager<HanjaCandidate>): HanjaCandidateWindowPage {
        return {
            candidates: pager.visibleCandidates,
            selectedIndex: pager.selectedPageIndex,
            pageIndex: pager.pageIndex,
            pageCount: pager.pageCount,
        };
    }

    private hanjaCandidateDisplayOptions(): HanjaCandidateDisplayOptions {
        return {
            showSimplified: this.hanjaOptions.showSimplified,
            showPinyin: this.hanjaOptions.showPinyin,
        };
    }

    private refreshHanjaCandidateWindow(): void {
        const selection = this.hanjaCandidateSelection;
        if (!selection) {
            return;
        }

        selection.window.setDisplayOptions(this.hanjaCandidateDisplayOptions());
        selection.window.update(this.hanjaCandidatePage(selection.pager));
    }

    private closeHanjaCandidateSelection(): void {
        this.hanjaCandidateSelection?.overlay.remove();
        this.hanjaCandidateSelection?.window.remove();
        this.hanjaCandidateSelection = undefined;
    }

    private beginHanjaLookup(): number {
        this.hanjaLookupGeneration += 1;
        return this.hanjaLookupGeneration;
    }

    private invalidateHanjaLookup(): void {
        this.hanjaLookupGeneration += 1;
    }

    // Commit and clear any in-progress composition. Runs when the controller is
    // active, or whenever a composition is in progress even though inactive — the
    // on-screen keyboard can drive composition while the physical keyboard is
    // inactive (Hangul typing disabled), so a focus/caret change or a physical
    // keystroke must still flush it, or the next OSK jamo attaches to a stale block.
    private flushComposition() {
        this.closeHanjaCandidateSelection();

        if (!this._isActive && !this.compositor.isCompositing()) {
            return;
        }

        this.compositor.reset();
        this.compositionAdapter.blur();
    }

    /**
     * Add a non-Hangul character to the composition adapter.
     * This will end any current composition.
     * @param char
     */
    addCharacter(char: string, keyCode: KeyCode) {
        if (this.compositor.isCompositing()) {
            this.compositionAdapter.endComposition(this.compositor.getCurrentChar());
            this.compositor.reset();
        }

        this.compositionAdapter.inputCharacter(char, keyCode);
    }

    handleBackspace() {
        if (this.compositor.isCompositing()) {
            const block = this.compositor.removeLastJamo();
            if (block) {
                this.compositionAdapter.updateComposition(block, KeyCode.Backspace);
            } else {
                this.compositionAdapter.endComposition("");
            }

            this.notifyOnEntry();
        } else {
            this.compositionAdapter.deleteContentBackwards();
        }
    }

    addJamo(jamo: string, keyCode: KeyCode) {
        const compositionProgress = this.compositor.addJamo(jamo);

        if ("completed" in compositionProgress) {
            this.compositionAdapter.endComposition(compositionProgress.completed);
        }

        if ("started" in compositionProgress) {
            this.compositionAdapter.beginComposition(compositionProgress.started, keyCode);
        }

        if ("updated" in compositionProgress) {
            this.compositionAdapter.updateComposition(compositionProgress.updated, keyCode);
        }

        this.notifyOnEntry();
    }

    private addListener(target: EventTarget, type: string, listener: EventListener, capture = false) {
        target.addEventListener(type, listener, capture);
        this.eventListeners.push({ target, type, listener, capture });
    }

    private cancelEvent(event: KeyboardEvent): void {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
    }
}

/**
 * Whether a key event carries a shortcut modifier, meaning it's a browser/OS
 * shortcut (copy, paste, select-all, …) rather than text input — so the IME must
 * step aside and let the browser handle it. `ctrlKey` covers Ctrl shortcuts
 * (Windows/Linux); `metaKey` covers Command shortcuts (macOS). A modifier+letter
 * chord is never an intended jamo on any platform, so both bypass composition.
 */
function hasShortcutModifier(event: KeyboardEvent): boolean {
    return event.ctrlKey || event.metaKey;
}

function hanjaCandidateNumberIndex(event: KeyboardEvent): number | undefined {
    if (!/^[1-9]$/.test(event.key)) {
        return undefined;
    }

    return Number(event.key) - 1;
}
