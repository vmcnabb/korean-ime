import { HanjaCandidateWindow } from "./hanja-candidate-window";

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

describe("HanjaCandidateWindow", () => {
    const originalInnerHeight = window.innerHeight;
    let getBoundingClientRect: jest.SpyInstance;

    beforeEach(() => {
        getBoundingClientRect = jest
            .spyOn(HTMLElement.prototype, "getBoundingClientRect")
            .mockReturnValue(rect(0, 0, 80, 40));
    });

    afterEach(() => {
        getBoundingClientRect.mockRestore();
        Object.defineProperty(window, "innerHeight", { value: originalInnerHeight, configurable: true });
        document.body.innerHTML = "";
    });

    it("places the candidate window below the overlay by default", () => {
        Object.defineProperty(window, "innerHeight", { value: 300, configurable: true });

        new HanjaCandidateWindow(document.createElement("textarea"), ["韓"], rect(100, 20, 10, 10));
        const windowElement = document.querySelector<HTMLElement>(".kime-hanja-candidates")!;

        expect(windowElement.style.left).toBe("100px");
        expect(windowElement.style.top).toBe("31px");
    });

    it("places the candidate window above the overlay when there is room above but not below", () => {
        Object.defineProperty(window, "innerHeight", { value: 60, configurable: true });

        new HanjaCandidateWindow(document.createElement("textarea"), ["韓"], rect(100, 50, 10, 10));
        const windowElement = document.querySelector<HTMLElement>(".kime-hanja-candidates")!;

        expect(windowElement.style.left).toBe("100px");
        expect(windowElement.style.top).toBe("10px");
    });

    it("keeps the below placement when there is not enough room above either", () => {
        Object.defineProperty(window, "innerHeight", { value: 50, configurable: true });

        new HanjaCandidateWindow(document.createElement("textarea"), ["韓"], rect(100, 20, 10, 10));
        const windowElement = document.querySelector<HTMLElement>(".kime-hanja-candidates")!;

        expect(windowElement.style.left).toBe("100px");
        expect(windowElement.style.top).toBe("31px");
    });
});
