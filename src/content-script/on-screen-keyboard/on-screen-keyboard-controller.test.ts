import { OnScreenKeyboardController } from "./on-screen-keyboard-controller";
import { KeyCode } from "../../keyboard/korean-keyboard-map";
import { KoreanKeyboardMode } from "../../extension-state/korean-keyboard-mode";
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

    it("starts in Hangul and toggles an independent OSK-only mode when Hangul typing is disabled", () => {
        const controller = new OnScreenKeyboardController(onSendKey);
        controller.setHanYongEnabled(false);

        // the OSK is the only way to type Korean here, so it starts in Hangul
        expect(keyboard().classList.contains("hanMode")).toBe(true);

        // clicking a jamo emits a jamo, without messaging the service worker
        clickKey(KeyCode.KeyQ);
        expect(onSendKey).toHaveBeenCalledWith("ㅂ", KeyCode.KeyQ);
        expect(sendMessage).not.toHaveBeenCalled();

        // the 한/영 key flips it locally to Latin, still without messaging
        clickKey(KeyCode.AltRight);
        expect(keyboard().classList.contains("yongMode")).toBe(true);
        expect(sendMessage).not.toHaveBeenCalled();
    });

    it("keeps the OSK-local mode across redundant state updates", () => {
        const controller = new OnScreenKeyboardController(onSendKey);
        controller.setHanYongEnabled(false); // starts in Hangul

        clickKey(KeyCode.AltRight); // user flips to Latin
        expect(keyboard().classList.contains("yongMode")).toBe(true);

        controller.setHanYongEnabled(false); // redundant push must not re-seed it
        expect(keyboard().classList.contains("yongMode")).toBe(true);
    });

    it("re-seeds the OSK to Hangul when Hangul typing is turned off", () => {
        const controller = new OnScreenKeyboardController(onSendKey);
        controller.setHanYongEnabled(true);
        controller.setMode(KoreanKeyboardMode.English); // content script mirrors the shared Latin mode

        controller.setHanYongEnabled(false); // regime change -> default to Hangul
        expect(keyboard().classList.contains("hanMode")).toBe(true);
    });
});

describe("OnScreenKeyboardController resize handling", () => {
    afterEach(() => jest.restoreAllMocks());

    beforeEach(() => {
        document.body.innerHTML = "";
        Object.assign(globalThis, {
            chrome: {
                runtime: { sendMessage: jest.fn() },
                i18n: { getMessage: () => "" },
            },
        });
    });

    it("re-clamps to the viewport on window resize, but only while visible", () => {
        const placeKeyboard = jest.spyOn(
            OnScreenKeyboardController.prototype as unknown as { placeKeyboard: () => void },
            "placeKeyboard"
        );

        const controller = new OnScreenKeyboardController(() => {});

        // Hidden by default: a resize must not reposition. While hidden offsetWidth
        // is 0, so placement would be meaningless; showKeyboard re-places on show.
        window.dispatchEvent(new Event("resize"));
        expect(placeKeyboard).not.toHaveBeenCalled();

        controller.showKeyboard();
        placeKeyboard.mockClear();

        window.dispatchEvent(new Event("resize"));
        expect(placeKeyboard).toHaveBeenCalled();
    });
});
