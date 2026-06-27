import { KeyCode } from "../../keyboard/korean-keyboard-map";
import { MethodKeys } from "../../types/objects";
import { GlyphRect } from "../compositing-box";

/**
 * A text range before the caret. `offset` is the UTF-16 length of the untouched
 * text between the end of this range and the caret.
 */
export type BeforeCaretTextRange = {
    text: string;
    offset: number;
};

// interface used by ContentEditableAdapter, InputAdapter, etc.
export interface ICompositionAdapter {
    blur(): void;

    collapseSelection(toStart?: boolean): void;
    deleteContentBackwards(): void;
    getPreviousCharacter(): string | undefined;
    getPreviousCharacterRect(): GlyphRect | undefined;
    getTextBeforeCaret(): string | undefined;
    getTextRangeRects(range: BeforeCaretTextRange): readonly GlyphRect[];
    inputCharacter(data: string, keyCode: KeyCode): void;
    replaceTextBeforeCaret(range: BeforeCaretTextRange, data: string, keyCode: KeyCode): boolean;

    beginComposition(data: string, keyCode: KeyCode): void;
    updateComposition(data: string, keyCode: KeyCode): void;
    endComposition(data: string): void;
}

export type SupportedCompositionFeatures = Record<MethodKeys<ICompositionAdapter>, boolean>;
