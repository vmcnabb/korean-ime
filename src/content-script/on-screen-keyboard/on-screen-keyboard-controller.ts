import { KoreanKeyboardMode } from "../../extension-state/korean-keyboard-mode";
import { KeyCode, KeyRecord, keyMap } from "../../keyboard/korean-keyboard-map";
import { KeyboardLayout, LayoutKey, LayoutId, layouts, defaultLayoutId } from "./layouts";
import { SupportedCompositionFeatures } from "../../composition/composition-adapters/composition-adapter-interface";
import "./on-screen-keyboard.scss";
import { ContentScriptRequestAction, ContentScriptRequestMessage } from "../../messaging/content-to-service-messages";
import { debugLog } from "../../debug-log";
import { api } from "../../platform/browser-api";
import { modeIconHangul, modeIconEnglish } from "./mode-icons";
import { KeyboardPlacement, OnScreenKeyboardLayout } from "../../extension-state/osk-layout";
import { currentOskSite } from "../osk-site";

/**
 * How long the anchor guides linger after a drag ends before fading out. The
 * anchor only matters while the user is repositioning the keyboard, so the
 * guides are shown during a drag and for this short moment afterwards (long
 * enough to confirm where it landed), then disappear.
 */
const GUIDE_LINGER_MS = 600;

/**
 * The anchored-edge highlight is a short, fat solid bar centred where the
 * connector meets the viewport edge: this long along the edge, this thick across
 * it. Physical units (in/mm) so it stays a consistent real-world size across
 * displays.
 */
const GUIDE_EDGE_LENGTH = "1in";
const GUIDE_EDGE_THICKNESS_MM = 4;
const GUIDE_EDGE_THICKNESS = `${GUIDE_EDGE_THICKNESS_MM}mm`;
// CSS fixes 1in = 96px regardless of device DPI, so 1mm = 96/25.4 px. Used to
// stop the connectors at the inner edge of the (mm-sized) edge bars rather than
// running them the whole way to the viewport edge.
const GUIDE_EDGE_THICKNESS_PX = (GUIDE_EDGE_THICKNESS_MM * 96) / 25.4;

export class OnScreenKeyboardController {
    private _keyboardElement: HTMLDivElement;
    private _keyboardPlacement: KeyboardPlacement = {
        originX: "right",
        originY: "bottom",
        x: 0,
        y: 0,
    };
    private _keyboardMovement = {
        mouse: {
            down: false,
            startX: 0,
            startY: 0,
        },
    };
    // Whether the keyboard actually moved during the current drag, so a drop
    // persists the new position only after a real move (not a bare header click).
    private _movedDuringDrag = false;

    private _mode = KoreanKeyboardMode.English;
    // `undefined` until the first state update, so the first call to
    // setHanYongEnabled always counts as entering a regime and seeds the mode.
    private _isHanYongEnabled?: boolean;
    private _isShift = false;
    private _compositionFeatures: SupportedCompositionFeatures | undefined;
    private _keyElements = new Map<KeyCode, HTMLElement>();
    private _keyboardBody?: HTMLDivElement;
    private _layoutId: LayoutId = defaultLayoutId;
    private _collapseButton?: HTMLButtonElement;
    private _modeIndicator?: HTMLImageElement;
    // Dotted overlays marking how the keyboard is anchored, shown only while it's
    // being moved (see GUIDE_LINGER_MS): two full-edge lines along the anchored
    // viewport edges (_guideH/_guideV), plus two connectors running from the
    // keyboard's midpoints out to those edges (_connectorX/_connectorY).
    private _guidesElement?: HTMLDivElement;
    private _guideH?: HTMLDivElement;
    private _guideV?: HTMLDivElement;
    private _connectorX?: HTMLDivElement;
    private _connectorY?: HTMLDivElement;
    private _guideHideTimer?: ReturnType<typeof setTimeout>;
    private _onSendKey: (key: string, keyCode: KeyCode) => void;

    constructor(onSendKey: (key: string, keyCode: KeyCode) => void) {
        this._onSendKey = onSendKey;
        this._keyboardElement = this.createKeyboard();
        this.setMode(this._mode);
    }

    public setMode(mode: KoreanKeyboardMode) {
        debugLog("OnScreenKeyboardController.setMode", mode);

        this._mode = mode;
        const isHanMode = mode === KoreanKeyboardMode.Hangul;

        this._keyboardElement.classList.toggle("hanMode", isHanMode);
        this._keyboardElement.classList.toggle("yongMode", !isHanMode);

        this.updateModeIndicator();
    }

    public setHanYongEnabled(enabled: boolean) {
        if (enabled === this._isHanYongEnabled) {
            return;
        }

        this._isHanYongEnabled = enabled;

        // Seed the on-screen keyboard's mode when entering a regime:
        //  - Hangul typing off: the OSK is the only way to type Korean, so start
        //    in Hangul. The mode is ephemeral (tab-local, never saved) — the user
        //    can still flip it, and it re-seeds to Hangul on the next page load.
        //  - Hangul typing on: start in Latin; ContentScriptController mirrors the
        //    shared mode in immediately afterwards, so this is a transient seed.
        this.setMode(enabled ? KoreanKeyboardMode.English : KoreanKeyboardMode.Hangul);
    }

    public setShift(shift: boolean) {
        this._isShift = shift;
        this._keyboardElement.classList.toggle("shift", shift);
    }

    public setCompositionFeatures(features: SupportedCompositionFeatures) {
        this._compositionFeatures = features;
        this.updateKeyVisibility();
    }

    private updateKeyVisibility() {
        if (this._compositionFeatures) {
            this._keyElements
                .get(KeyCode.Backspace)
                ?.classList.toggle("disabled", !this._compositionFeatures.deleteContentBackwards);
        }
    }

    private moveKeyboard(dx: number, dy: number) {
        const placement = this._keyboardPlacement;
        const style = this._keyboardElement.style;

        // Begin from where the keyboard is actually rendered. While it's clamped
        // into a small viewport the remembered offset is kept (so it can be
        // restored when there's room again) and can differ from the rendered one;
        // starting a drag from the stale offset would make the first frame jump.
        const kx = ~~(parseFloat(placement.originX === "right" ? style.right : style.left) || 0);
        const ky = ~~(parseFloat(placement.originY === "bottom" ? style.bottom : style.top) || 0);

        if (placement.originX === "right") {
            dx = -dx;
        }

        if (placement.originY === "bottom") {
            dy = -dy;
        }

        placement.x = kx + dx;
        placement.y = ky + dy;

        // A drag is an explicit move, so re-anchor to the corner it lands in.
        this.placeKeyboard(true);
        this._movedDuringDrag = true;

        // Surface which two edges it's now anchored to (placeKeyboard has just
        // resolved them) for as long as the drag continues.
        this.showGuides();
    }

    private endDrag() {
        this._keyboardMovement.mouse.down = false;
        this.hideGuidesAfterDrop();

        // Persist the landing spot only after an actual move, so a bare header
        // click doesn't rewrite the saved position.
        if (this._movedDuringDrag) {
            this._movedDuringDrag = false;
            this.persistLayout({ position: this._keyboardPlacement });
        }
    }

    /**
     * Apply a persisted layout before the keyboard is first shown: the per-site
     * position (when one was saved) and the global collapsed state. The content
     * script gates the first show on this, so there's no default-then-jump.
     */
    public applyPersistedLayout(layout: OnScreenKeyboardLayout) {
        if (layout.position) {
            this._keyboardPlacement = { ...layout.position };
        }
        this.setCollapsed(layout.collapsed);
    }

    // Ask the service worker to persist whichever layout fields changed. A
    // position needs a site key; the collapsed state is global. Failures are
    // logged, not surfaced — persistence is best-effort.
    private persistLayout(update: { position?: KeyboardPlacement; collapsed?: boolean }) {
        const data: { site?: string; position?: KeyboardPlacement; collapsed?: boolean } = {
            collapsed: update.collapsed,
        };

        if (update.position) {
            const site = currentOskSite();
            // Nothing meaningful to key a position on (e.g. file://) — skip it.
            if (!site) {
                return;
            }
            data.site = site;
            data.position = update.position;
        }

        api.runtime.sendMessage<ContentScriptRequestMessage>({
            type: "contentScriptRequest",
            action: ContentScriptRequestAction.PersistOnScreenKeyboardLayout,
            data,
        });
    }

    hideKeyboard() {
        this._keyboardElement.style.display = "none";
    }

    showKeyboard() {
        this._keyboardElement.style.display = "block";
        this.placeKeyboard();
    }

    private placeKeyboard(reanchor = false) {
        // get x,y coordinates of keyboard based on an origin of Top Left
        const placement = this._keyboardPlacement;
        const width = this._keyboardElement.offsetWidth;
        const height = this._keyboardElement.offsetHeight;

        let x = placement.originX === "right" ? window.innerWidth - width - placement.x : placement.x;

        let y = placement.originY === "bottom" ? window.innerHeight - height - placement.y : placement.y;

        // Keep the keyboard within the viewport. When it is larger than the
        // viewport it cannot fit either way, so keep the anchored edge on-screen
        // (overflowing off the opposite edge) rather than pinning the far edge and
        // pushing the anchored one off.
        if (width > window.innerWidth) {
            x = placement.originX === "right" ? window.innerWidth - width : 0;
        } else {
            if (x < 0) x = 0;
            if (x + width > window.innerWidth) x = window.innerWidth - width;
        }

        if (height > window.innerHeight) {
            y = placement.originY === "bottom" ? window.innerHeight - height : 0;
        } else {
            if (y < 0) y = 0;
            if (y + height > window.innerHeight) y = window.innerHeight - height;
        }

        // Re-derive the anchor corner from the keyboard's quadrant only when the
        // user is moving it. On a resize re-clamp we keep the existing anchor, so
        // the keyboard returns to the same corner instead of flipping when a small
        // viewport forces it across a midline.
        let originX = placement.originX;
        let originY = placement.originY;
        if (reanchor) {
            const cx = ~~(x + width / 2);
            const cy = ~~(y + height / 2);
            originX = cx > window.innerWidth / 2 ? "right" : "left";
            originY = cy > window.innerHeight / 2 ? "bottom" : "top";
        }

        // set x and y based on new origin
        const keyboardElement = this._keyboardElement;
        if (originX === "right") {
            x = window.innerWidth - x - width;
            keyboardElement.style.left = "";
            keyboardElement.style.right = `${x}px`;
        } else {
            keyboardElement.style.left = `${x}px`;
            keyboardElement.style.right = "";
        }

        if (originY === "bottom") {
            y = window.innerHeight - y - height;
            keyboardElement.style.top = "";
            keyboardElement.style.bottom = `${y}px`;
        } else {
            keyboardElement.style.top = `${y}px`;
            keyboardElement.style.bottom = "";
        }

        // Only an explicit move updates the remembered position. A resize/show
        // clamps for display (above) but keeps the intended distance, so the
        // keyboard returns to where the user put it once there's room again.
        if (reanchor) {
            placement.x = x;
            placement.y = y;
            placement.originX = originX;
            placement.originY = originY;
        }
    }

    private createKeyboard() {
        const keyboardElement = document.createElement("div");

        keyboardElement.id = "kb-73ce1520-9c19-48ad-bf12-f7ec206ab11f";

        keyboardElement.style.position = "fixed";
        keyboardElement.style.bottom = "0";
        keyboardElement.style.right = "0";
        keyboardElement.style.display = "none";
        keyboardElement.style.border = "none";
        keyboardElement.style.zIndex = "2147483647"; // max int

        // insert the keyboard as the last child of the BODY tag
        const body = document.getElementsByTagName("body")[0];
        body.appendChild(keyboardElement);

        // Header bar (drag handle + collapse/close controls); the keys live in a
        // body wrapper so the header can collapse them away.
        keyboardElement.appendChild(this.createHeader());
        const keyboardBody = document.createElement("div");
        keyboardBody.className = "kb-body";
        keyboardElement.appendChild(keyboardBody);
        this._keyboardBody = keyboardBody;
        this.renderKeyboard(keyboardBody, layouts[this._layoutId]);

        keyboardElement.addEventListener("mousedown", (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (e.button !== 0 || !(e.target instanceof HTMLElement)) {
                return;
            }

            // Drag only from the header bar, and not from its buttons.
            if (e.target.closest(".kb-header") && !e.target.closest("button") && !e.target.closest(".kb-mode")) {
                this._keyboardMovement.mouse.down = true;
                this._movedDuringDrag = false;
                // clientX/Y (CSS px, viewport-relative), not screenX/Y (device px):
                // the placement math is in CSS px, so a device-px delta would move
                // the keyboard at the wrong rate under page zoom (e.g. 2x at 200%).
                this._keyboardMovement.mouse.startX = e.clientX;
                this._keyboardMovement.mouse.startY = e.clientY;
            }

            return;
        });

        document.addEventListener("mouseup", (e) => {
            if (e.button === 0) {
                this.endDrag();
            }
        });

        document.addEventListener("mousemove", (e) => {
            if ((e.buttons & 1) === 0) {
                this.endDrag();
            }

            if (this._keyboardMovement.mouse.down) {
                const dx = e.clientX - this._keyboardMovement.mouse.startX;
                const dy = e.clientY - this._keyboardMovement.mouse.startY;

                this._keyboardMovement.mouse.startX = e.clientX;
                this._keyboardMovement.mouse.startY = e.clientY;

                this.moveKeyboard(dx, dy);
            }

            return false;
        });

        // listen for keydown and make the key on the keyboard active
        document.addEventListener("keydown", (e) => {
            const keyCode = e.code as KeyCode;

            const keyElement = keyboardElement.querySelector(`.${keyCode}`) as HTMLDivElement;

            if (keyElement) {
                keyElement.classList.add("active");
            }

            updateShiftState(e);
        });

        // listen for keyup and make the key on the keyboard inactive
        document.addEventListener("keyup", (e) => {
            const keyCode = e.code as KeyCode;

            const keyElement = keyboardElement.querySelector(`.${keyCode}`) as HTMLDivElement;

            if (keyElement) {
                keyElement.classList.remove("active");
            }

            updateShiftState(e);
        });

        // listen for blur event and remove all active keys
        window.addEventListener("blur", () => {
            const activeKeys = keyboardElement.querySelectorAll(".active");
            activeKeys.forEach((key) => key.classList.remove("active"));
        });

        // update shift state based on the shift key in the keyboard event.
        const updateShiftState = (e: KeyboardEvent) => {
            this.setShift(e.shiftKey);
        };

        // Re-clamp to the viewport when the window (or the visual viewport, e.g.
        // on zoom) changes size, so a smaller viewport can't strand the keyboard
        // off-screen. Only while visible: when hidden, offsetWidth is 0 and
        // placement would compute garbage (showKeyboard re-places it on show).
        const reclampToViewport = () => {
            // Skip if the keyboard isn't in the page or is hidden: a detached
            // element has no meaningful on-screen placement to re-clamp.
            if (keyboardElement.isConnected && keyboardElement.style.display !== "none") {
                this.placeKeyboard();
                // If the guides are still showing (a resize during the post-drop
                // linger), re-track them: the anchor is preserved but the
                // keyboard's rect and the edges have moved.
                if (this._guidesElement?.classList.contains("visible")) {
                    this.updateGuides();
                }
            }
        };
        window.addEventListener("resize", reclampToViewport);
        window.visualViewport?.addEventListener("resize", reclampToViewport);

        this.createGuides();

        return keyboardElement;
    }

    // Builds the anchor-guide overlay: two dotted lines pinned to the viewport
    // edges, hidden until a drag shows them (see showGuides). Appended after the
    // keyboard so the keyboard stays the body's first child (tests and the
    // initial insert rely on that ordering).
    private createGuides() {
        const guides = document.createElement("div");
        guides.id = "kb-guides-3f2a9c7e-7b1d-4e8a-9c2f-1a6b5d4e3c20";

        // Edge highlights: short fat bars whose length runs along the edge and
        // whose thickness crosses it. Centred on the keyboard's midpoint via a
        // -50% translate, with the midpoint coordinate set inline per move.
        const horizontal = document.createElement("div");
        horizontal.className = "kb-guide kb-guide-h";
        horizontal.style.width = GUIDE_EDGE_LENGTH;
        horizontal.style.height = GUIDE_EDGE_THICKNESS;
        horizontal.style.transform = "translateX(-50%)";

        const vertical = document.createElement("div");
        vertical.className = "kb-guide kb-guide-v";
        vertical.style.width = GUIDE_EDGE_THICKNESS;
        vertical.style.height = GUIDE_EDGE_LENGTH;
        vertical.style.transform = "translateY(-50%)";

        // Connectors from the keyboard's edge midpoints out to the anchored edges.
        const connectorX = document.createElement("div");
        connectorX.className = "kb-connector kb-connector-x";

        const connectorY = document.createElement("div");
        connectorY.className = "kb-connector kb-connector-y";

        guides.append(horizontal, vertical, connectorX, connectorY);
        document.getElementsByTagName("body")[0].appendChild(guides);

        this._guidesElement = guides;
        this._guideH = horizontal;
        this._guideV = vertical;
        this._connectorX = connectorX;
        this._connectorY = connectorY;
    }

    // Points the guides at the keyboard's current anchor: the full-edge lines mark
    // which two viewport edges it's anchored to (the four corners are distinguished
    // by which top/bottom + left/right pair is lit), and the connectors run from
    // the keyboard's edge midpoints out to those same edges.
    private updateGuides() {
        const { originX, originY } = this._keyboardPlacement;
        this._guideH?.classList.toggle("top", originY === "top");
        this._guideH?.classList.toggle("bottom", originY === "bottom");
        this._guideV?.classList.toggle("left", originX === "left");
        this._guideV?.classList.toggle("right", originX === "right");

        this.positionGuideGeometry();
    }

    // Places the pixel-positioned parts of the guides — the edge highlight bars
    // and the connector lines — from the keyboard's rendered rect. The edge bars
    // are centred on the keyboard's midpoints (so they line up with the
    // connectors), and each connector runs from a midpoint out to its edge. When
    // the keyboard sits flush against an edge the matching connector has zero
    // length and doesn't show; the edge bar still marks that side.
    private positionGuideGeometry() {
        const connectorX = this._connectorX;
        const connectorY = this._connectorY;
        if (!connectorX || !connectorY) {
            return;
        }

        const rect = this._keyboardElement.getBoundingClientRect();
        const { originX, originY } = this._keyboardPlacement;
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        // Centre each edge bar on the keyboard's midpoint (a -50% translate set at
        // creation does the centring; here we just place the midpoint).
        if (this._guideH) this._guideH.style.left = `${centerX}px`;
        if (this._guideV) this._guideV.style.top = `${centerY}px`;

        // Vertical connector to the top/bottom edge, at the keyboard's horizontal
        // centre. It stops at the inner edge of the edge bar (one bar-thickness off
        // the viewport edge) rather than running all the way to the edge.
        connectorY.style.left = `${centerX}px`;
        if (originY === "bottom") {
            connectorY.style.top = `${rect.bottom}px`;
            connectorY.style.height = `${Math.max(0, window.innerHeight - rect.bottom - GUIDE_EDGE_THICKNESS_PX)}px`;
        } else {
            connectorY.style.top = `${GUIDE_EDGE_THICKNESS_PX}px`;
            connectorY.style.height = `${Math.max(0, rect.top - GUIDE_EDGE_THICKNESS_PX)}px`;
        }

        // Horizontal connector to the left/right edge, at the keyboard's vertical
        // centre. Likewise stops at the inner edge of the bar.
        connectorX.style.top = `${centerY}px`;
        if (originX === "right") {
            connectorX.style.left = `${rect.right}px`;
            connectorX.style.width = `${Math.max(0, window.innerWidth - rect.right - GUIDE_EDGE_THICKNESS_PX)}px`;
        } else {
            connectorX.style.left = `${GUIDE_EDGE_THICKNESS_PX}px`;
            connectorX.style.width = `${Math.max(0, rect.left - GUIDE_EDGE_THICKNESS_PX)}px`;
        }
    }

    // Reveals the guides for the anchor the keyboard now sits at. Idempotent, so
    // it's safe to call on every drag frame; it also cancels any pending fade-out
    // from a previous drop.
    private showGuides() {
        if (this._guideHideTimer) {
            clearTimeout(this._guideHideTimer);
            this._guideHideTimer = undefined;
        }

        this.updateGuides();
        // Clear any "saved" flash from a previous drop in case the user re-grabs
        // mid-fade — this is an active drag again, not a confirmation.
        this._guidesElement?.classList.remove("flash");
        this._guidesElement?.classList.add("visible");
    }

    // Ends the guide display after a drag: a brief brighten to confirm the
    // position was saved, then a fade-out. A no-op if the guides aren't showing
    // (e.g. a header click that never became a drag).
    private hideGuidesAfterDrop() {
        const guides = this._guidesElement;
        if (!guides?.classList.contains("visible") || this._guideHideTimer) {
            return;
        }

        guides.classList.add("flash");
        this._guideHideTimer = setTimeout(() => {
            guides.classList.remove("visible", "flash");
            this._guideHideTimer = undefined;
        }, GUIDE_LINGER_MS);
    }

    private createHeader(): HTMLDivElement {
        const header = document.createElement("div");
        header.className = "kb-header";

        // Mode indicator: mirrors the extension's toolbar icon (shown only while
        // Hangul typing is enabled, see updateModeIndicator) and toggles the mode
        // when clicked — the only mode control left while the keyboard is collapsed.
        this._modeIndicator = document.createElement("img");
        this._modeIndicator.className = "kb-mode";
        this._modeIndicator.addEventListener("click", () => this.toggleHanYong());
        header.appendChild(this._modeIndicator);

        // A flex-grow grab area that also pushes the buttons to the right.
        const handle = document.createElement("div");
        handle.className = "kb-handle";
        header.appendChild(handle);

        this._collapseButton = this.createHeaderButton("kb-collapse", "\u{1F5D5}", "keyboard_minimise", () =>
            this.toggleCollapsed()
        );
        header.appendChild(this._collapseButton);

        header.appendChild(
            this.createHeaderButton("kb-close", "\u{1F5D9}", "keyboard_close", () => this.closeKeyboard())
        );

        return header;
    }

    private createHeaderButton(
        className: string,
        glyph: string,
        titleKey: string,
        onClick: () => void
    ): HTMLButtonElement {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `kb-btn ${className}`;
        button.textContent = glyph;
        const label = api.i18n.getMessage(titleKey);
        button.title = label;
        button.setAttribute("aria-label", label);
        button.addEventListener("click", onClick);
        return button;
    }

    private toggleCollapsed() {
        const collapsed = !this._keyboardElement.classList.contains("collapsed");
        this.setCollapsed(collapsed);

        // The keyboard's size changed, so re-clamp it to stay on-screen (its
        // anchor is preserved).
        this.placeKeyboard();

        // The collapsed state is remembered globally (not per-site).
        this.persistLayout({ collapsed });
    }

    // Apply the collapsed/expanded visual state without re-clamping or
    // persisting — shared by the user toggle and by restoring a saved layout
    // (which runs before the keyboard is shown, so placement happens on show).
    private setCollapsed(collapsed: boolean) {
        this._keyboardElement.classList.toggle("collapsed", collapsed);

        // Collapsed, only the header shows (the keys are hidden)

        if (this._collapseButton) {
            this._collapseButton.textContent = collapsed ? "\u{1F5D6}" : "\u{1F5D5}";
            this._collapseButton.title = api.i18n.getMessage(collapsed ? "keyboard_restore" : "keyboard_minimise");
        }
    }

    // Toggles Hangul/Latin: the shared per-tab mode when Hangul typing is enabled
    // (like the toolbar toggle / Right Alt key), or the OSK's own ephemeral mode
    // when it's disabled. Driven by the 한/영 key and the header mode indicator.
    private toggleHanYong() {
        if (this._isHanYongEnabled) {
            api.runtime.sendMessage<ContentScriptRequestMessage>({
                type: "contentScriptRequest",
                action: ContentScriptRequestAction.ToggleHanYongMode,
            });
        } else {
            this.setMode(
                this._mode === KoreanKeyboardMode.Hangul ? KoreanKeyboardMode.English : KoreanKeyboardMode.Hangul
            );
        }
    }

    private updateModeIndicator() {
        const indicator = this._modeIndicator;
        if (!indicator) {
            return;
        }

        // Mirror the toolbar icon, but only while Hangul typing is enabled: when
        // it's disabled the OSK runs its own independent mode that the toolbar
        // icon doesn't reflect, so showing the icon here would be misleading.
        if (this._isHanYongEnabled === true) {
            indicator.style.display = "";
            const isHangul = this._mode === KoreanKeyboardMode.Hangul;
            indicator.src = isHangul ? modeIconHangul : modeIconEnglish;
            // Label it like the toolbar icon so it has an accessible name and tooltip.
            indicator.alt = api.i18n.getMessage(isHangul ? "action_title_hangul" : "action_title_english");
            indicator.title = indicator.alt;
        } else {
            indicator.style.display = "none";
        }
    }

    private closeKeyboard() {
        // Turn the on-screen keyboard off via the service worker so the tab
        // state (and the context-menu checkbox) stays consistent with the
        // toolbar / menu toggle.
        api.runtime.sendMessage<ContentScriptRequestMessage>({
            type: "contentScriptRequest",
            action: ContentScriptRequestAction.DisableOnScreenKeyboard,
        });
    }

    /**
     * Handles mouse down events for KBD elements, i.e. keys on the keyboard.
     * @param e
     * @param key
     * @param keyCode
     */
    private handleKbdMouseDown(e: MouseEvent, key: KeyRecord, keyCode: KeyCode) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        const target = e.target as HTMLElement;
        const closestKbd = target.closest("kbd");

        if (!closestKbd || closestKbd.classList.contains("disabled")) {
            return;
        }

        const isHanMode = this._mode === KoreanKeyboardMode.Hangul;
        const isShift = this._isShift;

        if (key.jamo && isHanMode) {
            const jamoToAdd = isShift && key.jamo.shift ? key.jamo.shift : key.jamo.normal;

            this.sendKey(jamoToAdd, keyCode);
        } else if (key.normal && (!isHanMode || !key.jamo)) {
            const keyToSend = isShift && key.shift ? key.shift : key.normal;

            this.sendKey(keyToSend, keyCode);
        } else if (key.label === "Shift") {
            this.setShift(!isShift);
        } else if (keyCode === KeyCode.AltRight || keyCode === KeyCode.Lang1) {
            this.toggleHanYong();
        } else if (keyCode === KeyCode.Space) {
            this.sendKey(" ", keyCode);
        } else if (keyCode === KeyCode.Backspace) {
            this.sendKey("Backspace", keyCode);
        }
    }

    private sendKey(key: string, keyCode: KeyCode) {
        debugLog(`Sending key: ${key} (${keyCode})`);
        this._onSendKey(key, keyCode);
    }

    private createLabelElement(className: string, text: string): HTMLElement {
        const label = document.createElement("div");
        label.className = className;
        label.innerText = text;
        return label;
    }

    private renderNormalKeyLabels(keyElement: HTMLElement, key: KeyRecord): void {
        if (!key.normal) return;

        const yongClass = key.jamo ? " yong" : "";
        const baseLabel = this.createLabelElement(`base${yongClass}`, key.normal);
        keyElement.appendChild(baseLabel);

        if (key.shift) {
            const shiftLabel = this.createLabelElement(`shift${yongClass}`, key.shift);
            keyElement.appendChild(shiftLabel);
        }
    }

    private renderJamoKeyLabels(keyElement: HTMLElement, key: KeyRecord): void {
        if (!key.jamo) return;

        if (key.jamo.shift) {
            const shiftJamo = this.createLabelElement("shift jamo", key.jamo.shift);
            keyElement.appendChild(shiftJamo);
        }

        const baseJamoClassName = "shift" in key.jamo && key.jamo.shift ? "base jamo" : "full jamo";
        const baseJamo = this.createLabelElement(baseJamoClassName, key.jamo.normal);
        keyElement.appendChild(baseJamo);
    }

    private renderSpecialKeyLabels(keyElement: HTMLElement, key: KeyRecord, keyCode: KeyCode): void {
        if (keyCode === KeyCode.ShiftLeft || keyCode === KeyCode.ShiftRight) {
            const label = this.createLabelElement("full", "⇧");
            keyElement.appendChild(label);
        } else if (keyCode === KeyCode.AltRight) {
            const hanLabel = this.createLabelElement("hanMode", "한");
            const yongLabel = this.createLabelElement("yongMode", "영");
            keyElement.appendChild(hanLabel);
            keyElement.appendChild(yongLabel);
        } else if (key.label) {
            const label = this.createLabelElement("full", key.label);
            keyElement.appendChild(label);

            if (key.koreanLabel) {
                const koreanLabel = this.createLabelElement("full jamo", key.koreanLabel);
                keyElement.appendChild(koreanLabel);
                label.classList.add("yong");
            }
        }
    }

    private renderKey(rowElement: HTMLDivElement, layoutKey: LayoutKey) {
        const { code, width, inert } = layoutKey;
        const keyElement = document.createElement("kbd");
        const key = keyMap[code];

        keyElement.className = code;
        if (width !== undefined) {
            // Width in key-units; the CSS turns it into px via --key-unit.
            keyElement.style.setProperty("--key-span", String(width));
        }

        if (inert) {
            // Shown for keyboard fidelity but de-emphasised and non-interactive.
            keyElement.classList.add("inert");
        } else {
            keyElement.addEventListener("mousedown", (e) => this.handleKbdMouseDown(e, key, code));
        }

        this.renderNormalKeyLabels(keyElement, key);
        this.renderJamoKeyLabels(keyElement, key);
        this.renderSpecialKeyLabels(keyElement, key, code);

        if (key.tooltipResourceKey) {
            keyElement.title = api.i18n.getMessage(key.tooltipResourceKey);
        }

        rowElement.appendChild(keyElement);

        return keyElement;
    }

    /** Swap the rendered layout (e.g. when the layout setting changes). */
    public setLayout(layoutId: LayoutId) {
        // Tolerate a stale/corrupt stored id: only known layouts are applied.
        const layout = (layouts as Record<string, KeyboardLayout | undefined>)[layoutId];
        if (!layout || layoutId === this._layoutId || !this._keyboardBody) {
            return;
        }
        this._layoutId = layoutId;
        this.renderKeyboard(this._keyboardBody, layout);
        // Re-apply state that the freshly rendered keys need to reflect.
        this.updateKeyVisibility();
        // The keyboard's size changed, so re-clamp it (only while shown — hidden,
        // offsetWidth is 0 and showKeyboard re-places it on show).
        if (this._keyboardElement.style.display !== "none") {
            this.placeKeyboard();
        }
    }

    /**
     * Renders the layout's keys into the keyboard body, replacing any existing
     * ones (so it can be called again to switch layouts).
     */
    private renderKeyboard(keyboardElement: HTMLDivElement, layout: KeyboardLayout): void {
        this._keyElements.clear();
        keyboardElement.replaceChildren();

        layout.forEach((row) => {
            const rowElement = document.createElement("div");
            rowElement.className = "row";

            for (const layoutKey of row) {
                const keyElement = this.renderKey(rowElement, layoutKey);
                this._keyElements.set(layoutKey.code, keyElement);
            }

            keyboardElement.appendChild(rowElement);
        });
    }
}
