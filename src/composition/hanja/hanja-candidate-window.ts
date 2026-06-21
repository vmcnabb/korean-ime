import { GlyphRect } from "../compositing-box";

export class HanjaCandidateWindow {
    private readonly root: HTMLDivElement;

    constructor(anchor: HTMLElement, candidates: readonly string[], overlayRect?: GlyphRect) {
        this.root = document.createElement("div");
        this.root.className = "kime-hanja-candidates";
        this.root.setAttribute("role", "listbox");
        this.root.setAttribute("aria-label", "Hanja candidates");
        this.applyBaseStyle();

        candidates.forEach((candidate, index) => {
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
            ].join(";");

            const number = document.createElement("span");
            number.textContent = String(index + 1);
            number.style.cssText = "min-width:10px;color:#6b7280;font-size:11px;text-align:right";

            const value = document.createElement("span");
            value.textContent = candidate;
            value.style.cssText = "font-size:18px;line-height:1.2";

            item.append(number, value);
            this.root.append(item);
        });

        document.body.append(this.root);
        this.position(anchor, overlayRect);
        this.setActiveIndex(0);
    }

    setActiveIndex(index: number): void {
        this.root.querySelectorAll<HTMLElement>(".kime-hanja-candidate").forEach((item, itemIndex) => {
            const active = itemIndex === index;
            item.setAttribute("aria-selected", active ? "true" : "false");
            item.style.background = active ? "#dbeafe" : "transparent";
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
        const left = rect.left;

        this.root.style.top = `${Math.max(0, top)}px`;
        this.root.style.left = `${Math.max(0, left)}px`;
    }
}
