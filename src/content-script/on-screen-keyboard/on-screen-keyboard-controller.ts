import { KoreanKeyboardMode } from "../../extension-state/korean-keyboard-mode";
import { KeyCode, KeyRecord, keyMap } from "../../keyboard/korean-keyboard-map";
import { KeyboardLayout, defaultLayout } from "./layouts";
import { SupportedCompositionFeatures } from "../../composition/composition-adapters/composition-adapter-interface";
import "./on-screen-keyboard.scss";
import { ContentScriptRequestAction, ContentScriptRequestMessage } from "../../messaging/content-to-service-messages";
import { debugLog } from "../../debug-log";
import { api } from "../../platform/browser-api";
import { modeIconHangul, modeIconEnglish } from "./mode-icons";

/** Full keyboard width, and the narrower width used while collapsed. */
const KEYBOARD_WIDTH_PX = 480;
const COLLAPSED_WIDTH_PX = 180;

export class OnScreenKeyboardController {
    private _keyboardElement: HTMLDivElement;
    private _keyboardPlacement = {
        originX: "right" as "right" | "left",
        originY: "bottom" as "bottom" | "top",
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

    private _mode = KoreanKeyboardMode.English;
    // `undefined` until the first state update, so the first call to
    // setHanYongEnabled always counts as entering a regime and seeds the mode.
    private _isHanYongEnabled?: boolean;
    private _isShift = false;
    private _compositionFeatures: SupportedCompositionFeatures | undefined;
    private _keyElements = new Map<KeyCode, HTMLElement>();
    private _collapseButton?: HTMLButtonElement;
    private _modeIndicator?: HTMLImageElement;
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

        keyboardElement.style.width = `${KEYBOARD_WIDTH_PX}px`;
        keyboardElement.style.position = "fixed";
        keyboardElement.style.bottom = "0";
        keyboardElement.style.right = "0";
        keyboardElement.style.display = "none";
        keyboardElement.style.border = "none";
        keyboardElement.style.zIndex = "2147483647"; // max int

        // insert the keyboard as the first child of the BODY tag
        const body = document.getElementsByTagName("body")[0];
        body.insertBefore(keyboardElement, body.firstChild);

        // Header bar (drag handle + collapse/close controls); the keys live in a
        // body wrapper so the header can collapse them away.
        keyboardElement.appendChild(this.createHeader());
        const keyboardBody = document.createElement("div");
        keyboardBody.className = "kb-body";
        keyboardElement.appendChild(keyboardBody);
        this.renderKeyboard(keyboardBody, defaultLayout);

        keyboardElement.addEventListener("mousedown", (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (e.button !== 0 || !(e.target instanceof HTMLElement)) {
                return;
            }

            // Drag only from the header bar, and not from its buttons.
            if (e.target.closest(".kb-header") && !e.target.closest("button")) {
                this._keyboardMovement.mouse.down = true;
                this._keyboardMovement.mouse.startX = e.screenX;
                this._keyboardMovement.mouse.startY = e.screenY;
            }

            return;
        });

        document.addEventListener("mouseup", (e) => {
            if (e.button === 0) {
                this._keyboardMovement.mouse.down = false;
            }
        });

        document.addEventListener("mousemove", (e) => {
            if ((e.buttons & 1) === 0) {
                this._keyboardMovement.mouse.down = false;
            }

            if (this._keyboardMovement.mouse.down) {
                const dx = e.screenX - this._keyboardMovement.mouse.startX;
                const dy = e.screenY - this._keyboardMovement.mouse.startY;

                this._keyboardMovement.mouse.startX = e.screenX;
                this._keyboardMovement.mouse.startY = e.screenY;

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
            }
        };
        window.addEventListener("resize", reclampToViewport);
        window.visualViewport?.addEventListener("resize", reclampToViewport);

        return keyboardElement;
    }

    private createHeader(): HTMLDivElement {
        const header = document.createElement("div");
        header.className = "kb-header";

        // Mode indicator: mirrors the extension's toolbar icon, shown only while
        // Hangul typing is enabled (see updateModeIndicator).
        this._modeIndicator = document.createElement("img");
        this._modeIndicator.className = "kb-mode";
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
        button.title = api.i18n.getMessage(titleKey);
        button.addEventListener("click", onClick);
        return button;
    }

    private toggleCollapsed() {
        const collapsed = this._keyboardElement.classList.toggle("collapsed");

        // Collapsed, the keyboard only needs room for its header, so narrow it.
        this._keyboardElement.style.width = `${collapsed ? COLLAPSED_WIDTH_PX : KEYBOARD_WIDTH_PX}px`;

        if (this._collapseButton) {
            this._collapseButton.textContent = collapsed ? "\u{1F5D6}" : "\u{1F5D5}";
            this._collapseButton.title = api.i18n.getMessage(collapsed ? "keyboard_restore" : "keyboard_minimise");
        }

        // The keyboard's size changed, so re-clamp it to stay on-screen (its
        // anchor is preserved).
        this.placeKeyboard();
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
            indicator.src = this._mode === KoreanKeyboardMode.Hangul ? modeIconHangul : modeIconEnglish;
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
        } else if (keyCode === KeyCode.AltRight) {
            if (this._isHanYongEnabled) {
                // Hangul typing is enabled: behave like the toolbar toggle and
                // the physical Right Alt key — flip the shared per-tab mode.
                api.runtime.sendMessage<ContentScriptRequestMessage>({
                    type: "contentScriptRequest",
                    action: ContentScriptRequestAction.ToggleHanYongMode,
                });
            } else {
                // Hangul typing is disabled: this is an independent, ephemeral,
                // OSK-only toggle. It never leaves this tab, is never saved, and
                // does not affect the physical keyboard.
                this.setMode(
                    this._mode === KoreanKeyboardMode.Hangul ? KoreanKeyboardMode.English : KoreanKeyboardMode.Hangul
                );
            }
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
        if (keyCode === KeyCode.ShiftLeft) {
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

    private renderKey(rowElement: HTMLDivElement, keyCode: KeyCode) {
        const keyElement = document.createElement("kbd");
        const key = keyMap[keyCode];

        keyElement.className = keyCode;
        keyElement.addEventListener("mousedown", (e) => this.handleKbdMouseDown(e, key, keyCode));

        this.renderNormalKeyLabels(keyElement, key);
        this.renderJamoKeyLabels(keyElement, key);
        this.renderSpecialKeyLabels(keyElement, key, keyCode);

        if (key.tooltipResourceKey) {
            keyElement.title = api.i18n.getMessage(key.tooltipResourceKey);
        }

        rowElement.appendChild(keyElement);

        return keyElement;
    }

    /**
     * Creates keys and handlers then adds them to the keyboard
     * @param keyboard the keyboard element to be rendered
     */
    private renderKeyboard(keyboardELement: HTMLDivElement, layout: KeyboardLayout): void {
        this._keyElements.clear();

        layout.forEach((row) => {
            const rowElement = document.createElement("div");
            rowElement.className = "row";

            for (const keyCode of row) {
                const keyElement = this.renderKey(rowElement, keyCode);
                this._keyElements.set(keyCode, keyElement);
            }

            keyboardELement.appendChild(rowElement);
        });
    }
}
