import { GlyphRect } from "../compositing-box";
import { HanjaCandidate } from "./hanja-candidate";
import "./hanja-candidate-window.scss";

export const HANJA_CANDIDATE_WINDOW_ID = "hanja-candidate-window-27c8a11a-b4d6-4388-9928-2d578bbb1fc";
export const HANJA_CANDIDATE_WINDOW_SELECTOR = `#${HANJA_CANDIDATE_WINDOW_ID}`;

export type HanjaCandidateWindowPage = {
    candidates: readonly HanjaCandidate[];
    selectedIndex: number;
    pageIndex: number;
    pageCount: number;
};

type HanjaCandidateWindowOptions = {
    onPreviousPage: () => void;
    onNextPage: () => void;
    onMoveSelection: (delta: number) => void;
    onSelectCandidate: (visibleIndex: number) => void;
};

export class HanjaCandidateWindow {
    private readonly root: HTMLDivElement;
    private readonly candidateList: HTMLDivElement;
    private readonly controls: HTMLDivElement;
    private readonly pageHint: HTMLDivElement;
    private readonly onSelectCandidate: (visibleIndex: number) => void;
    private hoveredIndex: number | undefined;

    constructor(
        anchor: HTMLElement,
        page: HanjaCandidateWindowPage,
        overlayRect: GlyphRect | undefined,
        options: HanjaCandidateWindowOptions
    ) {
        this.onSelectCandidate = options.onSelectCandidate;
        this.root = document.createElement("div");
        this.root.id = HANJA_CANDIDATE_WINDOW_ID;

        this.controls = document.createElement("div");
        this.controls.className = "kime-hanja-page-controls";

        this.pageHint = document.createElement("div");
        this.pageHint.className = "kime-hanja-page-hint";
        this.pageHint.setAttribute("aria-hidden", "true");

        const buttonRow = document.createElement("div");
        buttonRow.className = "kime-hanja-page-buttons";

        const previousButton = createPageButton("‹", "Previous Hanja candidates", options.onPreviousPage);
        const nextButton = createPageButton("›", "Next Hanja candidates", options.onNextPage);
        buttonRow.append(previousButton, nextButton);
        this.controls.append(this.pageHint, buttonRow);

        this.candidateList = document.createElement("div");
        this.candidateList.className = "kime-hanja-candidate-list";
        this.candidateList.setAttribute("role", "listbox");
        this.candidateList.setAttribute("aria-label", "Hanja candidates");
        this.root.addEventListener("wheel", (event) => {
            event.preventDefault();
            event.stopPropagation();
            options.onMoveSelection(event.deltaY >= 0 ? 1 : -1);
        });

        this.root.append(this.candidateList);
        document.body.append(this.root);
        this.update(page);
        this.position(anchor, overlayRect);
    }

    update(page: HanjaCandidateWindowPage): void {
        this.hoveredIndex = undefined;
        this.candidateList.replaceChildren();

        page.candidates.forEach((candidate, index) => {
            this.candidateList.append(this.createCandidateItem(candidate, index));
        });

        this.root.classList.toggle("has-pages", page.pageCount > 1);
        if (page.pageCount > 1) {
            this.updatePageHint(page);
            this.root.append(this.controls);
        } else {
            this.controls.remove();
        }

        this.setActiveIndex(page.selectedIndex);
    }

    setActiveIndex(index: number): void {
        this.candidateList.querySelectorAll<HTMLElement>(".kime-hanja-candidate").forEach((item, itemIndex) => {
            const active = itemIndex === index;
            item.setAttribute("aria-selected", active ? "true" : "false");
            this.applyCandidateHighlight(item, itemIndex);
        });
    }

    remove(): void {
        this.root.remove();
    }

    private position(anchor: HTMLElement, overlayRect?: GlyphRect): void {
        const rect = overlayRect ?? anchor.getBoundingClientRect();
        const ownRect = this.root.getBoundingClientRect();
        const belowTop = rect.top + rect.height + 1;
        const aboveTop = rect.top - ownRect.height;
        const hasRoomBelow = belowTop + ownRect.height <= window.innerHeight;
        const hasRoomAbove = aboveTop >= 0;

        const top = !hasRoomBelow && hasRoomAbove ? aboveTop : belowTop;
        const left = Math.min(rect.left, window.innerWidth - ownRect.width);

        this.root.style.top = `${Math.max(0, top)}px`;
        this.root.style.left = `${Math.max(0, left)}px`;
    }

    private updatePageHint(page: HanjaCandidateWindowPage): void {
        this.pageHint.replaceChildren();

        for (let index = 0; index < page.pageCount; index += 1) {
            const dot = document.createElement("span");
            dot.className = "kime-hanja-page-dot";
            dot.dataset.pageIndex = String(index);
            dot.classList.toggle("is-active", index === page.pageIndex);
            this.pageHint.append(dot);
        }
    }

    private createCandidateItem(candidate: HanjaCandidate, index: number): HTMLDivElement {
        const item = document.createElement("div");
        item.className = "kime-hanja-candidate";
        item.dataset.index = String(index);
        item.setAttribute("role", "option");
        item.addEventListener("mousedown", (event) => {
            event.preventDefault();
            event.stopPropagation();
        });
        item.addEventListener("mouseenter", () => {
            this.hoveredIndex = index;
            this.applyCandidateHighlight(item, index);
        });
        item.addEventListener("mouseleave", () => {
            this.hoveredIndex = undefined;
            this.applyCandidateHighlight(item, index);
        });
        item.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.onSelectCandidate(index);
        });

        const number = document.createElement("span");
        number.className = "kime-hanja-candidate-number";
        number.textContent = String(index + 1);

        const value = document.createElement("span");
        value.className = "kime-hanja-candidate-hanja";
        value.textContent = candidate.hanja;

        const details = document.createElement("span");
        details.className = "kime-hanja-candidate-details";

        const korean = document.createElement("span");
        korean.className = "kime-hanja-candidate-korean";
        korean.textContent = candidate.korean;

        const metadata = document.createElement("span");
        metadata.className = "kime-hanja-candidate-metadata";

        if (candidate.simplified) {
            const simplified = document.createElement("span");
            simplified.className = "kime-hanja-candidate-simplified";
            simplified.textContent = candidate.simplified;
            metadata.append(simplified);
        }

        if (candidate.pinyin) {
            const pinyin = document.createElement("span");
            pinyin.className = "kime-hanja-candidate-pinyin";
            pinyin.textContent = candidate.pinyin;
            metadata.append(pinyin);
        }

        details.append(korean, metadata);

        item.append(number, value, details);
        return item;
    }

    private applyCandidateHighlight(item: HTMLElement, itemIndex: number): void {
        const selected = item.getAttribute("aria-selected") === "true";
        item.classList.toggle("is-selected", selected);
        item.classList.toggle("is-hovered", !selected && itemIndex === this.hoveredIndex);
    }
}

function createPageButton(label: string, ariaLabel: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement("button");
    const pageClass = label === "‹" ? "kime-hanja-page-previous" : "kime-hanja-page-next";
    button.type = "button";
    button.className = `kime-hanja-page-button ${pageClass}`;
    button.textContent = label;
    button.tabIndex = -1;
    button.setAttribute("aria-label", ariaLabel);

    button.addEventListener("mousedown", (event) => {
        event.preventDefault();
        event.stopPropagation();
    });
    button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
    });

    return button;
}
