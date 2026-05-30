/**
 * @jest-environment jsdom
 */
import { CompositionAdapterFactory } from "./composition-adapter-factory";
import { InputAdapter } from "./composition-adapters/input-adapter";
import { ContentEditableAdapter } from "./composition-adapters/content-editable-adapter";
import { CkEditorAdapter } from "./composition-adapters/ck-editor-adapter";
import { WordForTheWebAdapter } from "./composition-adapters/word-for-the-web-adapter";

describe("CompositionAdapterFactory", () => {
    // jsdom does not implement isContentEditable, so we define it manually.
    function makeContentEditable(el: HTMLElement): HTMLElement {
        Object.defineProperty(el, "isContentEditable", {
            get: () => true,
            configurable: true,
        });
        return el;
    }

    describe("createCompositionAdapter", () => {
        it("should return an InputAdapter for an input element", () => {
            const input = document.createElement("input");
            const adapter = CompositionAdapterFactory.createCompositionAdapter(input);
            expect(adapter).toBeInstanceOf(InputAdapter);
        });

        it("should return an InputAdapter for a textarea element", () => {
            const textarea = document.createElement("textarea");
            const adapter = CompositionAdapterFactory.createCompositionAdapter(textarea);
            expect(adapter).toBeInstanceOf(InputAdapter);
        });

        it("should return a ContentEditableAdapter for a contenteditable element", () => {
            const div = makeContentEditable(document.createElement("div"));
            const adapter = CompositionAdapterFactory.createCompositionAdapter(div);
            expect(adapter).toBeInstanceOf(ContentEditableAdapter);
        });

        it("should return a CkEditorAdapter for a CKEditor element", () => {
            const div = makeContentEditable(document.createElement("div"));
            div.classList.add("ck-editor__editable");
            const adapter = CompositionAdapterFactory.createCompositionAdapter(div);
            expect(adapter).toBeInstanceOf(CkEditorAdapter);
        });

        it("should return a WordForTheWebAdapter for a Word for the Web element", () => {
            const div = makeContentEditable(document.createElement("div"));
            div.id = "WACViewPanel_EditingElement";
            const adapter = CompositionAdapterFactory.createCompositionAdapter(div);
            expect(adapter).toBeInstanceOf(WordForTheWebAdapter);
        });

        it("should prefer CkEditorAdapter over the generic ContentEditable fallback for CKEditor elements", () => {
            const div = makeContentEditable(document.createElement("div"));
            div.classList.add("ck-editor__editable");
            const adapter = CompositionAdapterFactory.createCompositionAdapter(div);
            // CkEditorAdapter extends ContentEditableAdapter, so instanceof CkEditorAdapter
            // proves the specialised adapter was chosen rather than the generic fallback.
            expect(adapter).toBeInstanceOf(CkEditorAdapter);
        });

        it("should prefer WordForTheWebAdapter over the generic ContentEditable fallback for Word elements", () => {
            const div = makeContentEditable(document.createElement("div"));
            div.id = "WACViewPanel_EditingElement";
            const adapter = CompositionAdapterFactory.createCompositionAdapter(div);
            expect(adapter).toBeInstanceOf(WordForTheWebAdapter);
        });

        it("should return undefined for a non-interactive element", () => {
            const div = document.createElement("div");
            const adapter = CompositionAdapterFactory.createCompositionAdapter(div);
            expect(adapter).toBeUndefined();
        });
    });
});
