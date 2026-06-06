import { OnScreenKeyboardController } from "./on-screen-keyboard-controller";
import { KeyCode } from "../../keyboard/korean-keyboard-map";
import { KoreanKeyboardMode } from "../../extension-state/korean-keyboard-mode";
import { ContentScriptRequestAction } from "../../messaging/content-to-service-messages";
import { LayoutId } from "./layouts";
import { modeIconHangul, modeIconEnglish, modeIconHangulSrcset, modeIconEnglishSrcset } from "./mode-icons";

// The controller side-effect-imports its stylesheet and imports the build-time
// generated mode-icons module; stub both for the test runner (cf. the `url:`
// asset mocks in state-manager.test / menus.test).
jest.mock("./on-screen-keyboard.scss", () => ({}), { virtual: true });
jest.mock(
    "./mode-icons",
    () => ({
        modeIconHangul: "data:hangul",
        modeIconEnglish: "data:english",
        modeIconHangulSrcset: "data:hangul 1x, data:hangul2 2x",
        modeIconEnglishSrcset: "data:english 1x, data:english2 2x",
    }),
    { virtual: true }
);

// The controller reads its viewport from the OSK container's clientWidth/clientHeight
// (deliberately, so the scrollbar is excluded). jsdom performs no layout, so those are
// 0 — point them at window.inner*, which the tests stub, so placement and clamping math
// runs as it would in a real browser. Call after the controller (and so the container)
// exists; the getters track later window.inner* changes (e.g. resize tests).
function mirrorViewportToContainer() {
    const container = document.querySelector("[id^='osk-container-']");
    if (!container) {
        throw new Error("OSK container not found; create the controller first");
    }
    Object.defineProperty(container, "clientWidth", { configurable: true, get: () => window.innerWidth });
    Object.defineProperty(container, "clientHeight", { configurable: true, get: () => window.innerHeight });
}

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
        mirrorViewportToContainer();
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
        el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0, clientX: 100, clientY: 100 }));
        document.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, buttons: 1, clientX: 90, clientY: 100 }));

        // It tracked from the rendered 0 (now ~10px), not the stale 200 (~210px).
        expect(parseFloat(el.style.right)).toBeLessThan(50);
    });

    it("tracks the drag in CSS pixels (clientX/Y), not device pixels, so it follows the cursor under zoom", () => {
        Object.defineProperty(window, "innerWidth", { configurable: true, value: 1000 });
        Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });

        const controller = new OnScreenKeyboardController(() => {});
        mirrorViewportToContainer();
        const el = document.querySelector("[id^='kb-']") as HTMLElement;
        Object.defineProperty(el, "offsetWidth", { configurable: true, value: 480 });
        Object.defineProperty(el, "offsetHeight", { configurable: true, value: 250 });

        controller.showKeyboard(); // default bottom-right -> flush (right: 0px)

        // Drag 30 CSS px left. screenX moves twice as far (as at 200% zoom, where
        // device px = 2x CSS px); the keyboard must follow clientX, not screenX.
        (el.querySelector(".kb-handle") as HTMLElement).dispatchEvent(
            new MouseEvent("mousedown", { bubbles: true, button: 0, clientX: 500, clientY: 100, screenX: 1000 })
        );
        document.dispatchEvent(
            new MouseEvent("mousemove", { bubbles: true, buttons: 1, clientX: 470, clientY: 100, screenX: 940 })
        );

        // 30 CSS px left, anchored right -> ~30px right offset (not ~60px).
        expect(parseFloat(el.style.right)).toBeCloseTo(30, 0);

        // Release the drag so this controller's persistent document listeners
        // don't stay armed and move the keyboard during a later test.
        document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, button: 0 }));
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

    it("toggles the mode when the header mode indicator is clicked", () => {
        const controller = new OnScreenKeyboardController(() => {});
        controller.setHanYongEnabled(true);

        (host().querySelector(".kb-mode") as HTMLImageElement).click();

        expect(sendMessage).toHaveBeenCalledWith({
            type: "contentScriptRequest",
            action: ContentScriptRequestAction.ToggleHanYongMode,
        });
    });

    it("shows the mode indicator only while Hangul typing is enabled, mirroring the mode", () => {
        const controller = new OnScreenKeyboardController(() => {});
        const indicator = host().querySelector(".kb-mode") as HTMLImageElement;

        // hidden until Hangul typing is known to be enabled
        expect(indicator.style.display).toBe("none");

        controller.setHanYongEnabled(true);
        controller.setMode(KoreanKeyboardMode.Hangul);
        expect(indicator.style.display).not.toBe("none");
        expect(indicator.getAttribute("src")).toBe(modeIconHangul);
        expect(indicator.getAttribute("srcset")).toBe(modeIconHangulSrcset);

        controller.setMode(KoreanKeyboardMode.English);
        expect(indicator.getAttribute("src")).toBe(modeIconEnglish);
        expect(indicator.getAttribute("srcset")).toBe(modeIconEnglishSrcset);

        // hidden again once Hangul typing is disabled (its independent OSK mode
        // is not what the toolbar icon reflects)
        controller.setHanYongEnabled(false);
        expect(indicator.style.display).toBe("none");
    });

    it("drags only from the header, not from the keys", () => {
        const controller = new OnScreenKeyboardController(() => {});
        mirrorViewportToContainer();
        const el = host();
        controller.showKeyboard();
        const place = jest.spyOn(
            OnScreenKeyboardController.prototype as unknown as { placeKeyboard: () => void },
            "placeKeyboard"
        );

        // pressing a key must not move the keyboard
        const key = document.querySelector("kbd.KeyS") as HTMLElement;
        key.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0, clientX: 100, clientY: 100 }));
        document.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, buttons: 1, clientX: 80, clientY: 100 }));
        expect(place).not.toHaveBeenCalled();

        // dragging the header bar does
        (el.querySelector(".kb-handle") as HTMLElement).dispatchEvent(
            new MouseEvent("mousedown", { bubbles: true, button: 0, clientX: 100, clientY: 100 })
        );
        document.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, buttons: 1, clientX: 80, clientY: 100 }));
        expect(place).toHaveBeenCalled();
    });
});

describe("OnScreenKeyboardController anchor guides", () => {
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

    const guides = () => document.getElementById("kb-guides-3f2a9c7e-7b1d-4e8a-9c2f-1a6b5d4e3c20") as HTMLElement;
    const guideH = () => guides().querySelector(".kb-guide-h") as HTMLElement;
    const guideV = () => guides().querySelector(".kb-guide-v") as HTMLElement;

    const setPlacement = (controller: OnScreenKeyboardController, originX: string, originY: string) => {
        (
            controller as unknown as { _keyboardPlacement: { originX: string; originY: string } }
        )._keyboardPlacement.originX = originX;
        (
            controller as unknown as { _keyboardPlacement: { originX: string; originY: string } }
        )._keyboardPlacement.originY = originY;
    };

    it("are hidden until the keyboard is moved", () => {
        new OnScreenKeyboardController(() => {});
        expect(guides().classList.contains("visible")).toBe(false);
    });

    it.each([
        ["bottom", "right"],
        ["bottom", "left"],
        ["top", "right"],
        ["top", "left"],
    ])("light the anchored edges distinctly for the %s-%s corner", (originY, originX) => {
        const controller = new OnScreenKeyboardController(() => {});
        setPlacement(controller, originX, originY);

        // updateGuides maps the anchor onto the two lit edges.
        (controller as unknown as { updateGuides: () => void }).updateGuides();

        expect(guideH().classList.contains(originY)).toBe(true);
        expect(guideH().classList.contains(originY === "top" ? "bottom" : "top")).toBe(false);
        expect(guideV().classList.contains(originX)).toBe(true);
        expect(guideV().classList.contains(originX === "left" ? "right" : "left")).toBe(false);
    });

    it("draw connectors from the keyboard's midpoints to the anchored edges", () => {
        Object.defineProperty(window, "innerWidth", { configurable: true, value: 1000 });
        Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });

        const controller = new OnScreenKeyboardController(() => {});
        mirrorViewportToContainer();
        const el = document.querySelector("[id^='kb-']") as HTMLElement;
        // A keyboard sitting in from the bottom-right corner, with a known rect.
        setPlacement(controller, "right", "bottom");
        el.getBoundingClientRect = () =>
            ({ left: 480, right: 880, top: 500, bottom: 700, width: 400, height: 200 }) as DOMRect;

        (controller as unknown as { updateGuides: () => void }).updateGuides();

        const connectorX = guides().querySelector(".kb-connector-x") as HTMLElement;
        const connectorY = guides().querySelector(".kb-connector-y") as HTMLElement;

        // The connectors stop one bar-thickness (4mm) short of the viewport edge,
        // so they meet the inner edge of the edge bars rather than the edge itself.
        const barPx = (4 * 96) / 25.4; // 4mm in CSS px

        // Horizontal connector: from the keyboard's right edge toward the viewport
        // right (less the bar), at the keyboard's vertical midpoint.
        expect(connectorX.style.left).toBe("880px"); // rect.right
        expect(parseFloat(connectorX.style.width)).toBeCloseTo(120 - barPx, 3); // innerWidth - rect.right - bar
        expect(connectorX.style.top).toBe("600px"); // rect.top + height/2

        // Vertical connector: from the keyboard's bottom edge toward the viewport
        // bottom (less the bar), at the keyboard's horizontal midpoint.
        expect(connectorY.style.top).toBe("700px"); // rect.bottom
        expect(parseFloat(connectorY.style.height)).toBeCloseTo(100 - barPx, 3); // innerHeight - rect.bottom - bar
        expect(connectorY.style.left).toBe("680px"); // rect.left + width/2

        // The edge bars line up with the connectors: centred on the same midpoints
        // (a -50% translate does the centring), sized 1in along the edge by 4mm.
        expect(guideH().style.left).toBe("680px"); // centreX, == connectorY
        expect(guideH().style.transform).toBe("translateX(-50%)");
        expect(guideH().style.width).toBe("1in");
        expect(guideH().style.height).toBe("4mm");
        expect(guideV().style.top).toBe("600px"); // centreY, == connectorX
        expect(guideV().style.transform).toBe("translateY(-50%)");
        expect(guideV().style.width).toBe("4mm");
        expect(guideV().style.height).toBe("1in");
    });

    it("appear during a drag and fade out a short time after the drop", () => {
        jest.useFakeTimers();
        try {
            Object.defineProperty(window, "innerWidth", { configurable: true, value: 1000 });
            Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });

            const controller = new OnScreenKeyboardController(() => {});
            const el = document.querySelector("[id^='kb-']") as HTMLElement;
            Object.defineProperty(el, "offsetWidth", { configurable: true, value: 480 });
            Object.defineProperty(el, "offsetHeight", { configurable: true, value: 250 });
            controller.showKeyboard();

            // Drag from the header: the guides light up.
            (el.querySelector(".kb-handle") as HTMLElement).dispatchEvent(
                new MouseEvent("mousedown", { bubbles: true, button: 0, clientX: 100, clientY: 100 })
            );
            document.dispatchEvent(
                new MouseEvent("mousemove", { bubbles: true, buttons: 1, clientX: 90, clientY: 110 })
            );
            expect(guides().classList.contains("visible")).toBe(true);

            // On drop they brighten (the "saved" flash) and linger, then fade.
            document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, button: 0 }));
            expect(guides().classList.contains("visible")).toBe(true);
            expect(guides().classList.contains("flash")).toBe(true);

            jest.advanceTimersByTime(700);
            expect(guides().classList.contains("visible")).toBe(false);
            expect(guides().classList.contains("flash")).toBe(false);
        } finally {
            jest.useRealTimers();
        }
    });
});

describe("OnScreenKeyboardController layout switching", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
        Object.assign(globalThis, {
            chrome: { runtime: { sendMessage: jest.fn() }, i18n: { getMessage: () => "" } },
        });
    });

    const host = () => document.querySelector("[id^='kb-']") as HTMLElement;

    it("defaults to the full US layout and switches to minimal", () => {
        const controller = new OnScreenKeyboardController(() => {});
        const el = host();

        // Full US has a number row; the minimal layout drops it but keeps letters.
        expect(el.querySelector("kbd.Digit1")).not.toBeNull();

        controller.setLayout(LayoutId.Minimal);

        expect(el.querySelector("kbd.Digit1")).toBeNull();
        expect(el.querySelector("kbd.KeyQ")).not.toBeNull();
    });

    it("ignores an unknown layout id", () => {
        const controller = new OnScreenKeyboardController(() => {});
        const el = host();

        expect(() => controller.setLayout("bogus" as LayoutId)).not.toThrow();
        expect(el.querySelector("kbd.Digit1")).not.toBeNull(); // unchanged (still full US)
    });

    it("gives the Korean layout dedicated 한영/한자 keys plus plain right Alt/Ctrl", () => {
        const controller = new OnScreenKeyboardController(() => {});
        const el = host();

        controller.setLayout(LayoutId.FullKorean);

        // Dedicated han/yong + hanja keys.
        expect(el.querySelector("kbd.Lang1")).not.toBeNull();
        expect(el.querySelector("kbd.Lang2")).not.toBeNull();

        // Right Alt/Ctrl are present and inert, with their labels overridden to
        // plain modifiers — not the 한/영 / Ctrl·한자 rendering of the US layout
        // (jsdom doesn't populate innerText, so assert structurally).
        const altRight = el.querySelector("kbd.AltRight") as HTMLElement;
        const controlRight = el.querySelector("kbd.ControlRight") as HTMLElement;
        expect(altRight.classList.contains("inert")).toBe(true);
        expect(altRight.querySelector(".hanMode, .yongMode")).toBeNull(); // not the 한/영 key
        expect(controlRight.classList.contains("inert")).toBe(true);
        expect(controlRight.querySelector(".jamo")).toBeNull(); // not the Ctrl·한자 key
    });
});

describe("OnScreenKeyboardController persisted layout", () => {
    let sendMessage: jest.Mock;

    beforeEach(() => {
        document.body.innerHTML = "";
        sendMessage = jest.fn();
        Object.assign(globalThis, {
            chrome: { runtime: { sendMessage }, i18n: { getMessage: () => "" } },
        });
        Object.defineProperty(window, "innerWidth", { configurable: true, value: 1200 });
        Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
    });

    const host = () => document.querySelector("[id^='kb-']") as HTMLElement;

    const sizedKeyboard = () => {
        const el = host();
        // jsdom has no layout; give the keyboard a real size so placement clamps.
        Object.defineProperty(el, "offsetWidth", { configurable: true, value: 480 });
        Object.defineProperty(el, "offsetHeight", { configurable: true, value: 250 });
        return el;
    };

    const persistCalls = () =>
        sendMessage.mock.calls
            .map((call) => call[0])
            .filter((m) => m.action === ContentScriptRequestAction.PersistOnScreenKeyboardLayout);

    it("applies a restored position and collapsed state, used on the next show", () => {
        const controller = new OnScreenKeyboardController(() => {});
        mirrorViewportToContainer();
        const el = sizedKeyboard();

        controller.applyPersistedLayout({
            position: { originX: "left", originY: "top", x: 30, y: 40 },
            collapsed: true,
        });
        expect(el.classList.contains("collapsed")).toBe(true);

        controller.showKeyboard();

        // Restored to the saved top-left anchor, not the default bottom-right.
        expect(el.style.left).toBe("30px");
        expect(el.style.top).toBe("40px");
        expect(el.style.right).toBe("");
        expect(el.style.bottom).toBe("");
    });

    it("persists the new position (with the site key) on drag-drop", () => {
        const controller = new OnScreenKeyboardController(() => {});
        const el = sizedKeyboard();
        controller.showKeyboard();
        sendMessage.mockClear();

        (el.querySelector(".kb-handle") as HTMLElement).dispatchEvent(
            new MouseEvent("mousedown", { bubbles: true, button: 0, clientX: 600, clientY: 400 })
        );
        document.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, buttons: 1, clientX: 560, clientY: 360 }));
        document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, button: 0 }));

        const calls = persistCalls();
        expect(calls).toHaveLength(1);
        expect(calls[0].data.site).toBe("localhost"); // jsdom default hostname
        expect(calls[0].data.position).toMatchObject({
            originX: expect.any(String),
            originY: expect.any(String),
            x: expect.any(Number),
            y: expect.any(Number),
        });
    });

    it("does not persist on a bare header click with no movement", () => {
        const controller = new OnScreenKeyboardController(() => {});
        const el = sizedKeyboard();
        controller.showKeyboard();
        sendMessage.mockClear();

        (el.querySelector(".kb-handle") as HTMLElement).dispatchEvent(
            new MouseEvent("mousedown", { bubbles: true, button: 0, clientX: 600, clientY: 400 })
        );
        document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, button: 0 }));

        expect(persistCalls()).toHaveLength(0);
    });

    it("persists the collapsed state globally (no site) when toggled", () => {
        const controller = new OnScreenKeyboardController(() => {});
        const el = sizedKeyboard();
        controller.showKeyboard();
        sendMessage.mockClear();

        (el.querySelector(".kb-collapse") as HTMLButtonElement).click();

        const calls = persistCalls();
        expect(calls).toHaveLength(1);
        expect(calls[0].data.collapsed).toBe(true);
        expect(calls[0].data.site).toBeUndefined();
    });
});

describe("OnScreenKeyboardController resize", () => {
    let sendMessage: jest.Mock;

    beforeEach(() => {
        document.body.innerHTML = "";
        sendMessage = jest.fn();
        Object.assign(globalThis, {
            chrome: { runtime: { sendMessage }, i18n: { getMessage: () => "" } },
        });
        Object.defineProperty(window, "innerWidth", { configurable: true, value: 2000 });
        Object.defineProperty(window, "innerHeight", { configurable: true, value: 2000 });
    });

    const host = () => document.querySelector("[id^='kb-']") as HTMLElement;
    const grip = () => document.querySelector(".kb-resize-grip") as HTMLElement;
    const persistedKeyUnit = () =>
        sendMessage.mock.calls
            .map((c) => c[0])
            .filter((m) => m.action === ContentScriptRequestAction.PersistOnScreenKeyboardLayout)
            .map((m) => m.data.keyUnit)
            .filter((u) => u !== undefined)
            .at(-1);

    const sized = () => {
        const el = host();
        Object.defineProperty(el, "offsetWidth", { configurable: true, value: 480 });
        Object.defineProperty(el, "offsetHeight", { configurable: true, value: 250 });
        return el;
    };

    it("renders a resize grip on the keyboard", () => {
        new OnScreenKeyboardController(() => {});
        expect(grip()).not.toBeNull();
    });

    it("restores a persisted key size, clamped to the allowed range", () => {
        const controller = new OnScreenKeyboardController(() => {});
        mirrorViewportToContainer();
        const el = sized();

        controller.applyPersistedLayout({ collapsed: false, keyUnit: 999 });
        controller.showKeyboard();

        // Clamped to the max (64), applied as --key-unit.
        expect(el.style.getPropertyValue("--key-unit")).toBe("64px");
    });

    it("scales the key size when the grip is dragged, and persists on release", () => {
        const controller = new OnScreenKeyboardController(() => {});
        const el = sized();
        controller.showKeyboard();
        // Anchored bottom-right by default: anchor corner at rect.right/bottom.
        el.getBoundingClientRect = () =>
            ({ left: 100, top: 100, right: 500, bottom: 400, width: 400, height: 300 }) as DOMRect;
        sendMessage.mockClear();

        const g = grip();
        // Start distance (anchor to free corner) = hypot(400,300) = 500.
        g.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0 }));
        // Cursor at (250,150): dist from anchor (500,400) = hypot(250,250).
        g.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, clientX: 250, clientY: 150 }));
        g.dispatchEvent(new MouseEvent("pointerup", { bubbles: true, button: 0 }));

        expect(persistedKeyUnit()).toBeCloseTo((32 * Math.hypot(250, 250)) / 500, 1);
    });

    it("resizes from any corner, keeping the anchor origin and moving its position", () => {
        const controller = new OnScreenKeyboardController(() => {});
        const el = sized();
        controller.showKeyboard(); // default anchor: bottom-right
        el.getBoundingClientRect = () =>
            ({ left: 100, top: 100, right: 500, bottom: 400, width: 400, height: 300 }) as DOMRect;
        sendMessage.mockClear();

        // Drag the bottom-right grip (the anchored corner); pivot = top-left (100,100).
        const br = document.querySelector(".kb-grip-br") as HTMLElement;
        br.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0 }));
        // dist from pivot (100,100) to (700,550) = hypot(600,450) = 750; start = 500.
        br.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, clientX: 700, clientY: 550 }));
        br.dispatchEvent(new MouseEvent("pointerup", { bubbles: true, button: 0 }));

        // Origin unchanged (still anchored bottom-right), position updated.
        expect(el.style.right).not.toBe("");
        expect(el.style.bottom).not.toBe("");
        expect(el.style.left).toBe("");
        expect(el.style.top).toBe("");
        expect(persistedKeyUnit()).toBeCloseTo((32 * Math.hypot(600, 450)) / 500, 0);
    });

    it("does not resize while collapsed", () => {
        const controller = new OnScreenKeyboardController(() => {});
        const el = sized();
        controller.showKeyboard();
        el.getBoundingClientRect = () =>
            ({ left: 100, top: 100, right: 500, bottom: 400, width: 400, height: 300 }) as DOMRect;
        (el.querySelector(".kb-collapse") as HTMLButtonElement).click(); // collapse
        sendMessage.mockClear();

        const g = grip();
        g.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0 }));
        g.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, clientX: 50, clientY: 50 }));
        g.dispatchEvent(new MouseEvent("pointerup", { bubbles: true, button: 0 }));
        g.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));

        expect(persistedKeyUnit()).toBeUndefined(); // no size persisted
    });

    it("resets to the default size on double-clicking the grip", () => {
        const controller = new OnScreenKeyboardController(() => {});
        mirrorViewportToContainer();
        const el = sized();
        controller.applyPersistedLayout({ collapsed: false, keyUnit: 50 });
        controller.showKeyboard();
        sendMessage.mockClear();

        grip().dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));

        expect(el.style.getPropertyValue("--key-unit")).toBe("32px");
        expect(persistedKeyUnit()).toBe(32);
    });
});

describe("OnScreenKeyboardController layout drop-down", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
        Object.assign(globalThis, {
            chrome: { runtime: { sendMessage: jest.fn() }, i18n: { getMessage: () => "" } },
        });
    });

    const host = () => document.querySelector("[id^='kb-']") as HTMLElement;
    const options = () => Array.from(host().querySelectorAll(".kb-layout-option")) as HTMLButtonElement[];
    const menu = () => host().querySelector(".kb-layout-menu") as HTMLElement;
    const trigger = () => host().querySelector(".kb-layout-trigger") as HTMLButtonElement;

    it("lists the three layouts and marks the current one", () => {
        new OnScreenKeyboardController(() => {});

        // Order matches LAYOUT_OPTIONS: minimal, full US, full Korean.
        expect(options()).toHaveLength(3);
        // Default layout is full US (index 1).
        expect(options()[1].classList.contains("selected")).toBe(true);
        expect(options()[0].classList.contains("selected")).toBe(false);
    });

    it("toggles the menu open and closed from the trigger", () => {
        new OnScreenKeyboardController(() => {});

        expect(menu().classList.contains("open")).toBe(false);
        trigger().click();
        expect(menu().classList.contains("open")).toBe(true);
        trigger().click();
        expect(menu().classList.contains("open")).toBe(false);
    });

    it("applies the picked layout, reports the change, and closes the menu", () => {
        const onLayoutChange = jest.fn();
        new OnScreenKeyboardController(() => {}, onLayoutChange);
        const el = host();

        trigger().click();
        options()[0].click(); // minimal

        expect(onLayoutChange).toHaveBeenCalledWith("minimal");
        expect(menu().classList.contains("open")).toBe(false);
        // Switched to minimal (no number row) and reflected as selected.
        expect(el.querySelector("kbd.Digit1")).toBeNull();
        expect(options()[0].classList.contains("selected")).toBe(true);
    });

    it("reflects an externally-set layout (e.g. from the options page)", () => {
        const controller = new OnScreenKeyboardController(() => {});

        controller.setLayout(LayoutId.FullKorean);

        expect(options()[2].classList.contains("selected")).toBe(true);
        expect(options()[1].classList.contains("selected")).toBe(false);
    });
});
