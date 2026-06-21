export const HANJA_CANDIDATES_PER_PAGE = 9;

export class HanjaCandidatePager<TCandidate> {
    selectedIndex = 0;

    constructor(private readonly candidates: readonly TCandidate[]) {}

    get pageIndex(): number {
        return Math.floor(this.selectedIndex / HANJA_CANDIDATES_PER_PAGE);
    }

    get pageCount(): number {
        return Math.ceil(this.candidates.length / HANJA_CANDIDATES_PER_PAGE);
    }

    get selectedPageIndex(): number {
        return this.selectedIndex - this.pageIndex * HANJA_CANDIDATES_PER_PAGE;
    }

    get visibleCandidates(): readonly TCandidate[] {
        const start = this.pageIndex * HANJA_CANDIDATES_PER_PAGE;
        return this.candidates.slice(start, start + HANJA_CANDIDATES_PER_PAGE);
    }

    selectByVisibleIndex(index: number): number | undefined {
        const candidateIndex = this.pageIndex * HANJA_CANDIDATES_PER_PAGE + index;
        return candidateIndex < this.candidates.length ? candidateIndex : undefined;
    }

    candidateAt(index: number): TCandidate | undefined {
        return this.candidates[index];
    }

    moveSelection(delta: number): void {
        this.selectedIndex = wrap(this.selectedIndex + delta, this.candidates.length);
    }

    movePage(delta: number): void {
        const nextPage = wrap(this.pageIndex + delta, this.pageCount);
        this.selectedIndex = nextPage * HANJA_CANDIDATES_PER_PAGE;
    }
}

function wrap(value: number, length: number): number {
    return ((value % length) + length) % length;
}
