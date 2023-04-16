export abstract class CompositionAdapter {
    constructor (protected element: HTMLElement) {}

    /** Is called when focus has blurred from where the current character is being composited */
    abstract blur(): void;

    getListenerTarget(_eventType: string): EventTarget {
        return this.element;
    }

    abstract deselect(): void;
    abstract endComposition(text: string): void;
    abstract selectPreviousCharacter(): string | undefined;
    abstract updateComposition(text: string): void;
}
