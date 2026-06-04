import { OnScreenKeyboardController } from "./on-screen-keyboard-controller";
import { KeyCode } from "../../keyboard/korean-keyboard-map";
import { ContentScriptRequestAction } from "../../messaging/content-to-service-messages";

// The controller side-effect-imports its stylesheet; Parcel handles that at
// build time, so stub it for the test runner (cf. the `url:` asset mocks in
// state-manager.test / menus.test).
jest.mock("./on-screen-keyboard.scss", () => ({}), { virtual: true });

describe("OnScreenKeyboardController han/yong key", () => {
    let sendMessage: jest.Mock;
    let onSendKey: jest.Mock;

    beforeEach(() => {
        document.body.innerHTML = "";
        sendMessage = jest.fn();
        onSendKey = jest.fn();
        Object.assign(globalThis, {
            chrome: {
                runtime: { sendMessage },
                i18n: { getMessage: () => "" },
            },
        });
    });

    const keyboard = () => document.querySelector("[id^='kb-']") as HTMLElement;

    const clickKey = (keyCode: KeyCode) => {
        const el = document.querySelector(`kbd.${keyCode}`);
        if (!el) {
            throw new Error(`key ${keyCode} was not rendered`);
        }
        el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    };

    it("toggles the shared mode via the service worker when Hangul typing is enabled", () => {
        const controller = new OnScreenKeyboardController(onSendKey);
        controller.setHanYongEnabled(true);

        clickKey(KeyCode.AltRight);

        expect(sendMessage).toHaveBeenCalledWith({
            type: "contentScriptRequest",
            action: ContentScriptRequestAction.ToggleHanYongMode,
        });
    });

    it("toggles an independent OSK-only mode without messaging the service worker when Hangul typing is disabled", () => {
        const controller = new OnScreenKeyboardController(onSendKey);
        controller.setHanYongEnabled(false);

        // starts in Latin
        expect(keyboard().classList.contains("yongMode")).toBe(true);

        clickKey(KeyCode.AltRight);

        // flipped locally to Hangul; nothing sent to the service worker
        expect(keyboard().classList.contains("hanMode")).toBe(true);
        expect(sendMessage).not.toHaveBeenCalled();

        // and clicking a jamo key now emits a jamo
        clickKey(KeyCode.KeyQ);
        expect(onSendKey).toHaveBeenCalledWith("ㅂ", KeyCode.KeyQ);
    });

    it("resets the OSK-local mode to Latin when the master regime changes", () => {
        const controller = new OnScreenKeyboardController(onSendKey);
        controller.setHanYongEnabled(false);

        clickKey(KeyCode.AltRight);
        expect(keyboard().classList.contains("hanMode")).toBe(true);

        controller.setHanYongEnabled(true);
        expect(keyboard().classList.contains("yongMode")).toBe(true);
    });
});
