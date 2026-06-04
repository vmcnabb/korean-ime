import { ContentScriptController } from "./content-script-controller";
import { KeyCode } from "../keyboard/korean-keyboard-map";
import { KoreanKeyboardMode } from "../extension-state/korean-keyboard-mode";
import { ServiceScriptMessageAction } from "../messaging/service-to-content-messages";
import { ContentScriptRequestAction } from "../messaging/content-to-service-messages";

jest.mock("./on-screen-keyboard/on-screen-keyboard-controller", () => ({
    OnScreenKeyboardController: class OnScreenKeyboardController {},
}));

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
