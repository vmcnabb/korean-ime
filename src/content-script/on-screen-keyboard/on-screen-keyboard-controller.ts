import { KoreanKeyboardMode } from "../../extension-state/korean-keyboard-mode";
import { KeyCode, KeyRecord, keyMap } from "../../keyboard/korean-keyboard-map";
import { KeyboardLayout, LayoutKey, LayoutId, layouts, defaultLayoutId } from "./layouts";
import { SupportedCompositionFeatures } from "../../composition/composition-adapters/composition-adapter-interface";
import "./on-screen-keyboard.scss";
import {
    ContentScriptRequestAction,
    ContentScriptRequestMessage,
    PersistOnScreenKeyboardLayoutMessage,
} from "../../messaging/content-to-service-messages";
import { debugLog } from "../../debug-log";
import { api } from "../../platform/browser-api";
import { modeIconHangul, modeIconEnglish, modeIconHangulSrcset, modeIconEnglishSrcset } from "./mode-icons";
import {
    KeyboardPlacement,
    OnScreenKeyboardLayout,
    DEFAULT_KEY_UNIT_PX,
    MIN_KEY_UNIT_PX,
    MAX_KEY_UNIT_PX,
} from "../../extension-state/osk-layout";
import { currentOskSite } from "../osk-site";
import { t, type MessageKey } from "../../i18n";

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

/** Slack kept between the keyboard and the viewport edge when clamping its size. */
const VIEWPORT_MARGIN_PX = 0;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Just the anchored corner of a placement — the two edges the guides light up. */
type AnchorCorner = Pick<KeyboardPlacement, "originX" | "originY">;

// Clamp one axis of the keyboard's top-left so it stays within the viewport. When
// the keyboard is larger than the viewport it can't fit either way, so keep the
// anchored edge on-screen (overflowing off the opposite one) rather than pinning
// the far edge and pushing the anchored one off. `anchoredFar` = anchored to the
// right/bottom edge.
const clampAxis = (pos: number, size: number, container: number, anchoredFar: boolean): number =>
    size > container ? (anchoredFar ? container - size : 0) : clamp(pos, 0, container - size);

/** Layouts shown in the in-header drop-down, with their i18n label keys. */
const LAYOUT_OPTIONS: { id: LayoutId; messageKey: MessageKey }[] = [
    { id: LayoutId.Minimal, messageKey: "options_onScreenKeyboard_layout_minimal" },
    { id: LayoutId.FullUs, messageKey: "options_onScreenKeyboard_layout_fullUs" },
    { id: LayoutId.FullKorean, messageKey: "options_onScreenKeyboard_layout_fullKorean" },
];

export class OnScreenKeyboardController {
    private _keyboardContainer: HTMLDivElement;
    private _keyboardElement: HTMLDivElement;
    private _keyboardPlacement: KeyboardPlacement = {
        originX: "right",
        originY: "bottom",
        x: 0,
        y: 0,
    };
    // Active header-drag state. While a drag is in progress the keyboard is moved
    // with a cheap compositor transform (its own layer, via will-change) and only
    // re-laid-out once, on drop; pointer moves are coalesced into one update per
    // animation frame (see scheduleDragFrame). Undefined when not dragging.
    private _drag?: {
        pointerX: number; // pointer clientX/Y where the grab began…
        pointerY: number;
        latestX: number; // …and the most recent pointer position, read on the next frame.
        latestY: number;
        baseX: number; // the keyboard's rendered top-left (transform) at the grab,…
        baseY: number;
        width: number; // …and its size, captured once so drag frames need no layout.
        height: number;
    };
    private _dragFramePending = false;
    // Whether the keyboard actually moved during the current drag, so a drop
    // persists the new position only after a real move (not a bare header click).
    private _movedDuringDrag = false;

    // The user's intended key size (px); the board scales from it. May be
    // rendered smaller when the viewport can't fit it (clamped in placeKeyboard),
    // but the intended size is kept so it's restored when there's room again.
    private _keyUnit = DEFAULT_KEY_UNIT_PX;
    // Drag-resize state, captured at pointer-down on a corner grip. The pivot is
    // the corner opposite the dragged one; it stays fixed while the keyboard
    // resizes. The relayout is coalesced into one update per animation frame.
    private _resize?: {
        pivotX: number;
        pivotY: number;
        pivotIsLeft: boolean;
        pivotIsTop: boolean;
        startDist: number;
        startUnit: number;
        pointerId: number;
        latestX: number; // most recent pointer position, read on the next frame.
        latestY: number;
    };
    private _resizeFramePending = false;

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
    // In-header layout drop-down: a custom (focus-preserving) menu of layouts.
    private _layoutMenu?: HTMLDivElement;
    private _layoutMenuOpen = false;
    private _layoutOptionButtons = new Map<LayoutId, HTMLButtonElement>();
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
    // Called when the user picks a layout from the in-header drop-down, so the
    // (synced) layout setting can be updated — keeping it in step with the
    // options page.
    private _onLayoutChange: (layoutId: LayoutId) => void;

    constructor(
        onSendKey: (key: string, keyCode: KeyCode) => void,
        onLayoutChange: (layoutId: LayoutId) => void = () => {}
    ) {
        this._onSendKey = onSendKey;
        this._onLayoutChange = onLayoutChange;
        this._keyboardContainer = document.createElement("div");
        this._keyboardContainer.id = "osk-container-67064f11-f376-47ac-abac-ce5e08ed5f45";
        this._keyboardElement = this.createKeyboard();

        // insert the keyboard as the last child of the BODY tag
        const body = document.getElementsByTagName("body")[0];
        body.appendChild(this._keyboardContainer);
        this._keyboardContainer.appendChild(this._keyboardElement);
        const guides = this.createGuides();
        this._keyboardContainer.appendChild(guides);

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

    private startDrag(clientX: number, clientY: number) {
        // Start from where the keyboard is actually rendered (its current transform),
        // not the stored placement offset: while clamped into a small viewport the
        // two can diverge, and starting from the stale offset would jump the first
        // frame. clientX/Y (CSS px, viewport-relative), not screenX/Y (device px):
        // the math is in CSS px, so a device-px delta would move the keyboard at the
        // wrong rate under page zoom (e.g. 2x at 200%).
        const { x, y } = this.currentVisualPosition();
        this._drag = {
            pointerX: clientX,
            pointerY: clientY,
            latestX: clientX,
            latestY: clientY,
            baseX: x,
            baseY: y,
            width: this._keyboardElement.offsetWidth,
            height: this._keyboardElement.offsetHeight,
        };
        this._movedDuringDrag = false;
        // Cursor feedback is class-driven, not :active — Firefox drops :active
        // because the mousedown handler calls preventDefault (see the scss).
        this._keyboardElement.classList.add("dragging");
    }

    // Coalesce pointer moves into at most one DOM write per animation frame, no
    // matter how often mousemove fires.
    private scheduleDragFrame() {
        if (this._dragFramePending) {
            return;
        }
        this._dragFramePending = true;
        requestAnimationFrame(() => {
            this._dragFramePending = false;
            this.renderDragFrame();
        });
    }

    private renderDragFrame() {
        const drag = this._drag;
        if (!drag) {
            return;
        }
        // The keyboard is positioned by its transform at all times (resting and
        // dragging), so a drag is just transform math — a compositor-only move with
        // no layout and no left/top hand-off on drop. Clamp live, so it can't be
        // dragged off-screen (and so there's nothing to snap back on release).
        const { px, py } = this.clampDragPosition(drag);
        this.setPosition(px, py);
        this._movedDuringDrag = true;
        // Surface the corner it would snap to right now, without committing it.
        this.showGuides(this.anchorFor(px, py, drag.width, drag.height));
    }

    private clampDragPosition(drag: NonNullable<OnScreenKeyboardController["_drag"]>): { px: number; py: number } {
        return {
            px: clampAxis(
                drag.baseX + (drag.latestX - drag.pointerX),
                drag.width,
                this._keyboardContainer.clientWidth,
                false
            ),
            py: clampAxis(
                drag.baseY + (drag.latestY - drag.pointerY),
                drag.height,
                this._keyboardContainer.clientHeight,
                false
            ),
        };
    }

    // The anchor a keyboard at top-left (px,py) would take — the viewport quadrant
    // of its centre. Read-only; drives the guides during a drag.
    private anchorFor(px: number, py: number, width: number, height: number): AnchorCorner {
        return {
            originX: px + width / 2 > this._keyboardContainer.clientWidth / 2 ? "right" : "left",
            originY: py + height / 2 > this._keyboardContainer.clientHeight / 2 ? "bottom" : "top",
        };
    }

    private endDrag() {
        const drag = this._drag;
        if (!drag) {
            return;
        }
        this._drag = undefined;
        this._keyboardElement.classList.remove("dragging");

        if (this._movedDuringDrag) {
            // The keyboard is already sitting at its dropped position (a transform).
            // Just record that position into the placement and re-anchor — no
            // transform→left/top hand-off, so nothing moves on the compositor: no
            // flash, no jump. The transform we re-apply equals what's on screen.
            const { px, py } = this.clampDragPosition(drag);
            this.reanchorTo(px, py, drag.width, drag.height);
            this.setPosition(px, py);
            this._movedDuringDrag = false;
            this.persistLayout({ position: this._keyboardPlacement });
        }

        this.hideGuidesAfterDrop();
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
        if (layout.keyUnit !== undefined) {
            this._keyUnit = clamp(layout.keyUnit, MIN_KEY_UNIT_PX, MAX_KEY_UNIT_PX);
        }
        this.setCollapsed(layout.collapsed);
    }

    /** Set the intended key size (px), re-render at the new size, and persist it. */
    private setKeyUnit(keyUnit: number, persist: boolean) {
        this._keyUnit = clamp(keyUnit, MIN_KEY_UNIT_PX, MAX_KEY_UNIT_PX);

        if (this._keyboardElement.style.display !== "none") {
            this.placeKeyboard(); // applies the size and re-clamps on-screen
        }

        if (persist) {
            this.persistLayout({ keyUnit: this._keyUnit });
        }
    }

    // Ask the service worker to persist whichever layout fields changed. A
    // position needs a site key (skipped where there's none, e.g. file://); the
    // collapsed state and key size are global. Best-effort — failures are ignored.
    private persistLayout(update: { position?: KeyboardPlacement; collapsed?: boolean; keyUnit?: number }) {
        const data: PersistOnScreenKeyboardLayoutMessage["data"] = {};

        if (update.collapsed !== undefined) {
            data.collapsed = update.collapsed;
        }
        if (update.keyUnit !== undefined) {
            data.keyUnit = update.keyUnit;
        }
        if (update.position) {
            const site = currentOskSite();
            if (site) {
                data.site = site;
                data.position = update.position;
            }
        }

        if (Object.keys(data).length === 0) {
            return;
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
        // Apply the intended key size, shrinking it if the viewport can't fit it,
        // before resolvePosition reads offsetWidth/Height.
        this.applyKeyUnit();
        const { px, py } = this.resolvePosition(reanchor);
        this.setPosition(px, py);
    }

    // Resolve the keyboard's clamped top-left (container coords) from the stored
    // placement. With reanchor, re-pick the corner from the resulting quadrant and
    // rewrite the placement's anchor + offsets to match (an explicit move re-homes
    // to the nearest corner; a resize/show re-clamp keeps the existing anchor, so
    // the keyboard returns to its corner instead of flipping across a midline).
    private resolvePosition(reanchor: boolean): { px: number; py: number } {
        const placement = this._keyboardPlacement;
        const width = this._keyboardElement.offsetWidth;
        const height = this._keyboardElement.offsetHeight;
        const containerW = this._keyboardContainer.clientWidth;
        const containerH = this._keyboardContainer.clientHeight;

        const px = clampAxis(
            placement.originX === "right" ? containerW - width - placement.x : placement.x,
            width,
            containerW,
            placement.originX === "right"
        );
        const py = clampAxis(
            placement.originY === "bottom" ? containerH - height - placement.y : placement.y,
            height,
            containerH,
            placement.originY === "bottom"
        );

        if (reanchor) {
            this.reanchorTo(px, py, width, height);
        }
        return { px, py };
    }

    // Re-home the placement to the corner nearest a keyboard at top-left (px,py):
    // pick the corner from its centre's quadrant, then store the offset as a
    // distance from that corner's edges.
    private reanchorTo(px: number, py: number, width: number, height: number) {
        const placement = this._keyboardPlacement;
        const containerW = this._keyboardContainer.clientWidth;
        const containerH = this._keyboardContainer.clientHeight;
        const { originX, originY } = this.anchorFor(px, py, width, height);

        placement.originX = originX;
        placement.originY = originY;
        placement.x = originX === "right" ? containerW - px - width : px;
        placement.y = originY === "bottom" ? containerH - py - height : py;
    }

    // Move the keyboard to a viewport-space top-left, changing *only* the transform.
    // The keyboard's position is (left/top base) + transform; the base is normally 0
    // but a resize parks a non-zero base on it (see endResize). Writing through the
    // transform alone keeps every move a pure compositor change — no layout touched,
    // so nothing can desync or flash.
    private setPosition(x: number, y: number) {
        const style = this._keyboardElement.style;
        const baseX = parseFloat(style.left) || 0;
        const baseY = parseFloat(style.top) || 0;
        style.transform = `translate(${x - baseX}px, ${y - baseY}px)`;
    }

    // The transform's translate, parsed back from the style.
    private currentTranslate(): { px: number; py: number } {
        const match = /translate\(\s*(-?[\d.]+)px\s*,\s*(-?[\d.]+)px\s*\)/.exec(this._keyboardElement.style.transform);
        return match ? { px: parseFloat(match[1]), py: parseFloat(match[2]) } : { px: 0, py: 0 };
    }

    // The keyboard's rendered top-left (viewport space): the left/top base plus the
    // transform. Equals the transform when the base is 0 (the usual case).
    private currentVisualPosition(): { x: number; y: number } {
        const { px, py } = this.currentTranslate();
        const style = this._keyboardElement.style;
        return { x: (parseFloat(style.left) || 0) + px, y: (parseFloat(style.top) || 0) + py };
    }

    // Set --key-unit to the intended size, then shrink it just enough that the
    // rendered keyboard fits the viewport (the intended size is kept for restore).
    private applyKeyUnit() {
        const el = this._keyboardElement;
        el.style.setProperty("--key-unit", `${this._keyUnit}px`);

        if (el.style.display === "none") {
            return; // hidden: offsetWidth is 0, nothing meaningful to clamp
        }

        const availWidth = this._keyboardContainer.clientWidth - VIEWPORT_MARGIN_PX;
        const availHeight = this._keyboardContainer.clientHeight - VIEWPORT_MARGIN_PX;

        // offsetWidth includes fixed chrome (borders/padding/gaps), so the unit
        // isn't perfectly proportional to it; a couple of passes converge.
        for (let i = 0; i < 3; i++) {
            const scale = Math.min(1, availWidth / el.offsetWidth, availHeight / el.offsetHeight);
            if (scale >= 1) {
                break;
            }
            const current = parseFloat(getComputedStyle(el).getPropertyValue("--key-unit")) || this._keyUnit;
            el.style.setProperty("--key-unit", `${Math.max(MIN_KEY_UNIT_PX, current * scale)}px`);
        }
    }

    // Coalesce resize pointer moves into one update per animation frame.
    private scheduleResizeFrame() {
        if (this._resizeFramePending) {
            return;
        }
        this._resizeFramePending = true;
        requestAnimationFrame(() => {
            this._resizeFramePending = false;
            this.renderResizeFrame();
        });
    }

    // Resize the keyboard for real (relayout to the new --key-unit) once per frame.
    // *Only* the size changes here — the pivot corner is held fixed by a CSS layout
    // anchor pinned on pointer-down (see anchorResizePivot), so there's no per-frame
    // position update. That matters because the keyboard is on its own compositor
    // layer: a size change re-rasters the layer (main thread) while any position
    // change (transform *or* left/top) is a layer placement the compositor applies a
    // frame later on heavy pages — so repositioning each frame makes the pivot drift.
    // With the anchor doing the work, the layer just grows in place. Crisp every
    // frame, and the page beneath still doesn't repaint.
    private renderResizeFrame() {
        const resize = this._resize;
        if (!resize) {
            return;
        }
        const dist = Math.hypot(resize.latestX - resize.pivotX, resize.latestY - resize.pivotY);
        this._keyUnit = clamp((resize.startUnit * dist) / resize.startDist, MIN_KEY_UNIT_PX, MAX_KEY_UNIT_PX);
        this._keyboardElement.style.setProperty("--key-unit", `${this._keyUnit}px`);
        // Then lock it to the viewport: growing away from the pinned pivot must not
        // push the keyboard off-screen, so shrink the unit just enough that the
        // rendered board still fits the room between the pivot and the edge it grows
        // toward. (Shrinking the keyboard never trips this — there's always room.)
        this.clampResizeToViewport(resize);
    }

    // Cap --key-unit (and _keyUnit) so the resizing keyboard stays on-screen on the
    // side it's growing toward. The pivot edge is held fixed (see anchorResizePivot),
    // so a resize only ever extends the opposite edge; the room is the gap from the
    // pivot out to the viewport edge in that direction. Iterates because fixed chrome
    // (borders/padding/gaps) makes the size only roughly proportional to the unit, so
    // one pass can overshoot — mirrors applyKeyUnit's convergence loop.
    private clampResizeToViewport(resize: NonNullable<OnScreenKeyboardController["_resize"]>) {
        const el = this._keyboardElement;
        const availW =
            (resize.pivotIsLeft ? this._keyboardContainer.clientWidth - resize.pivotX : resize.pivotX) -
            VIEWPORT_MARGIN_PX;
        const availH =
            (resize.pivotIsTop ? this._keyboardContainer.clientHeight - resize.pivotY : resize.pivotY) -
            VIEWPORT_MARGIN_PX;
        for (let i = 0; i < 3; i++) {
            const scale = Math.min(1, availW / el.offsetWidth, availH / el.offsetHeight);
            if (scale >= 1) {
                break;
            }
            this._keyUnit = Math.max(MIN_KEY_UNIT_PX, this._keyUnit * scale);
            el.style.setProperty("--key-unit", `${this._keyUnit}px`);
        }
    }

    // Pin the pivot corner (the one opposite the dragged grip) with CSS layout edges,
    // keeping the resting transform unchanged. While the keyboard then resizes, the
    // anchored edges stay put, so the pivot is held without any per-frame
    // repositioning. transformX/Y are the resting transform (currentTranslate); the
    // anchor edge in layout space is the pivot minus that, so anchor + transform lands
    // the pivot back on its captured viewport point.
    private anchorResizePivot(transformX: number, transformY: number) {
        const resize = this._resize;
        if (!resize) {
            return;
        }
        const style = this._keyboardElement.style;
        const edgeX = resize.pivotX - transformX;
        const edgeY = resize.pivotY - transformY;

        if (resize.pivotIsLeft) {
            style.left = `${edgeX}px`;
            style.right = "auto";
        } else {
            style.left = "auto";
            style.right = `${this._keyboardContainer.clientWidth - edgeX}px`;
        }
        if (resize.pivotIsTop) {
            style.top = `${edgeY}px`;
            style.bottom = "auto";
        } else {
            style.top = "auto";
            style.bottom = `${this._keyboardContainer.clientHeight - edgeY}px`;
        }
    }

    private createKeyboard() {
        const keyboardElement = document.createElement("div");

        keyboardElement.id = "kb-73ce1520-9c19-48ad-bf12-f7ec206ab11f";

        keyboardElement.style.position = "absolute";
        // Positioned by (left/top base) + transform (see setPosition); the base is 0
        // here and stays 0 except for a resize's residual offset. will-change keeps it
        // on its own compositor layer for the whole session, so moving it is a GPU
        // composite and there's never a layer promote/teardown — which caused the
        // on-drop jump.
        keyboardElement.style.left = "0";
        keyboardElement.style.top = "0";
        keyboardElement.style.willChange = "transform";
        keyboardElement.style.display = "none";

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

            // Drag only from the header bar, and not from its controls.
            if (
                e.target.closest(".kb-header") &&
                !e.target.closest("button") &&
                !e.target.closest(".kb-mode") &&
                !e.target.closest(".kb-layout")
            ) {
                this.startDrag(e.clientX, e.clientY);
            }

            return;
        });

        document.addEventListener("mouseup", (e) => {
            if (e.button === 0) {
                this.endDrag();
            }
        });

        document.addEventListener("mousemove", (e) => {
            if (!this._drag) {
                return;
            }
            // The button was released without a mouseup reaching us (e.g. off-screen):
            // end the drag here so it can't get stuck following the cursor.
            if ((e.buttons & 1) === 0) {
                this.endDrag();
                return;
            }
            this._drag.latestX = e.clientX;
            this._drag.latestY = e.clientY;
            this.scheduleDragFrame();
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
            // Skip during an active drag or resize: the keyboard is positioned/sized
            // by a transform then, and placeKeyboard would fight it. The drop/commit
            // re-clamps anyway.
            if (this._drag || this._resize) {
                return;
            }
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

        for (const corner of ["tl", "tr", "bl", "br"] as const) {
            keyboardElement.appendChild(this.createResizeGrip(corner));
        }

        return keyboardElement;
    }

    // A corner grip for drag-resizing the keyboard. Any of the four corners works:
    // the dragged corner tracks the cursor while the opposite (pivot) corner stays
    // put; applyResize updates the anchor offset to keep it there. Scales
    // --key-unit live (pointer capture during the drag), persists on release, and
    // resets to the default size on double-click.
    private createResizeGrip(corner: "tl" | "tr" | "bl" | "br"): HTMLDivElement {
        const grip = document.createElement("div");
        grip.className = `kb-resize-grip kb-grip-${corner}`;
        const cornerIsLeft = corner === "tl" || corner === "bl";
        const cornerIsTop = corner === "tl" || corner === "tr";

        grip.addEventListener("pointerdown", (e) => {
            // No resizing while collapsed (the grips are also hidden via CSS then).
            if (e.button !== 0 || this._keyboardElement.classList.contains("collapsed")) {
                return;
            }
            e.preventDefault();
            e.stopPropagation();

            const rect = this._keyboardElement.getBoundingClientRect();
            const { px, py } = this.currentTranslate();
            // The pivot is the corner opposite the one being dragged; it stays put.
            this._resize = {
                pivotX: cornerIsLeft ? rect.right : rect.left,
                pivotY: cornerIsTop ? rect.bottom : rect.top,
                pivotIsLeft: !cornerIsLeft,
                pivotIsTop: !cornerIsTop,
                startDist: Math.hypot(rect.width, rect.height) || 1,
                startUnit: this._keyUnit,
                pointerId: e.pointerId,
                latestX: e.clientX,
                latestY: e.clientY,
            };
            // Pin the pivot via layout edges, so resizing alone holds it fixed.
            this.anchorResizePivot(px, py);
            // Capture so the drag keeps tracking even if the cursor leaves the
            // grip. Not critical (and absent in jsdom), so tolerate failure.
            try {
                grip.setPointerCapture(e.pointerId);
            } catch {
                /* pointer capture unavailable */
            }
        });

        grip.addEventListener("pointermove", (e) => {
            const resize = this._resize;
            if (!resize) {
                return;
            }
            resize.latestX = e.clientX;
            resize.latestY = e.clientY;
            this.scheduleResizeFrame();
        });

        const endResize = (e: PointerEvent) => {
            const resize = this._resize;
            if (!resize) {
                return;
            }
            this._resize = undefined;
            try {
                if (grip.hasPointerCapture(e.pointerId)) {
                    grip.releasePointerCapture(e.pointerId);
                }
            } catch {
                /* pointer capture unavailable */
            }

            // Convert the pivot anchor back to a plain left/top base, KEEPING the
            // transform unchanged. A transform change here would flash on the
            // compositor layer (the swap we avoid for drag); a pure left/top change at
            // the same position does not. The base just becomes the resize's residual
            // offset, which setPosition/currentVisualPosition account for thereafter.
            const el = this._keyboardElement;
            const width = el.offsetWidth;
            const height = el.offsetHeight;
            const finalX = resize.pivotIsLeft ? resize.pivotX : resize.pivotX - width;
            const finalY = resize.pivotIsTop ? resize.pivotY : resize.pivotY - height;
            const { px, py } = this.currentTranslate();
            el.style.left = `${finalX - px}px`; // base + transform = finalX/Y (visual unchanged)
            el.style.top = `${finalY - py}px`;
            el.style.right = "auto";
            el.style.bottom = "auto";

            const placement = this._keyboardPlacement;
            placement.x = placement.originX === "right" ? this._keyboardContainer.clientWidth - finalX - width : finalX;
            placement.y =
                placement.originY === "bottom" ? this._keyboardContainer.clientHeight - finalY - height : finalY;
            this.persistLayout({ keyUnit: this._keyUnit });
        };
        grip.addEventListener("pointerup", endResize);
        grip.addEventListener("pointercancel", endResize);

        // Double-click resets to the default size (not while collapsed).
        grip.addEventListener("dblclick", (e) => {
            if (this._keyboardElement.classList.contains("collapsed")) {
                return;
            }
            e.preventDefault();
            e.stopPropagation();
            this.setKeyUnit(DEFAULT_KEY_UNIT_PX, true);
        });

        return grip;
    }

    // Builds the anchor-guide overlay: two dotted lines pinned to the viewport
    // edges, hidden until a drag shows them (see showGuides).
    private createGuides(): HTMLDivElement {
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

        this._guidesElement = guides;
        this._guideH = horizontal;
        this._guideV = vertical;
        this._connectorX = connectorX;
        this._connectorY = connectorY;
        return guides;
    }

    // Points the guides at the keyboard's current anchor: the full-edge lines mark
    // which two viewport edges it's anchored to (the four corners are distinguished
    // by which top/bottom + left/right pair is lit), and the connectors run from
    // the keyboard's edge midpoints out to those same edges.
    private updateGuides(anchor: AnchorCorner = this._keyboardPlacement) {
        const { originX, originY } = anchor;
        this._guideH?.classList.toggle("top", originY === "top");
        this._guideH?.classList.toggle("bottom", originY === "bottom");
        this._guideV?.classList.toggle("left", originX === "left");
        this._guideV?.classList.toggle("right", originX === "right");

        this.positionGuideGeometry(anchor);
    }

    // Places the pixel-positioned parts of the guides — the edge highlight bars
    // and the connector lines — from the keyboard's rendered rect. The edge bars
    // are centred on the keyboard's midpoints (so they line up with the
    // connectors), and each connector runs from a midpoint out to its edge. When
    // the keyboard sits flush against an edge the matching connector has zero
    // length and doesn't show; the edge bar still marks that side.
    private positionGuideGeometry(anchor: AnchorCorner = this._keyboardPlacement) {
        const connectorX = this._connectorX;
        const connectorY = this._connectorY;
        if (!connectorX || !connectorY) {
            return;
        }

        const rect = this._keyboardElement.getBoundingClientRect();
        const { originX, originY } = anchor;
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
            connectorY.style.height = `${Math.max(0, this._keyboardContainer.clientHeight - rect.bottom - GUIDE_EDGE_THICKNESS_PX)}px`;
        } else {
            connectorY.style.top = `${GUIDE_EDGE_THICKNESS_PX}px`;
            connectorY.style.height = `${Math.max(0, rect.top - GUIDE_EDGE_THICKNESS_PX)}px`;
        }

        // Horizontal connector to the left/right edge, at the keyboard's vertical
        // centre. Likewise stops at the inner edge of the bar.
        connectorX.style.top = `${centerY}px`;
        if (originX === "right") {
            connectorX.style.left = `${rect.right}px`;
            connectorX.style.width = `${Math.max(0, this._keyboardContainer.clientWidth - rect.right - GUIDE_EDGE_THICKNESS_PX)}px`;
        } else {
            connectorX.style.left = `${GUIDE_EDGE_THICKNESS_PX}px`;
            connectorX.style.width = `${Math.max(0, rect.left - GUIDE_EDGE_THICKNESS_PX)}px`;
        }
    }

    // Reveals the guides for the anchor the keyboard now sits at. Idempotent, so
    // it's safe to call on every drag frame; it also cancels any pending fade-out
    // from a previous drop.
    private showGuides(anchor?: AnchorCorner) {
        if (this._guideHideTimer) {
            clearTimeout(this._guideHideTimer);
            this._guideHideTimer = undefined;
        }

        this.updateGuides(anchor);
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

        header.appendChild(this.createLayoutControl());

        // A flex-grow grab area that also pushes the buttons to the right.
        const handle = document.createElement("div");
        handle.className = "kb-handle";
        header.appendChild(handle);

        this._collapseButton = this.createHeaderButton("kb-collapse", "\u{1F5D5}", "keyboard_minimize", () =>
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
        titleKey: MessageKey,
        onClick: () => void
    ): HTMLButtonElement {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `kb-btn ${className}`;
        button.textContent = glyph;
        const label = t(titleKey);
        button.title = label;
        button.setAttribute("aria-label", label);
        button.addEventListener("click", onClick);
        return button;
    }

    // The in-header layout drop-down. Built from buttons (not a native <select>),
    // so the keyboard's mousedown-preventDefault keeps page focus — a <select>
    // would steal it and break typing into the focused field.
    private createLayoutControl(): HTMLDivElement {
        const control = document.createElement("div");
        control.className = "kb-layout";

        const trigger = this.createHeaderButton("kb-layout-trigger", "\u{2328}", "keyboard_layout", () =>
            this.toggleLayoutMenu()
        );
        trigger.setAttribute("aria-haspopup", "true");
        control.appendChild(trigger);

        const menu = document.createElement("div");
        menu.className = "kb-layout-menu";
        this._layoutMenu = menu;
        this._layoutOptionButtons.clear();

        for (const option of LAYOUT_OPTIONS) {
            const item = document.createElement("button");
            item.type = "button";
            item.className = "kb-layout-option";
            item.textContent = t(option.messageKey);
            item.addEventListener("click", () => this.selectLayout(option.id));
            this._layoutOptionButtons.set(option.id, item);
            menu.appendChild(item);
        }

        control.appendChild(menu);
        this.updateLayoutControl();

        // Close the menu when interacting anywhere outside the control (clicks on
        // the keyboard's keys/handle are stopPropagated, so this catches the page;
        // the keyboard mousedown handler closes it for in-keyboard clicks).
        document.addEventListener("pointerdown", (e) => {
            if (this._layoutMenuOpen && !(e.target instanceof Element && e.target.closest(".kb-layout"))) {
                this.closeLayoutMenu();
            }
        });

        return control;
    }

    private toggleLayoutMenu() {
        if (this._layoutMenuOpen) {
            this.closeLayoutMenu();
        } else {
            this.openLayoutMenu();
        }
    }

    private openLayoutMenu() {
        this._layoutMenuOpen = true;
        this._layoutMenu?.classList.add("open");
    }

    private closeLayoutMenu() {
        this._layoutMenuOpen = false;
        this._layoutMenu?.classList.remove("open");
    }

    private selectLayout(layoutId: LayoutId) {
        this.closeLayoutMenu();
        this.setLayout(layoutId); // apply immediately
        this._onLayoutChange(layoutId); // persist the (synced) setting
    }

    // Reflect the current layout in the drop-down (selected option + trigger title).
    private updateLayoutControl() {
        for (const [id, button] of this._layoutOptionButtons) {
            const selected = id === this._layoutId;
            button.classList.toggle("selected", selected);
            button.setAttribute("aria-checked", String(selected));
        }
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
            this._collapseButton.title = t(collapsed ? "keyboard_restore" : "keyboard_minimize");
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
            // src is the 1x fallback; srcset lets the browser pick a pixel-exact
            // source for the current devicePixelRatio (DPI + page zoom), so the
            // 16px icon stays crisp instead of being downscaled from one oversized PNG.
            indicator.src = isHangul ? modeIconHangul : modeIconEnglish;
            indicator.srcset = isHangul ? modeIconHangulSrcset : modeIconEnglishSrcset;
            // Label it like the toolbar icon so it has an accessible name and tooltip.
            indicator.alt = t(isHangul ? "action_title_hangul" : "action_title_english");
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
        const { code, width, inert, label } = layoutKey;
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

        if (label !== undefined) {
            // The layout overrides the label (e.g. the Korean layout's plain
            // right Alt/Ctrl), so skip this keycode's default/special labels.
            keyElement.appendChild(this.createLabelElement("full", label));
        } else {
            this.renderNormalKeyLabels(keyElement, key);
            this.renderJamoKeyLabels(keyElement, key);
            this.renderSpecialKeyLabels(keyElement, key, code);

            if (key.tooltipResourceKey) {
                keyElement.title = t(key.tooltipResourceKey);
            }
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
        this.updateLayoutControl();
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
