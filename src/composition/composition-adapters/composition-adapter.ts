import { KeyCode } from "../../content-script/on-screen-keyboard/korean-keyboard-map";

export abstract class CompositionAdapter {
    constructor (protected element: HTMLElement) {}

    /** Is called when focus has blurred from where the current character is being composited */
    abstract blur(): void;

    getListenerTarget(_eventType: string): EventTarget {
        return this.element;
    }

    abstract deselect(): void;
    abstract selectPreviousCharacter(): string | undefined;
    abstract handleBackspace(): void;

    abstract beginComposition(data: string, keyCode: KeyCode): void;
    abstract updateComposition(data: string, keyCode: KeyCode): void;
    abstract endComposition(data: string): void;
}
