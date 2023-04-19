import { isHangulCharacter } from "../../mappings";
import { ContentScriptState } from "..";
import { InitializeKeyboard } from "./keyboard-internal";

export class OnScreenKeyboardController {
    constructor(private state: ContentScriptState) {
        this.createKeyboard();
    }

    public MessageHandlers = {
        enableKeyboard: () => this.setKeyboardEnabled(true),
        disableKeyboard: () => this.setKeyboardEnabled(false),
    }

    private setKeyboardEnabled(isEnabled: boolean) {
        this.state.keyboard.isEnabled = isEnabled;
        this.updateKeyboardVisibility();
    }

    private moveKeyboard(dx: number, dy: number) {
        if (!this.state.isTopElement) {
            return;
        }

        const kb = this.state.keyboard;

        const kx = ~~kb.placement.x;
        const ky = ~~kb.placement.y;

        if (kb.placement.originX === "right") {
            dx = -dx;
        }

        if (kb.placement.originY === "bottom") {
            dy = -dy;
        }

        kb.placement.x = kx + dx;
        kb.placement.y = ky + dy;
    
        this.placeKeyboard();
    }

    private typeKey(char: string) {
        const activeElement = this.state.getActiveElement(document);
        if (!activeElement) {
            return;
        }

        const imeController = this.state.imeControllers.get(activeElement);
    
        if (!imeController) {
            return;
        }
    
        if (isHangulCharacter(char)) {
            imeController.addJamo(char);

        } else {
            // if char is a backspace call handleBackspace
            if (char === "\b") {
                imeController.handleBackspace();
            } else {
                imeController.addCharacter(char);
            }
        }
    }

    public updateKeyboardVisibility() {
        if (!this.state.keyboard.element) {
            return;
        }

        if (this.state.keyboard.isEnabled) {
            this.showKeyboard();

        } else {
            this.hideKeyboard();
        }
    }

    private hideKeyboard() {
        if (!this.state.keyboard.element) {
            return;
        }
        
        this.state.keyboard.element.style.display = "none";
    }
    
    private showKeyboard() {
        if (!this.state.keyboard.element) {
            return;
        }

        this.state.keyboard.element.style.display = "block";
        this.placeKeyboard();
    }
    
    private placeKeyboard() {
        const state = this.state;

        if (!state.isTopElement || !state.keyboard.element) {
            return;
        }
    
        // get x,y coordinates of keyboard based on an origin of Top Left
        const placement = state.keyboard.placement;
        const width = state.keyboard.element.offsetWidth;
        const height = state.keyboard.element.offsetHeight;
    
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
        const keyboardElement = state.keyboard.element;
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
        const state = this.state;

        if (!state.isTopElement) {
            return;
        }

        if (state.keyboard.element) {
            throw "createKeyboard() must only be called once.";
        }

        const keyboard = document.createElement("div");
        state.keyboard.element = keyboard;

        keyboard.id = "kb-73ce1520-9c19-48ad-bf12-f7ec206ab11f";

        keyboard.style.width = "480px";
        keyboard.style.position = "fixed";
        keyboard.style.bottom = "0";
        keyboard.style.right = "0";
        keyboard.style.display = "none";
        keyboard.style.border = "none";
        keyboard.style.zIndex = "2147483647"; // max int

        // insert the keyboard as the first child of the BODY tag
        const body = document.getElementsByTagName("body")[0];
        body.insertBefore(keyboard, body.firstChild);

        // load keyboard CSS
        const css = document.createElement("link");
        css.rel = "stylesheet";
        css.href = chrome.runtime.getURL("contentScript/onScreenKeyboard/onScreenKeyboard.css");
        document.head.appendChild(css);

        InitializeKeyboard(keyboard, this.typeKey.bind(this), this.moveKeyboard.bind(this));
    }
}
