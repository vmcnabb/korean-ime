import { HangulImeController } from "../composition/hangul-ime-controller";
import { KoreanKeyboardMode } from "../extension-state/korean-keyboard-mode";
import { CompositionAdapterFactory } from "../composition/composition-adapter-factory";
import { isHangulOrJamo } from "../composition/hangul-maps";
import { KeyCode } from "../keyboard/korean-keyboard-map";
import { SupportedCompositionFeatures } from "../composition/composition-adapters/composition-adapter-interface";

const nonTextInputTypes = ["button", "checkbox", "file", "hidden", "image", "radio", "range", "submit", "password"];
const inputSelector = `input:not(${nonTextInputTypes.map((t) => `[type=${t}]`).join(",")})`;
// Match any element whose contenteditable attribute makes it editable. The
// attribute is an enumerated one — "", "true" and "plaintext-only" all enable
// editing — so we can't look only for [contenteditable=true]; we instead match
// the attribute when it isn't explicitly "false".
export const textInputElementsSelector = `[contenteditable]:not([contenteditable=false]),textarea,${inputSelector}`;

export class TextInputManager {
    private imeControllers = new Map<HTMLElement, HangulImeController>();
    private textEntryMode: KoreanKeyboardMode = KoreanKeyboardMode.English;
    private removalObserver?: MutationObserver;

    public setMode(mode: KoreanKeyboardMode) {
        this.textEntryMode = mode;

        for (const controller of this.imeControllers.values()) {
            if (this.textEntryMode == KoreanKeyboardMode.Hangul) {
                controller.activate();
            } else {
                controller.deactivate();
            }
        }
    }

    public setActiveElement(element: HTMLElement): SupportedCompositionFeatures | undefined {
        // check if element matches the selector `textInputElementsSelector`
        if (element.matches(textInputElementsSelector)) {
            return this.ensureController(element).getCompositionFeatures();
        }
        return;
    }

    // Insert text at the caret in the active editable, replacing any selection.
    // Driven by the InsertTextAfterSelection service message (routed from the
    // content-script controller).
    public insertTextAfterSelection(text: string) {
        const element = this.getActiveElement(document);

        if (!element) {
            return;
        }

        const compositionAdapter = CompositionAdapterFactory.createCompositionAdapter(element);

        if (!compositionAdapter) {
            return;
        }

        // todo: implement an insertAfter method in the composition adapter
        compositionAdapter.collapseSelection();
        compositionAdapter.beginComposition(text, KeyCode.KeyK); // KeyK is arbitrary
        compositionAdapter.updateComposition(text, KeyCode.KeyK); // KeyK is arbitrary
        compositionAdapter.endComposition(text);
    }

    public enterCharacter(char: string, keyCode: KeyCode): boolean {
        const activeElement = this.getActiveElement(document);
        if (!activeElement) {
            return false;
        }

        const imeController = this.ensureController(activeElement);

        if (isHangulOrJamo(char)) {
            imeController.addJamo(char, keyCode);
        } else {
            if (KeyCode.Backspace === keyCode) {
                imeController.handleBackspace();
            } else {
                imeController.addCharacter(char, keyCode);
            }
        }

        return true;
    }

    /**
     * Get (creating if necessary) the IME controller for an element, with its
     * active state synced to the current text-entry mode. This is the single
     * place that creates controllers; `getActiveElement` stays a pure query.
     */
    private ensureController(element: HTMLElement): HangulImeController {
        let imeController = this.imeControllers.get(element);

        if (!imeController) {
            imeController = new HangulImeController(element);
            this.imeControllers.set(element, imeController);
            this.watchForRemoval();
        }

        const isHangulMode = this.textEntryMode === KoreanKeyboardMode.Hangul;
        if (imeController.isActive != isHangulMode) {
            if (isHangulMode) {
                imeController.activate();
            } else {
                imeController.deactivate();
            }
        }

        return imeController;
    }

    // An element that leaves the DOM keeps its IME controller alive via this
    // Map, and the controller holds listeners (some on `document`) that wouldn't
    // be garbage-collected with the element. Watch for removals and tear those
    // down. One observer per content-script frame, started lazily on first use.
    private watchForRemoval() {
        if (this.removalObserver) {
            return;
        }
        this.removalObserver = new MutationObserver(() => this.disposeDisconnectedControllers());
        this.removalObserver.observe(document.documentElement, { childList: true, subtree: true });
    }

    private disposeDisconnectedControllers() {
        for (const [element, controller] of this.imeControllers) {
            if (!element.isConnected) {
                controller.dispose();
                this.imeControllers.delete(element);
            }
        }
    }

    /**
     * Pure query: find the focused editable element, descending into same-origin
     * iframes/objects. Returns null if there's no match (or a cross-origin
     * boundary blocks the walk). Creates nothing — controller creation is the
     * caller's job via `ensureController`.
     */
    private getActiveElement(document: Document): HTMLElement | null {
        const isActiveElementInChildDocument =
            document.activeElement &&
            this.isObjectOrIframe(document.activeElement) &&
            document.activeElement.contentDocument;

        let element = null as Element | null;

        if (isActiveElementInChildDocument) {
            try {
                element = this.getActiveElement(document.activeElement.contentDocument);
            } catch (e) {
                if (e instanceof DOMException && e.name === "SecurityError") {
                    // The document is from a different origin
                    return null;
                }
            }
        } else {
            element = document.activeElement;
        }

        if (element instanceof HTMLElement && element.matches(textInputElementsSelector)) {
            return element;
        }

        return null;
    }

    private isObjectOrIframe(element: Element): element is HTMLObjectElement | HTMLIFrameElement {
        return element instanceof HTMLObjectElement || element instanceof HTMLIFrameElement;
    }
}
