import { ContentScriptController } from "./content-script-controller";
import { OnScreenKeyboardController } from "./on-screen-keyboard/on-screen-keyboard-controller";
import { KeyCode } from "../keyboard/korean-keyboard-map";
import { KoreanKeyboardMode } from "../extension-state/korean-keyboard-mode";
import { ServiceScriptMessageAction } from "../messaging/service-to-content-messages";
import { ContentScriptRequestAction } from "../messaging/content-to-service-messages";

jest.mock("./on-screen-keyboard/on-screen-keyboard-controller", () => ({
    OnScreenKeyboardController: jest.fn().mockImplementation(() => ({
        showKeyboard: jest.fn(),
        hideKeyboard: jest.fn(),
        applyPersistedLayout: jest.fn(),
        setHanYongEnabled: jest.fn(),
        setMode: jest.fn(),
        setCompositionFeatures: jest.fn(),
    })),
}));

// The most recently constructed (mocked) keyboard controller.
const lastOsk = () =>
    (OnScreenKeyboardController as unknown as jest.Mock).mock.results.at(-1)?.value as {
        showKeyboard: jest.Mock;
        hideKeyboard: jest.Mock;
        applyPersistedLayout: jest.Mock;
    };

describe("ContentScriptController AltRight handling", () => {
    it("only intercepts AltRight when Hangul typing and the keyboard-key option are both enabled", () => {
        const listeners: Array<(message: unknown) => void> = [];
        const sendMessage = jest.fn();

        Object.assign(globalThis, {
            chrome: {
                runtime: {
                    sendMessage,
                    onMessage: {
                        addListener: (listener: (message: unknown) => void) => listeners.push(listener),
                    },
                },
            },
        });

        const controller = new ContentScriptController();
        controller.initialize(false);
        sendMessage.mockClear();

        const handleMessage = listeners[0];
        handleMessage({
            type: "serviceScriptMessage",
            action: ServiceScriptMessageAction.UpdateState,
            data: {
                isHanYongEnabled: false,
                isHanYongKeyboardKeyEnabled: true,
                isOnScreenKeyboardEnabled: false,
                koreanKeyboardMode: KoreanKeyboardMode.English,
            },
        });

        const disabledKeydown = new KeyboardEvent("keydown", {
            bubbles: true,
            cancelable: true,
            code: KeyCode.AltRight,
        });
        const disabledKeyup = new KeyboardEvent("keyup", {
            bubbles: true,
            cancelable: true,
            code: KeyCode.AltRight,
        });

        document.dispatchEvent(disabledKeydown);
        document.dispatchEvent(disabledKeyup);

        expect(disabledKeydown.defaultPrevented).toBe(false);
        expect(disabledKeyup.defaultPrevented).toBe(false);
        expect(sendMessage).not.toHaveBeenCalled();

        handleMessage({
            type: "serviceScriptMessage",
            action: ServiceScriptMessageAction.UpdateState,
            data: {
                isHanYongEnabled: true,
                isHanYongKeyboardKeyEnabled: false,
                isOnScreenKeyboardEnabled: false,
                koreanKeyboardMode: KoreanKeyboardMode.English,
            },
        });
        sendMessage.mockClear();

        const keySettingDisabledKeydown = new KeyboardEvent("keydown", {
            bubbles: true,
            cancelable: true,
            code: KeyCode.AltRight,
        });
        const keySettingDisabledKeyup = new KeyboardEvent("keyup", {
            bubbles: true,
            cancelable: true,
            code: KeyCode.AltRight,
        });

        document.dispatchEvent(keySettingDisabledKeydown);
        document.dispatchEvent(keySettingDisabledKeyup);

        expect(keySettingDisabledKeydown.defaultPrevented).toBe(false);
        expect(keySettingDisabledKeyup.defaultPrevented).toBe(false);
        expect(sendMessage).not.toHaveBeenCalled();

        handleMessage({
            type: "serviceScriptMessage",
            action: ServiceScriptMessageAction.UpdateState,
            data: {
                isHanYongEnabled: true,
                isHanYongKeyboardKeyEnabled: true,
                isOnScreenKeyboardEnabled: false,
                koreanKeyboardMode: KoreanKeyboardMode.English,
            },
        });
        sendMessage.mockClear();

        const enabledKeydown = new KeyboardEvent("keydown", {
            bubbles: true,
            cancelable: true,
            code: KeyCode.AltRight,
        });
        const enabledKeyup = new KeyboardEvent("keyup", {
            bubbles: true,
            cancelable: true,
            code: KeyCode.AltRight,
        });

        document.dispatchEvent(enabledKeydown);
        document.dispatchEvent(enabledKeyup);

        expect(enabledKeydown.defaultPrevented).toBe(true);
        expect(enabledKeyup.defaultPrevented).toBe(true);
        expect(sendMessage).toHaveBeenCalledWith({
            type: "contentScriptRequest",
            action: ContentScriptRequestAction.ToggleHanYongMode,
        });
    });
});

describe("ContentScriptController on-screen-keyboard layout", () => {
    let listeners: Array<(message: unknown) => void>;
    let sendMessage: jest.Mock;

    beforeEach(() => {
        (OnScreenKeyboardController as unknown as jest.Mock).mockClear();
        listeners = [];
        sendMessage = jest.fn();
        Object.assign(globalThis, {
            chrome: {
                runtime: {
                    sendMessage,
                    onMessage: { addListener: (listener: (message: unknown) => void) => listeners.push(listener) },
                },
            },
        });
    });

    const updateState = (isOnScreenKeyboardEnabled: boolean) => ({
        type: "serviceScriptMessage",
        action: ServiceScriptMessageAction.UpdateState,
        data: {
            isHanYongEnabled: false,
            isHanYongKeyboardKeyEnabled: false,
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
});
