import { KeyCode } from "../../content-script/on-screen-keyboard/korean-keyboard-map";
import { MethodKeys } from "../../types/objects";

// interface used by ContentEditableAdapter, InputAdapter, etc.
export interface ICompositionAdapter {
    blur(): void;

    collapseSelection(toStart?: boolean): void;
    deleteContentBackwards(): void;
    getPreviousCharacter(): string | undefined;
    inputCharacter(data: string, keyCode: KeyCode): void;

    beginComposition(data: string, keyCode: KeyCode): void;
    updateComposition(data: string, keyCode: KeyCode): void;
    endComposition(data: string): void;
}

export type SupportedCompositionFeatures = Record<MethodKeys<ICompositionAdapter>, boolean>;
