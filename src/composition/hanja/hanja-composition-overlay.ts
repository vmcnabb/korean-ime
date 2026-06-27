import { GlyphRect } from "../compositing-box";
import { CompositionAdapter } from "../composition-adapters/composition-adapter";
import { completeRunTextRange, HanjaConversionTarget, matchedTextRange } from "./hanja-converter";

export class HanjaCompositionOverlay {
    private root?: HTMLDivElement;
    private rect?: GlyphRect;
    private target?: HanjaConversionTarget;
    private rafId?: number;

    constructor(private readonly adapter: CompositionAdapter) {}

    show(target: HanjaConversionTarget): GlyphRect | undefined {
        if (!this.adapter.supportsMethods("getTextRangeRects")) {
            return undefined;
        }

        this.target = target;
        this.root = document.createElement("div");
        Object.assign(this.root.style, {
            position: "fixed",
            inset: "0",
            pointerEvents: "none",
            zIndex: "2147483647",
        });
        this.root.dataset.kimeHanjaComposition = "true";
        document.body.appendChild(this.root);
        this.render();
        window.addEventListener("scroll", this.scheduleRender, true);
        window.addEventListener("resize", this.scheduleRender);
        return this.rect;
    }

    remove(): void {
        if (this.rafId !== undefined) {
            cancelAnimationFrame(this.rafId);
            this.rafId = undefined;
        }
        window.removeEventListener("scroll", this.scheduleRender, true);
        window.removeEventListener("resize", this.scheduleRender);
        this.root?.remove();
        this.root = undefined;
        this.target = undefined;
        this.rect = undefined;
    }

    private scheduleRender = (): void => {
        if (this.rafId !== undefined) {
            return;
        }
        this.rafId = requestAnimationFrame(() => {
            this.rafId = undefined;
            this.render();
        });
    };

    private render(): void {
        if (!this.root || !this.target) {
            return;
        }

        const runRects = this.adapter.getTextRangeRects(completeRunTextRange(this.target));
        const matchRects = this.adapter.getTextRangeRects(matchedTextRange(this.target));
        this.root.replaceChildren(
            ...runRects.map((rect) => createDecoration(rect, "underline")),
            ...matchRects.map((rect) => createDecoration(rect, "match"))
        );
        this.rect = matchRects.at(-1);
    }
}

function createDecoration(rect: GlyphRect, kind: "underline" | "match"): HTMLDivElement {
    const decoration = document.createElement("div");
    Object.assign(decoration.style, {
        position: "absolute",
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        boxSizing: "border-box",
        ...(kind === "underline"
            ? { borderBottom: "1px solid rgba(68, 136, 255, 0.95)" }
            : {
                  border: "1px solid rgba(68, 136, 255, 0.9)",
                  backgroundColor: "rgba(68, 136, 255, 0.12)",
              }),
    });
    decoration.dataset.kimeHanjaDecoration = kind;
    return decoration;
}
