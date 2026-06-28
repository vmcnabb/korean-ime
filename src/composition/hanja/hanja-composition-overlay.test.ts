import { HanjaCompositionOverlay } from "./hanja-composition-overlay";
import { CompositionAdapter } from "../composition-adapters/composition-adapter";

function rect(left: number, top: number, width: number, height: number) {
    return { left, top, width, height };
}

describe("HanjaCompositionOverlay", () => {
    afterEach(() => {
        document.body.innerHTML = "";
    });

    it("underlines the complete run and boxes the matched substring", () => {
        const adapter = {
            supportsMethods: jest.fn().mockReturnValue(true),
            getTextRangeRects: jest.fn(({ text }: { text: string }) =>
                text === "한국중국" ? [rect(10, 20, 64, 20)] : [rect(10, 20, 32, 20)]
            ),
        } as unknown as CompositionAdapter;
        const overlay = new HanjaCompositionOverlay(adapter);

        const anchor = overlay.show({ run: "한국중국", matchStart: 0, reading: "한국" });

        expect(adapter.getTextRangeRects).toHaveBeenNthCalledWith(1, { text: "한국중국", offset: 0 });
        expect(adapter.getTextRangeRects).toHaveBeenNthCalledWith(2, { text: "한국", offset: 2 });
        expect(anchor).toEqual(rect(10, 20, 32, 20));
        expect(document.querySelectorAll('[data-kime-hanja-decoration="underline"]')).toHaveLength(1);
        expect(document.querySelectorAll('[data-kime-hanja-decoration="match"]')).toHaveLength(1);

        overlay.remove();

        expect(document.querySelector("[data-kime-hanja-composition]")).toBeNull();
    });

    it("draws one decoration for each wrapped range fragment and anchors to the last match fragment", () => {
        const adapter = {
            supportsMethods: jest.fn().mockReturnValue(true),
            getTextRangeRects: jest.fn(({ text }: { text: string }) =>
                text === "한국중국"
                    ? [rect(10, 20, 40, 20), rect(10, 40, 24, 20)]
                    : [rect(10, 20, 40, 20), rect(10, 40, 8, 20)]
            ),
        } as unknown as CompositionAdapter;
        const overlay = new HanjaCompositionOverlay(adapter);

        expect(overlay.show({ run: "한국중국", matchStart: 0, reading: "한국" })).toEqual(rect(10, 40, 8, 20));
        expect(document.querySelectorAll('[data-kime-hanja-decoration="underline"]')).toHaveLength(2);
        expect(document.querySelectorAll('[data-kime-hanja-decoration="match"]')).toHaveLength(2);
    });

    it("merges adjacent contenteditable fragments into one box on the same line", () => {
        const adapter = {
            supportsMethods: jest.fn().mockReturnValue(true),
            getTextRangeRects: jest.fn(() => [rect(10, 20, 16, 20), rect(26, 20, 16, 20)]),
        } as unknown as CompositionAdapter;
        const overlay = new HanjaCompositionOverlay(adapter);

        expect(overlay.show({ run: "한국", matchStart: 0, reading: "한국" })).toEqual(rect(10, 20, 32, 20));
        expect(document.querySelectorAll('[data-kime-hanja-decoration="underline"]')).toHaveLength(1);
        expect(document.querySelectorAll('[data-kime-hanja-decoration="match"]')).toHaveLength(1);
    });
});
