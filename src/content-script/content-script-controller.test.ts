import { ContentScriptController } from "./content-script-controller";
import { OnScreenKeyboardController } from "./on-screen-keyboard/on-screen-keyboard-controller";
import { TextInputManager } from "./text-input-manager";
import { KeyCode } from "../keyboard/korean-keyboard-map";
import { KeyBinding, defaultToggleKeyBinding } from "../keyboard/key-binding";
import { loadToggleKeyBinding } from "../settings/toggle-key-store";
import { loadHanjaKeyBinding } from "../settings/hanja-key-store";
import { KoreanKeyboardMode } from "../extension-state/korean-keyboard-mode";
import { ServiceScriptMessageAction } from "../messaging/service-to-content-messages";
import { ContentScriptRequestAction } from "../messaging/content-to-service-messages";

jest.mock("../composition/hanja/hanja-candidate-window.scss", () => ({}), { virtual: true });

jest.mock("../settings/settings-store", () => ({
    loadSettings: jest.fn().mockResolvedValue({ onScreenKeyboard: { layout: "full-us" } }),
}));

jest.mock("../settings/toggle-key-store", () => ({
    TOGGLE_KEY_STORAGE_KEY: "hanYongToggleKey",
    loadToggleKeyBinding: jest.fn(),
}));

jest.mock("../settings/hanja-key-store", () => ({
    HANJA_KEY_STORAGE_KEY: "hanjaConversionKey",
    loadHanjaKeyBinding: jest.fn(),
}));

jest.mock("./on-screen-keyboard/on-screen-keyboard-controller", () => ({
    OnScreenKeyboardController: jest.fn().mockImplementation(() => ({
        showKeyboard: jest.fn(),
        hideKeyboard: jest.fn(),
        applyPersistedLayout: jest.fn(),
        setLayout: jest.fn(),
        setHanYongEnabled: jest.fn(),
        setMode: jest.fn(),
        setCompositionFeatures: jest.fn(),
        handlePhysicalKeydown: jest.fn().mockReturnValue(false),
        handlePhysicalKeyup: jest.fn().mockReturnValue(false),
    })),
}));

// The most recently constructed (mocked) keyboard controller.
const lastOsk = () =>
    (OnScreenKeyboardController as unknown as jest.Mock).mock.results.at(-1)?.value as {
        showKeyboard: jest.Mock;
        hideKeyboard: jest.Mock;
        applyPersistedLayout: jest.Mock;
        setLayout: jest.Mock;
    };

const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0));

const altS: KeyBinding = { code: KeyCode.KeyS, ctrl: false, alt: true, shift: false, meta: false };

describe("ContentScriptController toggle-key handling", () => {
    let listeners: Array<(message: unknown) => void>;
    let sendMessage: jest.Mock;

    beforeEach(() => {
        listeners = [];
        sendMessage = jest.fn();
        Object.assign(globalThis, {
            chrome: {
                runtime: {
                    sendMessage,
                    onMessage: { addListener: (listener: (message: unknown) => void) => listeners.push(listener) },
                },
                // The controller watches storage for toggle-key changes.
                storage: { onChanged: { addListener: jest.fn() } },
            },
        });
    });

    afterEach(() => jest.restoreAllMocks());

    let keydownHandler: (event: KeyboardEvent) => boolean;
    let keyupHandler: (event: KeyboardEvent) => boolean;

    // Init a non-top-window controller with the given toggle binding loaded from
    // (mocked) local storage. We capture the injected toggle consumers rather
    // than attaching key listeners to the shared jsdom document: the physical
    // key listeners now belong to KeyListener.
    async function initController(binding: KeyBinding | null) {
        (loadToggleKeyBinding as jest.Mock).mockResolvedValue(binding);
        (loadHanjaKeyBinding as jest.Mock).mockResolvedValue(null);
        jest.spyOn(TextInputManager.prototype, "setToggleKeyConsumers").mockImplementation((consumers) => {
            keydownHandler = consumers.keydown ?? (() => false);
            keyupHandler = consumers.keyup ?? (() => false);
        });
        const documentAdd = jest.spyOn(document, "addEventListener").mockImplementation(() => {});
        const controller = new ContentScriptController();
        controller.initialize(false);
        await flushMicrotasks();
        return { controller, documentAdd };
    }

    it("does not attach document physical-key listeners", async () => {
        const { documentAdd } = await initController(defaultToggleKeyBinding);

        expect(
            documentAdd.mock.calls.some(([type]) => {
                return type === "keydown" || type === "keyup";
            })
        ).toBe(false);
    });

    const setHanYongEnabled = (enabled: boolean) =>
        listeners[0]({
            type: "serviceScriptMessage",
            action: ServiceScriptMessageAction.UpdateState,
            data: {
                isHanYongEnabled: enabled,
                isHanjaEnabled: true,
                showHanjaSimplified: true,
                showHanjaPinyin: true,
                isOnScreenKeyboardEnabled: false,
                koreanKeyboardMode: KoreanKeyboardMode.English,
            },
        });

    function fireKey(
        handler: (event: KeyboardEvent) => boolean,
        code: KeyCode,
        modifiers: Partial<KeyboardEvent> = {}
    ) {
        const event = {
            code,
            ctrlKey: false,
            altKey: false,
            shiftKey: false,
            metaKey: false,
            repeat: false,
            ...modifiers,
            preventDefault: jest.fn(),
            stopImmediatePropagation: jest.fn(),
        } as unknown as KeyboardEvent;
        return Object.assign(event, { handled: handler(event) });
    }

    const toggleCall = {
        type: "contentScriptRequest",
        action: ContentScriptRequestAction.ToggleHanYongMode,
    };

    it("toggles on the bound key (Right Alt) when Hangul typing is enabled", async () => {
        await initController(defaultToggleKeyBinding);
        setHanYongEnabled(true);
        sendMessage.mockClear();

        const keydown = fireKey(keydownHandler, KeyCode.AltRight, { altKey: true });
        const keyup = fireKey(keyupHandler, KeyCode.AltRight, { altKey: true });

        expect(keydown.preventDefault).toHaveBeenCalled();
        expect(keyup.preventDefault).toHaveBeenCalled(); // keyup swallowed (Firefox Alt menu)
        // A modifier-only key is left to propagate so the IME can still track it.
        expect(keydown.stopImmediatePropagation).not.toHaveBeenCalled();
        expect(keydown.handled).toBe(false);
        expect(keyup.handled).toBe(true);
        expect(sendMessage).toHaveBeenCalledWith(toggleCall);
    });

    it("does not toggle while Hangul typing is disabled", async () => {
        await initController(defaultToggleKeyBinding);
        setHanYongEnabled(false);
        sendMessage.mockClear();

        const keydown = fireKey(keydownHandler, KeyCode.AltRight, { altKey: true });
        const keyup = fireKey(keyupHandler, KeyCode.AltRight, { altKey: true });

        expect(keydown.preventDefault).not.toHaveBeenCalled();
        expect(keyup.preventDefault).not.toHaveBeenCalled();
        expect(keydown.handled).toBe(false);
        expect(keyup.handled).toBe(false);
        expect(sendMessage).not.toHaveBeenCalled();
    });

    it("does not toggle when the toggle key is turned off (null)", async () => {
        await initController(null);
        setHanYongEnabled(true);
        sendMessage.mockClear();

        const keydown = fireKey(keydownHandler, KeyCode.AltRight, { altKey: true });

        expect(keydown.preventDefault).not.toHaveBeenCalled();
        expect(keydown.handled).toBe(false);
        expect(sendMessage).not.toHaveBeenCalled();
    });

    it("toggles on a printable combo (Alt+S) and swallows the key fully", async () => {
        await initController(altS);
        setHanYongEnabled(true);
        sendMessage.mockClear();

        const keydown = fireKey(keydownHandler, KeyCode.KeyS, { altKey: true });

        expect(keydown.preventDefault).toHaveBeenCalled();
        // A printable combo must be swallowed so the character can't also be typed.
        expect(keydown.stopImmediatePropagation).toHaveBeenCalled();
        expect(keydown.handled).toBe(true);
        expect(sendMessage).toHaveBeenCalledWith(toggleCall);
    });

    it("requires an exact modifier match (Ctrl+Alt+S does not fire Alt+S)", async () => {
        await initController(altS);
        setHanYongEnabled(true);
        sendMessage.mockClear();

        const keydown = fireKey(keydownHandler, KeyCode.KeyS, { altKey: true, ctrlKey: true });

        expect(keydown.preventDefault).not.toHaveBeenCalled();
        expect(keydown.handled).toBe(false);
        expect(sendMessage).not.toHaveBeenCalled();
    });

    // The IME controller needs the binding too (to know when the toggle key is held as
    // the IME key rather than a modifier), so the loaded binding is pushed to the manager.
    it("pushes the loaded toggle binding to the text input manager", async () => {
        const setToggleKeyBinding = jest.spyOn(TextInputManager.prototype, "setToggleKeyBinding");

        await initController(altS);

        expect(setToggleKeyBinding).toHaveBeenCalledWith(altS);
    });
});

describe("ContentScriptController on-screen-keyboard layout", () => {
    let listeners: Array<(message: unknown) => void>;
    let sendMessage: jest.Mock;

    beforeEach(() => {
        (OnScreenKeyboardController as unknown as jest.Mock).mockClear();
        (loadToggleKeyBinding as jest.Mock).mockResolvedValue(defaultToggleKeyBinding);
        (loadHanjaKeyBinding as jest.Mock).mockResolvedValue(null);
        listeners = [];
        sendMessage = jest.fn();
        Object.assign(globalThis, {
            chrome: {
                runtime: {
                    sendMessage,
                    onMessage: { addListener: (listener: (message: unknown) => void) => listeners.push(listener) },
                },
                // Top-window init watches storage for layout- and toggle-key changes.
                storage: { onChanged: { addListener: jest.fn() } },
            },
        });
    });

    const updateState = (isOnScreenKeyboardEnabled: boolean) => ({
        type: "serviceScriptMessage",
        action: ServiceScriptMessageAction.UpdateState,
        data: {
            isHanYongEnabled: false,
            isHanjaEnabled: true,
            showHanjaSimplified: true,
            showHanjaPinyin: true,
            isOnScreenKeyboardEnabled,
            koreanKeyboardMode: KoreanKeyboardMode.English,
        },
    });

    it("requests the saved layout on init in the top window", () => {
        new ContentScriptController().initialize(true);

        expect(sendMessage.mock.calls.map((c) => c[0])).toContainEqual(
            expect.objectContaining({ action: ContentScriptRequestAction.RequestOnScreenKeyboardLayout })
        );
    });

    it("gates the first show until the saved layout arrives, then applies and shows it", () => {
        new ContentScriptController().initialize(true);
        const dispatch = listeners[0];

        // Enabled, but no layout yet -> must not show (no default-then-jump).
        dispatch(updateState(true));
        expect(lastOsk().showKeyboard).not.toHaveBeenCalled();

        // Layout arrives -> apply it, then show.
        dispatch({
            type: "serviceScriptMessage",
            action: ServiceScriptMessageAction.OnScreenKeyboardLayout,
            data: { collapsed: false },
        });
        expect(lastOsk().applyPersistedLayout).toHaveBeenCalledWith({ collapsed: false });
        expect(lastOsk().showKeyboard).toHaveBeenCalled();
    });

    it("hides immediately without waiting on the layout", () => {
        new ContentScriptController().initialize(true);
        const dispatch = listeners[0];

        dispatch(updateState(false));
        expect(lastOsk().hideKeyboard).toHaveBeenCalled();
        expect(lastOsk().showKeyboard).not.toHaveBeenCalled();
    });

    it("applies the layout setting to the keyboard on init", async () => {
        new ContentScriptController().initialize(true);
        await flushMicrotasks();

        expect(lastOsk().setLayout).toHaveBeenCalledWith("full-us");
    });

    it("re-applies the layout when the setting changes in sync storage", async () => {
        new ContentScriptController().initialize(true);
        await flushMicrotasks();
        lastOsk().setLayout.mockClear();

        // Fire every storage.onChanged listener the controller registered (layout +
        // toggle-key watchers); the toggle-key watcher ignores sync changes.
        const calls = (globalThis.chrome.storage.onChanged.addListener as jest.Mock).mock.calls;
        for (const [onChanged] of calls) {
            onChanged({ onScreenKeyboard: { newValue: {} } }, "sync");
        }
        await flushMicrotasks();

        expect(lastOsk().setLayout).toHaveBeenCalledWith("full-us");
    });
});
