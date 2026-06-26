import { GlyphRect } from "../compositing-box";
import { HANJA_CANDIDATE_KEYS, HanjaCandidate } from "./hanja-candidate";
import "./hanja-candidate-window.scss";

const HANJA_CANDIDATE_WINDOW_ID = "hanja-candidate-window-27c8a11a-b4d6-4388-9928-2d578bbb1fc";
export const HANJA_CANDIDATE_WINDOW_SELECTOR = `#${HANJA_CANDIDATE_WINDOW_ID}`;

export type HanjaCandidateWindowPage = {
    candidates: readonly HanjaCandidate[];
    selectedIndex: number;
    pageIndex: number;
    pageCount: number;
};

export type HanjaCandidateDisplayOptions = {
    showSimplified: boolean;
    showPinyin: boolean;
    selectSimplified?: boolean;
};

export const defaultHanjaCandidateDisplayOptions: HanjaCandidateDisplayOptions = {
    showSimplified: true,
    showPinyin: true,
    selectSimplified: false,
};

export type HanjaCandidateSelectionModifiers = {
    shiftKey: boolean;
};

type HanjaCandidateWindowOptions = {
    onPreviousPage: () => void;
    onNextPage: () => void;
    onMoveSelection: (delta: number) => void;
    onSelectCandidate: (visibleIndex: number, modifiers: HanjaCandidateSelectionModifiers) => void;
    displayOptions?: HanjaCandidateDisplayOptions;
};

type PageButtonKind = "previous" | "next";

export class HanjaCandidateWindow {
    private readonly root: HTMLDivElement;
    private readonly candidateList: HTMLDivElement;
    private readonly controls: HTMLDivElement;
    private readonly pageHint: HTMLDivElement;
    private readonly onSelectCandidate: (visibleIndex: number, modifiers: HanjaCandidateSelectionModifiers) => void;
    private displayOptions: HanjaCandidateDisplayOptions;
    private hoveredIndex: number | undefined;

    constructor(
        anchor: HTMLElement,
        page: HanjaCandidateWindowPage,
        overlayRect: GlyphRect | undefined,
        options: HanjaCandidateWindowOptions
    ) {
        this.onSelectCandidate = options.onSelectCandidate;
        this.displayOptions = options.displayOptions ?? defaultHanjaCandidateDisplayOptions;
        this.root = document.createElement("div");
        this.root.id = HANJA_CANDIDATE_WINDOW_ID;

        this.controls = document.createElement("div");
        this.controls.className = "page-controls";

        this.pageHint = document.createElement("div");
        this.pageHint.className = "page-hint";
        this.pageHint.setAttribute("aria-hidden", "true");

        const buttonRow = document.createElement("div");
        buttonRow.className = "page-buttons";

        const previousButton = createPageButton({
            kind: "previous",
            label: "◀",
            ariaLabel: "Previous Hanja candidates",
            onClick: options.onPreviousPage,
        });
        const nextButton = createPageButton({
            kind: "next",
            label: "▶",
            ariaLabel: "Next Hanja candidates",
            onClick: options.onNextPage,
        });
        buttonRow.append(previousButton, nextButton);
        this.controls.append(this.pageHint, buttonRow);

        this.candidateList = document.createElement("div");
        this.candidateList.className = "candidate-list";
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

    setDisplayOptions(displayOptions: HanjaCandidateDisplayOptions): void {
        this.displayOptions = displayOptions;
    }

    setActiveIndex(index: number): void {
        this.candidateList.querySelectorAll<HTMLElement>(".candidate").forEach((item, itemIndex) => {
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
            dot.className = "page-dot";
            dot.dataset.pageIndex = String(index);
            dot.classList.toggle("is-active", index === page.pageIndex);
            this.pageHint.append(dot);
        }
    }

    private createCandidateItem(candidate: HanjaCandidate, index: number): HTMLDivElement {
        const item = document.createElement("div");
        item.className = "candidate";
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
            this.onSelectCandidate(index, { shiftKey: event.shiftKey });
        });

        const number = document.createElement("span");
        number.className = "can-number";
        number.textContent = String(index + 1);

        const visibleKeys = HANJA_CANDIDATE_KEYS.filter(
            (key) =>
                key === "hanja" ||
                key === "korean" ||
                (key === "simplified" && this.displayOptions.showSimplified) ||
                (key === "pinyin" && this.displayOptions.showPinyin)
        );
        const elements: HTMLSpanElement[] = [];
        for (const key of visibleKeys) {
            const span = document.createElement("span");
            span.className = `can-${key}`;
            span.textContent = candidate[key] ?? "";
            if (key === "simplified" && candidate.simplified) {
                span.classList.toggle("is-selecting-simplified", this.displayOptions.selectSimplified === true);
            }
            elements.push(span);
        }

        item.append(number, ...elements);
        return item;
    }

    private applyCandidateHighlight(item: HTMLElement, itemIndex: number): void {
        const selected = item.getAttribute("aria-selected") === "true";
        item.classList.toggle("is-selected", selected);
        item.classList.toggle("is-hovered", !selected && itemIndex === this.hoveredIndex);
    }
}

function createPageButton({
    kind,
    label,
    ariaLabel,
    onClick,
}: {
    kind: PageButtonKind;
    label: string;
    ariaLabel: string;
    onClick: () => void;
}): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `page-button ${kind}`;
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
