import { HanjaCompositionOverlay } from "./hanja-composition-overlay";
import { CompositionAdapter } from "../composition-adapters/composition-adapter";

function rect(left: number, top: number, width: number, height: number): DOMRect {
    return {
        left,
        top,
        width,
        height,
        right: left + width,
        bottom: top + height,
        x: left,
        y: top,
        toJSON: () => ({}),
    } as DOMRect;
}

describe("HanjaCompositionOverlay", () => {
    afterEach(() => {
        document.body.innerHTML = "";
    });

    it("draws a composition overlay over the adapter's previous-character rect", () => {
        const host = document.createElement("div");
        host.textContent = "한";
        document.body.append(host);
        const adapter = {
            supportsMethods: jest.fn().mockReturnValue(true),
            getPreviousCharacterRect: jest.fn().mockReturnValue(rect(12, 34, 16, 20)),
        } as unknown as CompositionAdapter;
        const overlay = new HanjaCompositionOverlay(host, adapter);
        const overlayRect = overlay.show("한")!;

        expect(adapter.getPreviousCharacterRect).toHaveBeenCalled();
        expect({
            left: overlayRect.left,
            top: overlayRect.top,
            width: overlayRect.width,
            height: overlayRect.height,
        }).toEqual({ left: 12, top: 34, width: 16, height: 20 });
        expect(document.body.textContent).toContain("한한");

        overlay.remove();

        expect(document.body.textContent).toBe("한");
    });
});
