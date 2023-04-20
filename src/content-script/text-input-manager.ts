import { KimeMessage } from "../messaging";
import { HangulImeController } from "../composition/hangul-ime-controller";
import { TextEntryMode } from "./text-entry-mode.t";
import { CompositionAdapterFactory } from "../composition/composition-adapter-factory";
import { isHangulCharacter } from "../mappings";
import { KeyCode } from "./on-screen-keyboard/korean-keyboard-map";

export class TextInputManager {
    private imeControllers = new Map<HTMLElement, HangulImeController>();
    private textEntryMode: TextEntryMode = TextEntryMode.English;
    private refreshTextInputElementsInterval: number | undefined;

    public messageHandlers = {
        insertAfter: (message: KimeMessage) => {
            const element = this.getActiveElement(document);

            if (!element) {
                return;
            }

            const compositionAdapter = CompositionAdapterFactory.createCompositionAdapter(element);

            if (!compositionAdapter) {
                return;
            }

            // todo: probably should implement an insertAfter method in the composition adapter
            compositionAdapter.deselect();
            compositionAdapter.updateComposition(message.data, KeyCode.KeyK); // KeyK is arbitrary
            compositionAdapter.deselect();
        },
    }

    public setMode(mode: TextEntryMode) {
        this.textEntryMode = mode;

        const self = this;

        if (this.refreshTextInputElementsInterval) {
            window.clearInterval(this.refreshTextInputElementsInterval);
            this.refreshTextInputElementsInterval = undefined;
        }

        if (this.textEntryMode == TextEntryMode.Hangul) {
            this.refreshTextInputElements();
            this.refreshTextInputElementsInterval = window.setInterval(function () {
                self.refreshTextInputElements();
            }, 400);

        } else {
            for (const controller of this.imeControllers.values()) {
                controller.deactivate();
            }
        }
    }

    public enterCharacter(char: string, keyCode: KeyCode) {
        const activeElement = this.getActiveElement(document);
        if (!activeElement) {
            return;
        }

        const imeController = this.imeControllers.get(activeElement);

        if (!imeController) {
            return;
        }

        if (isHangulCharacter(char)) {
            imeController.addJamo(char, keyCode);

        } else {
            if (char === "\b") {
                imeController.handleBackspace();
            } else {
                imeController.addCharacter(char, keyCode);
            }
        }
    }

    /**
     * Check for any new text input elements and attach an IME controller to them.
     * @param doc 
     * @returns 
     */
    private refreshTextInputElements() {
        const nonTextInputTypes = ["button", "checkbox", "file", "hidden", "image", "radio", "range", "submit"];
        const inputSelector = `input:not(${nonTextInputTypes.map(t => `[type=${t}]`).join(",")})`;
        const textInputElementsSelector = `[contenteditable=true],textarea,${inputSelector}`;

        const elements = document.querySelectorAll<HTMLElement>(textInputElementsSelector);
        for (const element of elements) {
            this.processElement(element);
        }

        return true;
    }

    private processElement(element: HTMLElement) {
        let imeController = this.imeControllers.get(element);

        if (!imeController) {
            imeController = new HangulImeController(element);
            this.imeControllers.set(element, imeController);
        }

        const isHangulMode = this.textEntryMode === TextEntryMode.Hangul;
        if (imeController.isActive() != isHangulMode) {
            if (isHangulMode) {
                imeController.activate();
            } else {
                imeController.deactivate();
            }
        }
    }

    private getActiveElement(document: Document): HTMLElement | null {
        const isActiveElementInChildDocument = document.activeElement
            && this.isObjectOrIframe(document.activeElement)
            && document.activeElement.contentDocument;

        let element = null as Element | null;
        
        if (isActiveElementInChildDocument) {
            try {
                element = this.getActiveElement(document.activeElement.contentDocument);
            } catch (e) {
                if (e instanceof DOMException && e.name === 'SecurityError') {
                    // The document is from a different origin
                    return null;
                }
            }

        } else {
            element = document.activeElement;
        }

        return element instanceof HTMLElement ? element : null;
    }

    private isObjectOrIframe(element: Element): element is HTMLObjectElement | HTMLIFrameElement {
        return element instanceof HTMLObjectElement || element instanceof HTMLIFrameElement;
    }
}
