import { HangulController } from "../composition/hangul-controller";
import { HanjaCandidateController, HanjaImeOptions } from "../composition/hanja/hanja-candidate-controller";
import { KeyListener } from "../composition/key-listener";
import { KoreanKeyboardMode } from "../extension-state/korean-keyboard-mode";
import { CompositionAdapterFactory } from "../composition/composition-adapter-factory";
import { isHangulOrJamo } from "../composition/hangul-maps";
import { KeyCode } from "../keyboard/korean-keyboard-map";
import { KeyBinding, defaultToggleKeyBindingForPlatform } from "../keyboard/key-binding";
import { SupportedCompositionFeatures } from "../composition/composition-adapters/composition-adapter-interface";
import { HanjaDictionaryProvider, StaticHanjaDictionaryProvider } from "../composition/hanja/hanja-dictionary-provider";

const nonTextInputTypes = ["button", "checkbox", "file", "hidden", "image", "radio", "range", "submit", "password"];
const inputSelector = `input:not(${nonTextInputTypes.map((t) => `[type=${t}]`).join(",")})`;
// Match any element whose contenteditable attribute makes it editable. The
// attribute is an enumerated one — "", "true" and "plaintext-only" all enable
// editing — so we can't look only for [contenteditable=true]; we instead match
// the attribute when it isn't explicitly "false".
export const textInputElementsSelector = `[contenteditable]:not([contenteditable=false]),textarea,${inputSelector}`;

export class TextInputManager {
    private targetElement?: HTMLElement;
    private hangulController?: HangulController;
    private hanjaController?: HanjaCandidateController;
    private keyListener?: KeyListener;
    private textEntryMode: KoreanKeyboardMode = KoreanKeyboardMode.English;
    // The configured Han/Yong toggle key, kept here so it survives controller
    // recreation on focus change and is applied to each new controller. Defaults to
    // the platform default until the content script pushes the user's binding.
    private toggleKeyBinding: KeyBinding | null = defaultToggleKeyBindingForPlatform();
    private hanjaOptions: Partial<HanjaImeOptions> = {};

    constructor(
        private readonly hanjaDictionaryProvider: HanjaDictionaryProvider = new StaticHanjaDictionaryProvider()
    ) {}

    public setMode(mode: KoreanKeyboardMode) {
        this.textEntryMode = mode;

        this.syncControllerMode();
    }

    /**
     * Set the configured Han/Yong toggle key (null when turned off). Stored so it
     * applies to controllers created later (on focus change) and forwarded to the
     * live controller so a rebind takes effect immediately.
     */
    public setToggleKeyBinding(binding: KeyBinding | null) {
        this.toggleKeyBinding = binding;
        this.hangulController?.setToggleKeyBinding(binding);
    }

    public setHanjaOptions(options: Partial<HanjaImeOptions>) {
        this.hanjaOptions = { ...this.hanjaOptions, ...options };
        this.hanjaController?.setOptions(this.hanjaOptions);
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

        const hangulController = this.tryGetOrCreateController(activeElement);
        if (!hangulController) {
            return false;
        }

        if (isHangulOrJamo(char)) {
            hangulController.addJamo(char, keyCode);
        } else {
            if (KeyCode.Backspace === keyCode) {
                hangulController.handleBackspace();
            } else {
                hangulController.addCharacter(char, keyCode);
            }
        }

        return true;
    }

    /**
     * Get (creating if necessary) the single Hangul controller for the currently
     * focused element, with its active state synced to the current text-entry
     * mode. When focus moves, the previous listener/controllers are disposed and a new set
     * is created so only one window-capture listener and one handler set exist
     * at a time.
     */
    private tryGetOrCreateController(element: HTMLElement): HangulController | undefined {
        if (this.targetElement !== element) {
            this.clearActiveController();
            const compositionAdapter = CompositionAdapterFactory.createCompositionAdapter(element);
            if (!compositionAdapter) {
                return undefined;
            }
            this.targetElement = element;
            this.hangulController = new HangulController(compositionAdapter);
            this.hanjaController = new HanjaCandidateController(
                element,
                compositionAdapter,
                this.hanjaDictionaryProvider,
                () => {},
                this.hanjaOptions
            );
            this.keyListener = new KeyListener(compositionAdapter, this.hangulController, this.hanjaController);
            this.hangulController.setToggleKeyBinding(this.toggleKeyBinding);
        }

        this.syncControllerMode();
        return this.hangulController;
    }

    private syncControllerMode() {
        const hangulController = this.hangulController;
        if (!hangulController) {
            return;
        }

        const isHangulMode = this.textEntryMode === KoreanKeyboardMode.Hangul;
        if (hangulController.isActive === isHangulMode) {
            return;
        }

        if (isHangulMode) {
            hangulController.activate();
        } else {
            this.hanjaController?.cancelPendingLookup();
            this.hanjaController?.close();
            hangulController.deactivate();
        }
    }

    private clearActiveController() {
        this.keyListener?.dispose();
        this.keyListener = undefined;
        this.hanjaController = undefined;
        this.hangulController = undefined;
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
