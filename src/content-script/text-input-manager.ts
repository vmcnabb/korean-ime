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
    private targetElement?: HTMLElement;
    private imeController?: HangulImeController;
    private textEntryMode: KoreanKeyboardMode = KoreanKeyboardMode.English;

    public setMode(mode: KoreanKeyboardMode) {
        this.textEntryMode = mode;

        this.syncControllerMode();
    }

    public setActiveElement(element: EventTarget | null): SupportedCompositionFeatures | undefined {
        const activeElement = this.getTextInputElement(element) ?? this.getActiveElement(document);
        if (!activeElement) {
            this.clearActiveController();
            return;
        }

        return this.tryGetOrCreateController(activeElement)?.getCompositionFeatures();
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
            this.clearActiveController();
            return false;
        }

        const imeController = this.tryGetOrCreateController(activeElement);
        if (!imeController) {
            return false;
        }

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
     * Get (creating if necessary) the single IME controller for the currently
     * focused element, with its active state synced to the current text-entry
     * mode. When focus moves, the previous controller is disposed and a new one
     * is created so only one window-capture listener and one handler set exist
     * at a time.
     */
    private tryGetOrCreateController(element: HTMLElement): HangulImeController | undefined {
        if (this.targetElement !== element) {
            this.clearActiveController();
            const compositionAdapter = CompositionAdapterFactory.createCompositionAdapter(element);
            if (!compositionAdapter) {
                return undefined;
            }
            this.targetElement = element;
            this.imeController = new HangulImeController(element, compositionAdapter);
        }

        this.syncControllerMode();
        return this.imeController;
    }

    private syncControllerMode() {
        const imeController = this.imeController;
        if (!imeController) {
            return;
        }

        const isHangulMode = this.textEntryMode === KoreanKeyboardMode.Hangul;
        if (imeController.isActive === isHangulMode) {
            return;
        }

        if (isHangulMode) {
            imeController.activate();
        } else {
            imeController.deactivate();
        }
    }

    private clearActiveController() {
        this.imeController?.dispose();
        this.imeController = undefined;
        this.targetElement = undefined;
    }

    private getTextInputElement(element: EventTarget | null): HTMLElement | undefined {
        if (element instanceof HTMLElement && element.matches(textInputElementsSelector)) {
            return element;
        }
        return undefined;
    }

    /**
     * Pure query: find the focused editable element, descending into same-origin
     * iframes/objects. Returns null if there's no match (or a cross-origin
     * boundary blocks the walk). Creates nothing — controller creation is the
     * caller's job via `tryGetOrCreateController`.
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
