import {
    HANJA_CANDIDATE_WINDOW_SELECTOR,
    HanjaCandidateWindow,
    HanjaCandidateWindowPage,
} from "./hanja-candidate-window";
import { HanjaCandidate } from "./hanja-candidate";

jest.mock("./hanja-candidate-window.scss", () => ({}), { virtual: true });

function candidate(hanja: string, overrides: Partial<HanjaCandidate> = {}): HanjaCandidate {
    return {
        hanja,
        korean: `${hanja} Korean`,
        pinyin: `${hanja} pinyin`,
        ...overrides,
    };
}

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
    const originalInnerWidth = window.innerWidth;
    const originalInnerHeight = window.innerHeight;
    let getBoundingClientRect: jest.SpyInstance;

    function page(overrides: Partial<HanjaCandidateWindowPage> = {}): HanjaCandidateWindowPage {
        return {
            candidates: [candidate("韓")],
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

    function candidateWindow(): HTMLElement {
        return document.querySelector<HTMLElement>(HANJA_CANDIDATE_WINDOW_SELECTOR)!;
    }

    function candidateItems(): NodeListOf<HTMLElement> {
        return candidateWindow().querySelectorAll<HTMLElement>(".candidate");
    }

    function pageButton(kind: "previous" | "next"): HTMLButtonElement | null {
        return candidateWindow().querySelector<HTMLButtonElement>(`.page-button.${kind}`);
    }

    beforeEach(() => {
        getBoundingClientRect = jest
            .spyOn(HTMLElement.prototype, "getBoundingClientRect")
            .mockReturnValue(rect(0, 0, 80, 40));
    });

    afterEach(() => {
        getBoundingClientRect.mockRestore();
        Object.defineProperty(window, "innerWidth", { value: originalInnerWidth, configurable: true });
        Object.defineProperty(window, "innerHeight", { value: originalInnerHeight, configurable: true });
        document.body.innerHTML = "";
    });

    it("places the candidate window below the overlay by default", () => {
        Object.defineProperty(window, "innerHeight", { value: 300, configurable: true });

        new HanjaCandidateWindow(document.createElement("textarea"), page(), rect(100, 20, 10, 10), windowOptions());

        expect(candidateWindow().style.left).toBe("100px");
        expect(candidateWindow().style.top).toBe("31px");
    });

    it("moves left to stay within the browser viewport", () => {
        Object.defineProperty(window, "innerWidth", { value: 120, configurable: true });

        new HanjaCandidateWindow(document.createElement("textarea"), page(), rect(100, 20, 10, 10), windowOptions());

        expect(candidateWindow().style.left).toBe("40px");
    });

    it("places the candidate window above the overlay when there is room above but not below", () => {
        Object.defineProperty(window, "innerHeight", { value: 60, configurable: true });

        new HanjaCandidateWindow(document.createElement("textarea"), page(), rect(100, 50, 10, 10), windowOptions());

        expect(candidateWindow().style.left).toBe("100px");
        expect(candidateWindow().style.top).toBe("10px");
    });

    it("keeps the below placement when there is not enough room above either", () => {
        Object.defineProperty(window, "innerHeight", { value: 50, configurable: true });

        new HanjaCandidateWindow(document.createElement("textarea"), page(), rect(100, 20, 10, 10), windowOptions());

        expect(candidateWindow().style.left).toBe("100px");
        expect(candidateWindow().style.top).toBe("31px");
    });

    it("renders mouse page buttons that are not keyboard-focusable", () => {
        new HanjaCandidateWindow(
            document.createElement("textarea"),
            page({ pageCount: 2 }),
            rect(100, 20, 10, 10),
            windowOptions()
        );

        expect(pageButton("previous")?.tabIndex).toBe(-1);
        expect(pageButton("next")?.tabIndex).toBe(-1);
    });

    it("does not render mouse page buttons for a single page", () => {
        new HanjaCandidateWindow(
            document.createElement("textarea"),
            page({ pageCount: 1 }),
            rect(100, 20, 10, 10),
            windowOptions()
        );

        expect(pageButton("previous")).toBeNull();
        expect(pageButton("next")).toBeNull();
    });

    it("renders mouse page buttons below the candidate list", () => {
        new HanjaCandidateWindow(
            document.createElement("textarea"),
            page({ pageCount: 2 }),
            rect(100, 20, 10, 10),
            windowOptions()
        );

        expect(candidateWindow().lastElementChild?.classList.contains("page-controls")).toBe(true);
    });

    it("marks multi-page results so styling can reserve a nine-item candidate list height", () => {
        new HanjaCandidateWindow(
            document.createElement("textarea"),
            page({ candidates: [candidate("儺")], pageIndex: 1, pageCount: 2 }),
            rect(100, 20, 10, 10),
            windowOptions()
        );

        expect(candidateWindow().classList.contains("has-pages")).toBe(true);
    });

    it("does not mark single-page results for the reserved candidate list height", () => {
        new HanjaCandidateWindow(document.createElement("textarea"), page(), rect(100, 20, 10, 10), windowOptions());

        expect(candidateWindow().classList.contains("has-pages")).toBe(false);
    });

    it("renders page hint dots above adjacent left-aligned page buttons", () => {
        new HanjaCandidateWindow(
            document.createElement("textarea"),
            page({ pageIndex: 2, pageCount: 4 }),
            rect(100, 20, 10, 10),
            windowOptions()
        );

        const controls = candidateWindow().querySelector<HTMLElement>(".page-controls")!;
        const pageHint = candidateWindow().querySelector<HTMLElement>(".page-hint")!;
        const buttonRow = candidateWindow().querySelector<HTMLElement>(".page-buttons")!;
        const dots = Array.from(candidateWindow().querySelectorAll<HTMLElement>(".page-dot"));

        expect(controls.firstElementChild).toBe(pageHint);
        expect(controls.lastElementChild).toBe(buttonRow);
        expect(buttonRow.children[0]).toBe(pageButton("previous"));
        expect(buttonRow.children[1]).toBe(pageButton("next"));
        expect(dots).toHaveLength(4);
        expect(dots.map((dot) => dot.classList.contains("is-active"))).toEqual([false, false, true, false]);
    });

    it("calls the page callbacks when mouse buttons are clicked", () => {
        const options = windowOptions();
        new HanjaCandidateWindow(
            document.createElement("textarea"),
            page({ pageIndex: 1, pageCount: 3 }),
            rect(100, 20, 10, 10),
            options
        );

        pageButton("previous")?.click();
        pageButton("next")?.click();

        expect(options.onPreviousPage).toHaveBeenCalled();
        expect(options.onNextPage).toHaveBeenCalled();
    });

    it("calls the candidate callback when a candidate is clicked", () => {
        const options = windowOptions();
        new HanjaCandidateWindow(
            document.createElement("textarea"),
            page({ candidates: [candidate("韓"), candidate("寒"), candidate("恨")] }),
            rect(100, 20, 10, 10),
            options
        );

        candidateItems()[1].click();

        expect(options.onSelectCandidate).toHaveBeenCalledWith(1);
    });

    it("renders Hanja candidate metadata", () => {
        new HanjaCandidateWindow(
            document.createElement("textarea"),
            page({
                candidates: [
                    candidate("韓", {
                        korean: "나라 이름 한, 한나라 한",
                        simplified: "韩",
                        pinyin: "hán",
                    }),
                ],
            }),
            rect(100, 20, 10, 10),
            windowOptions()
        );

        expect(document.querySelector(".can-hanja")?.textContent).toBe("韓");
        expect(document.querySelector(".can-korean")?.textContent).toBe("나라 이름 한, 한나라 한");
        expect(document.querySelector(".can-simplified")?.textContent).toBe("韩");
        expect(document.querySelector(".can-pinyin")?.textContent).toBe("hán");
    });

    it("renders Korean-only Hanja candidate metadata", () => {
        new HanjaCandidateWindow(
            document.createElement("textarea"),
            page({
                candidates: [
                    {
                        hanja: "韓",
                        korean: "나라 이름 한, 한나라 한",
                    },
                ],
            }),
            rect(100, 20, 10, 10),
            windowOptions()
        );

        expect(document.querySelector(".can-hanja")?.textContent).toBe("韓");
        expect(document.querySelector(".can-korean")?.textContent).toBe("나라 이름 한, 한나라 한");
        expect(document.querySelector(".can-simplified")?.textContent).toBe("");
        expect(document.querySelector(".can-pinyin")?.textContent).toBe("");
    });

    it("highlights a hovered candidate without changing the selected candidate", () => {
        new HanjaCandidateWindow(
            document.createElement("textarea"),
            page({ candidates: [candidate("韓"), candidate("寒"), candidate("恨")], selectedIndex: 0 }),
            rect(100, 20, 10, 10),
            windowOptions()
        );

        const candidates = candidateItems();

        candidates[1].dispatchEvent(new MouseEvent("mouseenter"));

        expect(candidates[0].getAttribute("aria-selected")).toBe("true");
        expect(candidates[1].getAttribute("aria-selected")).toBe("false");
        expect(candidates[0].classList.contains("is-selected")).toBe(true);
        expect(candidates[0].classList.contains("is-hovered")).toBe(false);
        expect(candidates[1].classList.contains("is-selected")).toBe(false);
        expect(candidates[1].classList.contains("is-hovered")).toBe(true);

        candidates[1].dispatchEvent(new MouseEvent("mouseleave"));

        expect(candidates[0].classList.contains("is-selected")).toBe(true);
        expect(candidates[1].classList.contains("is-hovered")).toBe(false);
    });

    it("prevents candidate mousedown from moving focus", () => {
        const options = windowOptions();
        new HanjaCandidateWindow(
            document.createElement("textarea"),
            page({ candidates: [candidate("韓"), candidate("寒"), candidate("恨")] }),
            rect(100, 20, 10, 10),
            options
        );

        const mousedown = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
        candidateItems()[1].dispatchEvent(mousedown);

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

        const down = new WheelEvent("wheel", { deltaY: 100, bubbles: true, cancelable: true });
        const up = new WheelEvent("wheel", { deltaY: -100, bubbles: true, cancelable: true });

        candidateWindow().dispatchEvent(down);
        candidateWindow().dispatchEvent(up);

        expect(options.onMoveSelection).toHaveBeenNthCalledWith(1, 1);
        expect(options.onMoveSelection).toHaveBeenNthCalledWith(2, -1);
        expect(down.defaultPrevented).toBe(true);
        expect(up.defaultPrevented).toBe(true);
    });
});
