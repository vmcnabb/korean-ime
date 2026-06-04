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

    it("keeps its corner anchor across a resize (re-anchors only on an explicit move)", () => {
        const setViewport = (w: number, h: number) => {
            Object.defineProperty(window, "innerWidth", { configurable: true, value: w });
            Object.defineProperty(window, "innerHeight", { configurable: true, value: h });
        };

        const controller = new OnScreenKeyboardController(() => {});
        const el = document.querySelector("[id^='kb-']") as HTMLElement;
        // jsdom has no layout, so give the keyboard a real size; otherwise it is a
        // zero-size point and clamping can never push it across a midline.
        Object.defineProperty(el, "offsetWidth", { configurable: true, value: 480 });
        Object.defineProperty(el, "offsetHeight", { configurable: true, value: 250 });

        setViewport(1200, 800);
        controller.showKeyboard(); // default anchor: bottom-right
        expect(el.style.right).not.toBe("");
        expect(el.style.bottom).not.toBe("");

        // Shrink the viewport below the keyboard's size, then restore it.
        setViewport(300, 200);
        window.dispatchEvent(new Event("resize"));
        setViewport(1200, 800);
        window.dispatchEvent(new Event("resize"));

        // Still anchored bottom-right, not flipped to top-left.
        expect(el.style.right).not.toBe("");
        expect(el.style.bottom).not.toBe("");
        expect(el.style.left).toBe("");
        expect(el.style.top).toBe("");
    });

    it("remembers the anchor distance across a resize (restores the offset, not flush to the corner)", () => {
        const setViewport = (w: number, h: number) => {
            Object.defineProperty(window, "innerWidth", { configurable: true, value: w });
            Object.defineProperty(window, "innerHeight", { configurable: true, value: h });
        };

        const controller = new OnScreenKeyboardController(() => {});
        const el = document.querySelector("[id^='kb-']") as HTMLElement;
        Object.defineProperty(el, "offsetWidth", { configurable: true, value: 480 });
        Object.defineProperty(el, "offsetHeight", { configurable: true, value: 250 });

        // Intended position: 100px / 60px in from the default bottom-right corner.
        const placement = (controller as unknown as { _keyboardPlacement: { x: number; y: number } })
            ._keyboardPlacement;
        placement.x = 100;
        placement.y = 60;

        setViewport(1200, 800);
        controller.showKeyboard();
        expect(el.style.right).toBe("100px");
        expect(el.style.bottom).toBe("60px");

        // Shrink below the keyboard's size (clamps flush to the corner), then restore.
        setViewport(300, 200);
        window.dispatchEvent(new Event("resize"));
        setViewport(1200, 800);
        window.dispatchEvent(new Event("resize"));

        // The remembered distance is restored, not collapsed to 0.
        expect(el.style.right).toBe("100px");
        expect(el.style.bottom).toBe("60px");
    });

    it("begins a drag from the keyboard's rendered position, not a diverged remembered offset", () => {
        Object.defineProperty(window, "innerWidth", { configurable: true, value: 1000 });
        Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });

        const controller = new OnScreenKeyboardController(() => {});
        const el = document.querySelector("[id^='kb-']") as HTMLElement;
        Object.defineProperty(el, "offsetWidth", { configurable: true, value: 480 });
        Object.defineProperty(el, "offsetHeight", { configurable: true, value: 250 });

        controller.showKeyboard(); // default bottom-right -> rendered flush (right: 0px)
        expect(el.style.right).toBe("0px");

        // Simulate the clamped state a resize leaves behind: the remembered offset
        // diverges from what is rendered.
        (controller as unknown as { _keyboardPlacement: { x: number } })._keyboardPlacement.x = 200;

        // Drag 10px left (anchored right, that increases the right offset).
        el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0, screenX: 100, screenY: 100 }));
        document.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, buttons: 1, screenX: 90, screenY: 100 }));

        // It tracked from the rendered 0 (now ~10px), not the stale 200 (~210px).
        expect(parseFloat(el.style.right)).toBeLessThan(50);
    });

    it("keeps the anchored edge on-screen when the keyboard is wider than the viewport", () => {
        Object.defineProperty(window, "innerWidth", { configurable: true, value: 300 });
        Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });

        const controller = new OnScreenKeyboardController(() => {});
        const el = document.querySelector("[id^='kb-']") as HTMLElement;
        Object.defineProperty(el, "offsetWidth", { configurable: true, value: 480 }); // wider than the viewport
        Object.defineProperty(el, "offsetHeight", { configurable: true, value: 250 });

        // Anchor it to the left.
        (controller as unknown as { _keyboardPlacement: { originX: string } })._keyboardPlacement.originX = "left";

        controller.showKeyboard();

        // Left-anchored: keep the left edge on-screen (overflow off the right),
        // not pinned to the right with the left edge pushed off-screen.
        expect(el.style.left).toBe("0px");
    });
});

describe("OnScreenKeyboardController header controls", () => {
    afterEach(() => jest.restoreAllMocks());

    let sendMessage: jest.Mock;

    beforeEach(() => {
        document.body.innerHTML = "";
        sendMessage = jest.fn();
        Object.assign(globalThis, {
            chrome: {
                runtime: { sendMessage },
                i18n: { getMessage: () => "" },
            },
        });
    });

    const host = () => document.querySelector("[id^='kb-']") as HTMLElement;

    it("collapses and restores the keyboard from the header button", () => {
        new OnScreenKeyboardController(() => {});
        const el = host();
        const collapse = el.querySelector(".kb-collapse") as HTMLButtonElement;

        expect(el.classList.contains("collapsed")).toBe(false);
        collapse.click();
        expect(el.classList.contains("collapsed")).toBe(true);
        collapse.click();
        expect(el.classList.contains("collapsed")).toBe(false);
    });

    it("turns the keyboard off via the service worker from the close button", () => {
        new OnScreenKeyboardController(() => {});
        (host().querySelector(".kb-close") as HTMLButtonElement).click();

        expect(sendMessage).toHaveBeenCalledWith({
            type: "contentScriptRequest",
            action: ContentScriptRequestAction.DisableOnScreenKeyboard,
        });
    });

    it("drags only from the header, not from the keys", () => {
        const controller = new OnScreenKeyboardController(() => {});
        const el = host();
        controller.showKeyboard();
        const place = jest.spyOn(
            OnScreenKeyboardController.prototype as unknown as { placeKeyboard: () => void },
            "placeKeyboard"
        );

        // pressing a key must not move the keyboard
        const key = document.querySelector("kbd.KeyS") as HTMLElement;
        key.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0, screenX: 100, screenY: 100 }));
        document.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, buttons: 1, screenX: 80, screenY: 100 }));
        expect(place).not.toHaveBeenCalled();

        // dragging the header bar does
        (el.querySelector(".kb-handle") as HTMLElement).dispatchEvent(
            new MouseEvent("mousedown", { bubbles: true, button: 0, screenX: 100, screenY: 100 })
        );
        document.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, buttons: 1, screenX: 80, screenY: 100 }));
        expect(place).toHaveBeenCalled();
    });
});
