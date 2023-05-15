import { HangulImeController } from "../../composition/hangul-ime-controller";
import { KoreanKeyboardMode } from "../../extension-state/korean-keyboard-mode";
import { CompositionAdapterFactory } from "../../composition/composition-adapter-factory";
import { isHangulCharacter } from "../../composition/hangul-maps";
import { KeyCode } from "../on-screen-keyboard/korean-keyboard-map";
import { SupportedCompositionFeatures } from "../../composition/composition-adapters/composition-adapter";
import {
    ContentScriptBroadcastAction,
    ContentScriptBroadcastMessage,
    isContentScriptBroadcastMessage,
} from "../../messaging/content-to-content-messages";
import {
    ServiceScriptMessage,
    ServiceScriptMessageAction,
    isServiceScriptMessage,
} from "../../messaging/service-to-content-messages";

const nonTextInputTypes = [
    "button",
    "checkbox",
    "file",
    "hidden",
    "image",
    "radio",
    "range",
    "submit",
    "password",
];
const inputSelector = `input:not(${nonTextInputTypes
    .map((t) => `[type=${t}]`)
    .join(",")})`;
const textInputElementsSelector = `[contenteditable=true],textarea,${inputSelector}`;

export class TextInputManager {
    private imeControllers = new Map<HTMLElement, HangulImeController>();
    private textEntryMode: KoreanKeyboardMode = KoreanKeyboardMode.English;

    public handleMessage(
        message: ContentScriptBroadcastMessage | ServiceScriptMessage
    ) {
        if (isContentScriptBroadcastMessage(message)) {
            this.handleBroadcast(message);
        } else if (isServiceScriptMessage(message)) {
            this.handleServiceScriptRequest(message);
        }
    }

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

    public setActiveElement(
        element: HTMLElement
    ): SupportedCompositionFeatures | undefined {
        // check if element matches the selector `textInputElementsSelector`
        if (element.matches(textInputElementsSelector)) {
            return this.processElement(element);
        }
        return;
    }

    private handleBroadcast(message: ContentScriptBroadcastMessage) {
        switch (message.action) {
            case ContentScriptBroadcastAction.SendKey:
                this.enterCharacter(message.data.key, message.data.keyCode);
                break;
        }
    }

    private handleServiceScriptRequest(message: ServiceScriptMessage) {
        switch (message.action) {
            case ServiceScriptMessageAction.InsertTextAfterSelection: {
                const element = this.getActiveElement(document);

                if (!element) {
                    return;
                }

                const compositionAdapter =
                    CompositionAdapterFactory.createCompositionAdapter(element);

                if (!compositionAdapter) {
                    return;
                }

                // todo: implement an insertAfter method in the composition adapter
                compositionAdapter.collapseSelection();
                compositionAdapter.beginComposition(message.data, KeyCode.KeyK); // KeyK is arbitrary
                compositionAdapter.updateComposition(
                    message.data,
                    KeyCode.KeyK
                ); // KeyK is arbitrary
                compositionAdapter.endComposition(message.data);
                break;
            }
        }
    }

    private enterCharacter(char: string, keyCode: KeyCode) {
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
            if (KeyCode.Backspace === keyCode) {
                imeController.handleBackspace();
            } else {
                imeController.addCharacter(char, keyCode);
            }
        }
    }

    private processElement(element: HTMLElement) {
        let imeController = this.imeControllers.get(element);

        if (!imeController) {
            imeController = new HangulImeController(element);
            this.imeControllers.set(element, imeController);
        }

        const isHangulMode = this.textEntryMode === KoreanKeyboardMode.Hangul;
        if (imeController.isActive != isHangulMode) {
            if (isHangulMode) {
                imeController.activate();
            } else {
                imeController.deactivate();
            }
        }

        return imeController.getCompositionFeatures();
    }

    private getActiveElement(document: Document): HTMLElement | null {
        const isActiveElementInChildDocument =
            document.activeElement &&
            this.isObjectOrIframe(document.activeElement) &&
            document.activeElement.contentDocument;

        let element = null as Element | null;

        if (isActiveElementInChildDocument) {
            try {
                element = this.getActiveElement(
                    document.activeElement.contentDocument
                );
            } catch (e) {
                if (e instanceof DOMException && e.name === "SecurityError") {
                    // The document is from a different origin
                    return null;
                }
            }
        } else {
            element = document.activeElement;
        }

        if (element instanceof HTMLElement) {
            this.processElement(element);
            return element;
        }

        return null;
    }

    private isObjectOrIframe(
        element: Element
    ): element is HTMLObjectElement | HTMLIFrameElement {
        return (
            element instanceof HTMLObjectElement ||
            element instanceof HTMLIFrameElement
        );
    }
}
