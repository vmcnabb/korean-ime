import { KeyCode } from "../../keyboard/korean-keyboard-map";
import { MethodKeys } from "../../types/objects";
import { GlyphRect } from "../compositing-box";

// interface used by ContentEditableAdapter, InputAdapter, etc.
export interface ICompositionAdapter {
    blur(): void;

    collapseSelection(toStart?: boolean): void;
    deleteContentBackwards(): void;
    getPreviousCharacter(): string | undefined;
    getPreviousCharacterRect(): GlyphRect | undefined;
    inputCharacter(data: string, keyCode: KeyCode): void;

    beginComposition(data: string, keyCode: KeyCode): void;
    updateComposition(data: string, keyCode: KeyCode): void;
    endComposition(data: string): void;
}

export type SupportedCompositionFeatures = Record<MethodKeys<ICompositionAdapter>, boolean>;
