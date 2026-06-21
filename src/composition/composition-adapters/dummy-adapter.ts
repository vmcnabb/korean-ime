import { ICompositionAdapter } from "./composition-adapter-interface";
import { GlyphRect } from "../compositing-box";

/**
 * This adapter is used by Composition adapter to get a list of all methods that exist in CompositionAdapter.
 * We need this because CompositionAdapter is an abstract class, and TypeScript doesn't allow us to get a list of
 * methods from an abstract class.
 */
export class DummyAdapter implements ICompositionAdapter {
    blur(): void {
        throw new Error("Method not implemented.");
    }
    collapseSelection(): void {
        throw new Error("Method not implemented.");
    }
    getPreviousCharacter(): string | undefined {
        throw new Error("Method not implemented.");
    }
    getPreviousCharacterRect(): GlyphRect | undefined {
        throw new Error("Method not implemented.");
    }
    deleteContentBackwards(): void {
        throw new Error("Method not implemented.");
    }
    inputCharacter(): void {
        throw new Error("Method not implemented.");
    }
    beginComposition(): void {
        throw new Error("Method not implemented.");
    }
    updateComposition(): void {
        throw new Error("Method not implemented.");
    }
    endComposition(): void {
        throw new Error("Method not implemented.");
    }
}
