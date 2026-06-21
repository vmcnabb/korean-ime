import { GlyphRect } from "../compositing-box";
import { HANJA_CANDIDATES_PER_PAGE } from "./hanja-candidate-pager";

const HANJA_CANDIDATE_ITEM_HEIGHT_PX = 30;
const SELECTED_CANDIDATE_BACKGROUND = "#dbeafe";
const HOVERED_CANDIDATE_BACKGROUND = "#f3f4f6";

export type HanjaCandidateWindowPage = {
    candidates: readonly string[];
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
        this.root.className = "kime-hanja-candidates";
        this.applyBaseStyle();

        this.controls = document.createElement("div");
        this.controls.className = "kime-hanja-page-controls";
        this.controls.style.cssText = [
            "display:flex",
            "flex-direction:column",
            "align-items:flex-start",
            "gap:3px",
            "padding:3px 0 0",
        ].join(";");

        this.pageHint = document.createElement("div");
        this.pageHint.className = "kime-hanja-page-hint";
        this.pageHint.setAttribute("aria-hidden", "true");
        this.pageHint.style.cssText = [
            "display:flex",
            "align-items:center",
            "gap:3px",
            "height:8px",
            "padding-left:3px",
        ].join(";");

        const buttonRow = document.createElement("div");
        buttonRow.className = "kime-hanja-page-buttons";
        buttonRow.style.cssText = ["display:flex", "gap:2px"].join(";");

        const previousButton = createPageButton("‹", "Previous Hanja candidates", options.onPreviousPage);
        const nextButton = createPageButton("›", "Next Hanja candidates", options.onNextPage);
        buttonRow.append(previousButton, nextButton);
        this.controls.append(this.pageHint, buttonRow);

        this.candidateList = document.createElement("div");
        this.candidateList.className = "kime-hanja-candidate-list";
        this.candidateList.setAttribute("role", "listbox");
        this.candidateList.setAttribute("aria-label", "Hanja candidates");
        this.candidateList.style.cssText = "display:flex;flex-direction:column";
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

        if (page.pageCount > 1) {
            this.candidateList.style.minHeight = `${HANJA_CANDIDATES_PER_PAGE * HANJA_CANDIDATE_ITEM_HEIGHT_PX}px`;
            this.updatePageHint(page);
            this.root.append(this.controls);
        } else {
            this.candidateList.style.minHeight = "";
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

    private applyBaseStyle(): void {
        this.root.style.cssText = [
            "position:fixed",
            "z-index:2147483647",
            "display:inline-flex",
            "flex-direction:column",
            "padding:3px",
            "border:1px solid #9ca3af",
            "border-radius:6px",
            "background:#ffffff",
            "box-shadow:0 6px 18px rgba(0,0,0,0.18)",
            "box-sizing:border-box",
            "user-select:none",
        ].join(";");
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
            const active = index === page.pageIndex;
            const size = active ? 7 : 4;
            dot.style.cssText = [
                "display:block",
                `width:${size}px`,
                `height:${size}px`,
                "border-radius:999px",
                "background:#6b7280",
            ].join(";");
            this.pageHint.append(dot);
        }
    }

    private createCandidateItem(candidate: string, index: number): HTMLDivElement {
        const item = document.createElement("div");
        item.className = "kime-hanja-candidate";
        item.dataset.index = String(index);
        item.setAttribute("role", "option");
        item.style.cssText = [
            "display:flex",
            "align-items:center",
            "gap:6px",
            "padding:4px 8px",
            "min-width:48px",
            "font:14px/1.4 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
            "color:#111827",
            "cursor:pointer",
        ].join(";");
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
        number.textContent = String(index + 1);
        number.style.cssText = "min-width:10px;color:#6b7280;font-size:11px;text-align:right";

        const value = document.createElement("span");
        value.textContent = candidate;
        value.style.cssText = "font-size:18px;line-height:1.2";

        item.append(number, value);
        return item;
    }

    private applyCandidateHighlight(item: HTMLElement, itemIndex: number): void {
        if (item.getAttribute("aria-selected") === "true") {
            item.style.background = SELECTED_CANDIDATE_BACKGROUND;
            return;
        }

        item.style.background = itemIndex === this.hoveredIndex ? HOVERED_CANDIDATE_BACKGROUND : "transparent";
    }
}

function createPageButton(label: string, ariaLabel: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = label === "‹" ? "kime-hanja-page-previous" : "kime-hanja-page-next";
    button.textContent = label;
    button.tabIndex = -1;
    button.setAttribute("aria-label", ariaLabel);
    button.style.cssText = [
        "width:24px",
        "height:20px",
        "border:1px solid #d1d5db",
        "border-radius:4px",
        "background:#f9fafb",
        "color:#374151",
        "font:14px/1 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
        "padding:0",
        "cursor:pointer",
    ].join(";");

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
