import { KoreanKeyboardMode } from "../../extension-state/korean-keyboard-mode";
import { KeyCode, KeyRecord, keyMap } from "./korean-keyboard-map";
import { KeyboardLayout, defaultLayout } from "./layouts";
import { SupportedCompositionFeatures } from "../../composition/composition-adapters/composition-adapter";
import "./on-screen-keyboard.scss";
import { ContentScriptRequestAction, ContentScriptRequestMessage } from "../../messaging/content-to-service-messages";
import { ContentScriptBroadcastAction, ContentScriptBroadcastMessage } from "../../messaging/content-to-content-messages";

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
            startY: 0
        }
    };

    private _mode = KoreanKeyboardMode.English;
    private _isShift = false;
    private _compositionFeatures: SupportedCompositionFeatures | undefined;
    private _keyElements = new Map<KeyCode, HTMLElement>();

    constructor() {
        this._keyboardElement = this.createKeyboard();
        this.setMode(this._mode);
    }

    public setMode(mode: KoreanKeyboardMode) {
        console.debug("OnScreenKeyboardController.setMode", mode);

        this._mode = mode;
        const isHanMode = mode === KoreanKeyboardMode.Hangul;

        this._keyboardElement.classList.toggle("hanMode", isHanMode);
        this._keyboardElement.classList.toggle("yongMode", !isHanMode);
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

        const kx = ~~placement.x;
        const ky = ~~placement.y;

        if (placement.originX === "right") {
            dx = -dx;
        }

        if (placement.originY === "bottom") {
            dy = -dy;
        }

        placement.x = kx + dx;
        placement.y = ky + dy;
    
        this.placeKeyboard();
    }

    hideKeyboard() {
        this._keyboardElement.style.display = "none";
    }
    
    showKeyboard() {
        this._keyboardElement.style.display = "block";
        this.placeKeyboard();
    }
    
    private placeKeyboard() {
        // get x,y coordinates of keyboard based on an origin of Top Left
        const placement = this._keyboardPlacement;
        const width = this._keyboardElement.offsetWidth;
        const height = this._keyboardElement.offsetHeight;
    
        let x = placement.originX === "right" ?
            window.innerWidth - width - placement.x :
            placement.x;
    
        let y = placement.originY === "bottom" ?
            window.innerHeight - height - placement.y :
            placement.y;
    
        // try to make sure keyboard is not partially off screen
        if (x < 0) x = 0;
        if (y < 0) y = 0;
    
        if (x + width > window.innerWidth) x = window.innerWidth - width;
        if (y + height > window.innerHeight) y = window.innerHeight - height;
    
        // find out which quadrant keyboard is in and set appropriate origin
        const cx = ~~(x + width / 2);
        const cy = ~~(y + height / 2);
    
        const originX = cx > window.innerWidth / 2 ?
            "right" :
            "left";
    
        const originY = cy > window.innerHeight / 2 ?
            "bottom" :
            "top";
    
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
    
        placement.x = x;
        placement.y = y;
        placement.originX = originX;
        placement.originY = originY;
    }

    private createKeyboard() {
        const keyboardElement = document.createElement("div");

        keyboardElement.id = "kb-73ce1520-9c19-48ad-bf12-f7ec206ab11f";

        keyboardElement.style.width = "480px";
        keyboardElement.style.position = "fixed";
        keyboardElement.style.bottom = "0";
        keyboardElement.style.right = "0";
        keyboardElement.style.display = "none";
        keyboardElement.style.border = "none";
        keyboardElement.style.zIndex = "2147483647"; // max int

        // insert the keyboard as the first child of the BODY tag
        const body = document.getElementsByTagName("body")[0];
        body.insertBefore(keyboardElement, body.firstChild);

        this.renderKeyboard(keyboardElement, defaultLayout);
        const self = this;

        keyboardElement.addEventListener("mousedown", function (e) {
            e.preventDefault();
            e.stopPropagation();
    
            if (e.button !== 0 || !(e.target instanceof HTMLElement)) {
                return;
            }
    
            if (e.target === keyboardElement || e.target.classList.contains("row")) {
                self._keyboardMovement.mouse.down = true;
                self._keyboardMovement.mouse.startX = e.screenX;
                self._keyboardMovement.mouse.startY = e.screenY;
            }

            return;
        });
    
        document.addEventListener("mouseup", function dragMouseUpListener (e) {
            if (e.button === 0) {
                self._keyboardMovement.mouse.down = false;
            }
        });
    
        document.addEventListener("mousemove", function dragMouseMoveListener (e) {
            if ((e.buttons & 1) === 0) {
                self._keyboardMovement.mouse.down = false;
            }
    
            if (self._keyboardMovement.mouse.down) {
                const dx = e.screenX - self._keyboardMovement.mouse.startX;
                const dy = e.screenY - self._keyboardMovement.mouse.startY;
    
                self._keyboardMovement.mouse.startX = e.screenX;
                self._keyboardMovement.mouse.startY = e.screenY;
    
                self.moveKeyboard(dx, dy);
            }
    
            return false;
        });
    
        // listen for keydown and make the key on the keyboard active
        document.addEventListener("keydown", function (e) {
            const keyCode = e.code as KeyCode;
    
            const keyElement = keyboardElement.querySelector(`.${keyCode}`) as HTMLDivElement;
    
            if (keyElement) {
                keyElement.classList.add("active");
            }
    
            updateShiftState(e);
        });
    
        // listen for keyup and make the key on the keyboard inactive
        document.addEventListener("keyup", function (e) {
            const keyCode = e.code as KeyCode;
    
            const keyElement = keyboardElement.querySelector(`.${keyCode}`) as HTMLDivElement;
    
            if (keyElement) {
                keyElement.classList.remove("active");
            }
    
            updateShiftState(e);
        });
    
        // listen for blur event and remove all active keys
        window.addEventListener("blur", function () {
            const activeKeys = keyboardElement.querySelectorAll(".active");
            activeKeys.forEach(key => key.classList.remove("active"));
        });
    
        // update shift state based on the shift key in the keyboard event.
        function updateShiftState(e: KeyboardEvent) {
            self.setShift(e.shiftKey);
        }

        return keyboardElement;
    }

    /**
     * Handles mouse down events for KBD elements, i.e. keys on the keyboard.
     * @param e 
     * @param key 
     * @param keyCode 
     */
    private handleKbdMouseDown(
        e: MouseEvent,
        key: KeyRecord,
        keyCode: KeyCode,
    ) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        const target = e.target as HTMLElement;
        if (target.closest("kbd")!.classList.contains("disabled")) {
            return;
        }

        const isHanMode = this._mode === KoreanKeyboardMode.Hangul;
        const isShift = this._isShift;
    
        if (key.jamo && isHanMode) {
            const jamoToAdd = isShift && key.jamo.shift ?
                key.jamo.shift :
                key.jamo.normal;
    
            this.sendKey(jamoToAdd, keyCode);
    
        } else if (key.normal && (!isHanMode || !key.jamo)) {
            const keyToSend = isShift && key.shift ?
                key.shift :
                key.normal;
    
                this.sendKey(keyToSend, keyCode);
    
        } else if (key.label === "Shift") {
            this.setShift(!isShift);

        } else if (keyCode === KeyCode.AltRight) {
            chrome.runtime.sendMessage<ContentScriptRequestMessage>({
                type: "contentScriptRequest",
                action: ContentScriptRequestAction.ToggleHanYongMode
            });
    
        } else if (keyCode === KeyCode.Space) {
            this.sendKey(" ", keyCode);
    
        } else if (keyCode === KeyCode.Backspace) {
            this.sendKey("Backspace", keyCode);
        }
    }

    private sendKey(key: string, keyCode: KeyCode) {
        console.debug(`Sending key: ${key} (${keyCode})`);

        chrome.runtime.sendMessage<ContentScriptBroadcastMessage>({
            type: "broadcast",
            action: ContentScriptBroadcastAction.SendKey,
            data: {
                key,
                keyCode,
            }
        });
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
    
    private renderKey(
        rowElement: HTMLDivElement,
        keyCode: KeyCode,
    ) {
        const keyElement = document.createElement("kbd");
        const key = keyMap[keyCode];
    
        keyElement.className = keyCode;
        keyElement.addEventListener("mousedown", e => this.handleKbdMouseDown(e, key, keyCode));

        this.renderNormalKeyLabels(keyElement, key);
        this.renderJamoKeyLabels(keyElement, key);
        this.renderSpecialKeyLabels(keyElement, key, keyCode);
    
        if (key.tooltipResourceKey) {
            keyElement.title = chrome.i18n.getMessage(key.tooltipResourceKey);
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

        layout.forEach(row => {
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
