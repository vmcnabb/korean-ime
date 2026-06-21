import { HANJA_CANDIDATES_PER_PAGE, HanjaCandidatePager } from "./hanja-candidate-pager";

const candidates = Array.from({ length: 19 }, (_, index) => String(index + 1));

describe("HanjaCandidatePager", () => {
    it("uses nine candidates per page", () => {
        expect(HANJA_CANDIDATES_PER_PAGE).toBe(9);
    });

    it("returns visible candidates for the selected page", () => {
        const pager = new HanjaCandidatePager(candidates);

        expect(pager.visibleCandidates).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9"]);

        pager.movePage(1);
        expect(pager.visibleCandidates).toEqual(["10", "11", "12", "13", "14", "15", "16", "17", "18"]);

        pager.movePage(1);
        expect(pager.visibleCandidates).toEqual(["19"]);
    });

    it("maps number selection to the current page", () => {
        const pager = new HanjaCandidatePager(candidates);

        expect(pager.selectByVisibleIndex(8)).toBe(8);

        pager.movePage(1);
        expect(pager.selectByVisibleIndex(0)).toBe(9);
        expect(pager.selectByVisibleIndex(8)).toBe(17);

        pager.movePage(1);
        expect(pager.selectByVisibleIndex(0)).toBe(18);
        expect(pager.selectByVisibleIndex(1)).toBeUndefined();
    });

    it("moves up from the first entry on a page to the last entry on the previous page", () => {
        const pager = new HanjaCandidatePager(candidates);
        pager.movePage(1);

        pager.moveSelection(-1);

        expect(pager.selectedIndex).toBe(8);
        expect(pager.pageIndex).toBe(0);
        expect(pager.selectedPageIndex).toBe(8);
    });

    it("moves down from the last entry on a page to the first entry on the next page", () => {
        const pager = new HanjaCandidatePager(candidates);
        pager.selectedIndex = 8;

        pager.moveSelection(1);

        expect(pager.selectedIndex).toBe(9);
        expect(pager.pageIndex).toBe(1);
        expect(pager.selectedPageIndex).toBe(0);
    });

    it("wraps selection from the beginning to the end", () => {
        const pager = new HanjaCandidatePager(candidates);

        pager.moveSelection(-1);
        expect(pager.selectedIndex).toBe(18);
        expect(pager.pageIndex).toBe(2);
        expect(pager.selectedPageIndex).toBe(0);
    });

    it("wraps selection from the end to the beginning", () => {
        const pager = new HanjaCandidatePager(candidates);

        pager.selectedIndex = 18;
        pager.moveSelection(1);
        expect(pager.selectedIndex).toBe(0);
        expect(pager.pageIndex).toBe(0);
        expect(pager.selectedPageIndex).toBe(0);
    });

    it("wraps pages in both directions", () => {
        const pager = new HanjaCandidatePager(candidates);

        pager.movePage(-1);
        expect(pager.visibleCandidates).toEqual(["19"]);

        pager.movePage(1);
        expect(pager.visibleCandidates).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9"]);
    });
});
