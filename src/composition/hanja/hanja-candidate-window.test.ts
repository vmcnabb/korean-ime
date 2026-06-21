import { HanjaCandidateWindow, HanjaCandidateWindowPage } from "./hanja-candidate-window";
import { HANJA_CANDIDATES_PER_PAGE } from "./hanja-candidate-pager";

const CANDIDATE_ITEM_HEIGHT_PX = 30;

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

    function page(overrides: Partial<HanjaCandidateWindowPage> = {}): HanjaCandidateWindowPage {
        return {
            candidates: ["韓"],
            selectedIndex: 0,
            pageIndex: 0,
            pageCount: 1,
            ...overrides,
        };
    }

    function windowOptions() {
        return {
            onPreviousPage: jest.fn(),
            onNextPage: jest.fn(),
            onMoveSelection: jest.fn(),
            onSelectCandidate: jest.fn(),
        };
    }

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

        new HanjaCandidateWindow(document.createElement("textarea"), page(), rect(100, 20, 10, 10), windowOptions());
        const windowElement = document.querySelector<HTMLElement>(".kime-hanja-candidates")!;

        expect(windowElement.style.left).toBe("100px");
        expect(windowElement.style.top).toBe("31px");
    });

    it("places the candidate window above the overlay when there is room above but not below", () => {
        Object.defineProperty(window, "innerHeight", { value: 60, configurable: true });

        new HanjaCandidateWindow(document.createElement("textarea"), page(), rect(100, 50, 10, 10), windowOptions());
        const windowElement = document.querySelector<HTMLElement>(".kime-hanja-candidates")!;

        expect(windowElement.style.left).toBe("100px");
        expect(windowElement.style.top).toBe("10px");
    });

    it("keeps the below placement when there is not enough room above either", () => {
        Object.defineProperty(window, "innerHeight", { value: 50, configurable: true });

        new HanjaCandidateWindow(document.createElement("textarea"), page(), rect(100, 20, 10, 10), windowOptions());
        const windowElement = document.querySelector<HTMLElement>(".kime-hanja-candidates")!;

        expect(windowElement.style.left).toBe("100px");
        expect(windowElement.style.top).toBe("31px");
    });

    it("renders mouse page buttons that are not keyboard-focusable", () => {
        new HanjaCandidateWindow(
            document.createElement("textarea"),
            page({ pageCount: 2 }),
            rect(100, 20, 10, 10),
            windowOptions()
        );

        expect(document.querySelector<HTMLButtonElement>(".kime-hanja-page-previous")?.tabIndex).toBe(-1);
        expect(document.querySelector<HTMLButtonElement>(".kime-hanja-page-next")?.tabIndex).toBe(-1);
    });

    it("does not render mouse page buttons for a single page", () => {
        new HanjaCandidateWindow(
            document.createElement("textarea"),
            page({ pageCount: 1 }),
            rect(100, 20, 10, 10),
            windowOptions()
        );

        expect(document.querySelector(".kime-hanja-page-previous")).toBeNull();
        expect(document.querySelector(".kime-hanja-page-next")).toBeNull();
    });

    it("renders mouse page buttons below the candidate list", () => {
        new HanjaCandidateWindow(
            document.createElement("textarea"),
            page({ pageCount: 2 }),
            rect(100, 20, 10, 10),
            windowOptions()
        );

        const windowElement = document.querySelector<HTMLElement>(".kime-hanja-candidates")!;

        expect(windowElement.lastElementChild?.classList.contains("kime-hanja-page-controls")).toBe(true);
    });

    it("keeps a nine-item candidate list height on multi-page results", () => {
        new HanjaCandidateWindow(
            document.createElement("textarea"),
            page({ candidates: ["儺"], pageIndex: 1, pageCount: 2 }),
            rect(100, 20, 10, 10),
            windowOptions()
        );

        const candidateList = document.querySelector<HTMLElement>(".kime-hanja-candidate-list")!;

        expect(candidateList.style.minHeight).toBe(`${HANJA_CANDIDATES_PER_PAGE * CANDIDATE_ITEM_HEIGHT_PX}px`);
    });

    it("does not force a nine-item candidate list height for single-page results", () => {
        new HanjaCandidateWindow(document.createElement("textarea"), page(), rect(100, 20, 10, 10), windowOptions());

        const candidateList = document.querySelector<HTMLElement>(".kime-hanja-candidate-list")!;

        expect(candidateList.style.minHeight).toBe("");
    });

    it("renders page hint dots above adjacent left-aligned page buttons", () => {
        new HanjaCandidateWindow(
            document.createElement("textarea"),
            page({ pageIndex: 2, pageCount: 4 }),
            rect(100, 20, 10, 10),
            windowOptions()
        );

        const controls = document.querySelector<HTMLElement>(".kime-hanja-page-controls")!;
        const pageHint = document.querySelector<HTMLElement>(".kime-hanja-page-hint")!;
        const buttonRow = document.querySelector<HTMLElement>(".kime-hanja-page-buttons")!;
        const dots = Array.from(document.querySelectorAll<HTMLElement>(".kime-hanja-page-dot"));

        expect(controls.firstElementChild).toBe(pageHint);
        expect(controls.lastElementChild).toBe(buttonRow);
        expect(buttonRow.children[0]).toBe(document.querySelector(".kime-hanja-page-previous"));
        expect(buttonRow.children[1]).toBe(document.querySelector(".kime-hanja-page-next"));
        expect(dots).toHaveLength(4);
        expect(dots.map((dot) => dot.style.width)).toEqual(["4px", "4px", "7px", "4px"]);
    });

    it("calls the page callbacks when mouse buttons are clicked", () => {
        const options = windowOptions();
        new HanjaCandidateWindow(
            document.createElement("textarea"),
            page({ pageIndex: 1, pageCount: 3 }),
            rect(100, 20, 10, 10),
            options
        );

        document.querySelector<HTMLButtonElement>(".kime-hanja-page-previous")?.click();
        document.querySelector<HTMLButtonElement>(".kime-hanja-page-next")?.click();

        expect(options.onPreviousPage).toHaveBeenCalled();
        expect(options.onNextPage).toHaveBeenCalled();
    });

    it("calls the candidate callback when a candidate is clicked", () => {
        const options = windowOptions();
        new HanjaCandidateWindow(
            document.createElement("textarea"),
            page({ candidates: ["韓", "寒", "恨"] }),
            rect(100, 20, 10, 10),
            options
        );

        document.querySelectorAll<HTMLElement>(".kime-hanja-candidate")[1].click();

        expect(options.onSelectCandidate).toHaveBeenCalledWith(1);
    });

    it("highlights a hovered candidate without changing the selected candidate", () => {
        new HanjaCandidateWindow(
            document.createElement("textarea"),
            page({ candidates: ["韓", "寒", "恨"], selectedIndex: 0 }),
            rect(100, 20, 10, 10),
            windowOptions()
        );

        const candidates = document.querySelectorAll<HTMLElement>(".kime-hanja-candidate");
        const selectedBackground = candidates[0].style.background;

        candidates[1].dispatchEvent(new MouseEvent("mouseenter"));

        expect(candidates[0].getAttribute("aria-selected")).toBe("true");
        expect(candidates[1].getAttribute("aria-selected")).toBe("false");
        expect(candidates[0].style.background).toBe(selectedBackground);
        expect(candidates[1].style.background).not.toBe("transparent");
        expect(candidates[1].style.background).not.toBe(selectedBackground);

        candidates[1].dispatchEvent(new MouseEvent("mouseleave"));

        expect(candidates[0].style.background).toBe(selectedBackground);
        expect(candidates[1].style.background).toBe("transparent");
    });

    it("prevents candidate mousedown from moving focus", () => {
        const options = windowOptions();
        new HanjaCandidateWindow(
            document.createElement("textarea"),
            page({ candidates: ["韓", "寒", "恨"] }),
            rect(100, 20, 10, 10),
            options
        );

        const mousedown = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
        document.querySelectorAll<HTMLElement>(".kime-hanja-candidate")[1].dispatchEvent(mousedown);

        expect(mousedown.defaultPrevented).toBe(true);
    });

    it("maps mouse wheel scrolling to selection movement", () => {
        const options = windowOptions();
        new HanjaCandidateWindow(
            document.createElement("textarea"),
            page({ pageCount: 2 }),
            rect(100, 20, 10, 10),
            options
        );

        const windowElement = document.querySelector<HTMLElement>(".kime-hanja-candidates")!;
        const down = new WheelEvent("wheel", { deltaY: 100, bubbles: true, cancelable: true });
        const up = new WheelEvent("wheel", { deltaY: -100, bubbles: true, cancelable: true });

        windowElement.dispatchEvent(down);
        windowElement.dispatchEvent(up);

        expect(options.onMoveSelection).toHaveBeenNthCalledWith(1, 1);
        expect(options.onMoveSelection).toHaveBeenNthCalledWith(2, -1);
        expect(down.defaultPrevented).toBe(true);
        expect(up.defaultPrevented).toBe(true);
    });
});
