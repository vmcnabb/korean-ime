import { CompositingBox, GlyphRect } from "./compositing-box";

// jsdom has no layout, so the real measurement (getBoundingClientRect) returns
// zeros in the adapters. Here we stub the measure callback with a concrete rect so
// the box's lifecycle, styling, positioning, and scroll-tracking are observable.
describe("CompositingBox", () => {
    const rect: GlyphRect = { left: 10, top: 20, width: 16, height: 18 };
    let host: HTMLElement;

    beforeEach(() => {
        host = document.createElement("div");
        document.body.appendChild(host);
        // Run rAF callbacks synchronously so a dispatched scroll repositions at once.
        jest.spyOn(window, "requestAnimationFrame").mockImplementation((cb: FrameRequestCallback) => {
            cb(0);
            return 0;
        });
    });

    afterEach(() => {
        document.body.innerHTML = "";
        jest.restoreAllMocks();
    });

    it("draws a positioned overlay carrying the composing text", () => {
        new CompositingBox(host, () => rect).show("한");

        const overlay = document.body.lastElementChild as HTMLElement;
        expect(overlay.textContent).toBe("한");
        expect(overlay.style.position).toBe("absolute");
        expect(overlay.style.zIndex).toBe("2147483647");
        expect(overlay.style.pointerEvents).toBe("none");
        // left/top = rect + scroll(0) - border(1); width/height = rect
        expect(overlay.style.left).toBe("9px");
        expect(overlay.style.top).toBe("19px");
        expect(overlay.style.width).toBe("16px");
        expect(overlay.style.height).toBe("18px");
    });

    it("draws nothing when the glyph can't be measured", () => {
        const before = document.body.childElementCount;
        new CompositingBox(host, () => undefined).show("한");
        expect(document.body.childElementCount).toBe(before);
    });

    it("updates the text and re-measures on update", () => {
        const measure = jest.fn(() => rect);
        const box = new CompositingBox(host, measure);
        box.show("ㅎ");
        measure.mockClear();

        box.update("한");

        expect((document.body.lastElementChild as HTMLElement).textContent).toBe("한");
        expect(measure).toHaveBeenCalled();
    });

    it("re-aligns on scroll while shown, and stops once removed", () => {
        const measure = jest.fn(() => rect);
        const box = new CompositingBox(host, measure);
        box.show("한");
        const overlay = document.body.lastElementChild as HTMLElement;
        measure.mockClear();

        window.dispatchEvent(new Event("scroll"));
        expect(measure).toHaveBeenCalledTimes(1); // repositioned

        box.remove();
        expect(document.body.contains(overlay)).toBe(false); // overlay gone
        measure.mockClear();

        window.dispatchEvent(new Event("scroll"));
        expect(measure).not.toHaveBeenCalled(); // listener detached
    });
});
