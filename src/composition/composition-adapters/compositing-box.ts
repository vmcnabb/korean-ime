/**
 * The blue overlay drawn over the Hangul block that's currently being composed.
 *
 * Everything here is editor-agnostic: lifecycle (create/update/remove), styling,
 * positioning, and — importantly — keeping the box aligned with the glyph while
 * the page or the editor scrolls. Only *measuring* where the composing glyph sits
 * on screen differs per editor, so the caller supplies that as a `measure`
 * callback returning the glyph's viewport-relative rect (or `undefined` when it
 * can't be measured, e.g. in jsdom, where the box simply isn't shown).
 *
 * Shared by `ContentEditableAdapter` and `InputAdapter` so the two stay visually
 * identical and so scroll-tracking is implemented once (see #152 / #153).
 */
export interface GlyphRect {
    left: number;
    top: number;
    width: number;
    height: number;
}

// Translucent blue, used for the border and a faint tint so the box reads as an
// active composition without depending on the page's color scheme.
const ACCENT = "68, 136, 255";
const BORDER = 1;

export class CompositingBox {
    private box?: HTMLElement;
    private rafId?: number;

    /**
     * @param host    the editor element — used to derive the box's text colour,
     *                background, and font so the composing text matches the page.
     * @param measure returns the composing glyph's rect in *viewport* coordinates,
     *                or `undefined` if it can't currently be measured.
     */
    constructor(
        private readonly host: HTMLElement,
        private readonly measure: () => GlyphRect | undefined
    ) {}

    /** Create the overlay and position it over the glyph. No-op if unmeasurable. */
    show(text: string): void {
        const rect = this.measure();
        if (!rect) {
            return;
        }

        const box = document.createElement("div");
        Object.assign(box.style, this.buildStyle());
        box.textContent = text;
        this.box = box;
        this.position(rect);
        document.body.appendChild(box);

        // scroll doesn't bubble, but a capture-phase listener on window still sees
        // scrolling from any descendant scroll container (an internally-scrolled
        // input/textarea or contentEditable), which is exactly the case that used
        // to leave the box stranded.
        window.addEventListener("scroll", this.reposition, true);
        window.addEventListener("resize", this.reposition);
    }

    /** Update the composing text and re-align the box. */
    update(text: string): void {
        if (this.box) {
            this.box.textContent = text;
        }
        const rect = this.measure();
        if (rect) {
            this.position(rect);
        }
    }

    /** Remove the overlay and detach every listener it registered. */
    remove(): void {
        if (this.rafId !== undefined) {
            cancelAnimationFrame(this.rafId);
            this.rafId = undefined;
        }
        window.removeEventListener("scroll", this.reposition, true);
        window.removeEventListener("resize", this.reposition);
        this.box?.remove();
        this.box = undefined;
    }

    // Coalesce a burst of scroll/resize events into one re-measure per frame.
    private reposition = (): void => {
        if (this.rafId !== undefined) {
            return;
        }
        this.rafId = requestAnimationFrame(() => {
            this.rafId = undefined;
            const rect = this.measure();
            if (rect && this.box) {
                this.position(rect);
            }
        });
    };

    private position(rect: GlyphRect): void {
        if (!this.box) {
            return;
        }
        // measure() returns viewport coordinates; the box is absolutely positioned
        // on document.body, so add the page scroll to convert to document space.
        Object.assign(this.box.style, {
            left: `${rect.left + window.scrollX - BORDER}px`,
            top: `${rect.top + window.scrollY - BORDER}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
        });
    }

    private buildStyle(): Partial<CSSStyleDeclaration> {
        return {
            ...getTextStyles(this.host),
            color: window.getComputedStyle(this.host).color,
            backgroundColor: resolveOpaqueBackground(this.host),
            backgroundImage: `linear-gradient(rgba(${ACCENT}, 0.18), rgba(${ACCENT}, 0.18))`,
            border: `${BORDER}px solid rgba(${ACCENT}, 0.9)`,
            // Keep the overlay tight to the glyph and inert: no inherited box
            // spacing, and never intercept pointer events meant for the editor.
            boxSizing: "content-box",
            margin: "0",
            padding: "0",
            overflow: "hidden",
            whiteSpace: "pre",
            pointerEvents: "none",
            display: "inline-block",
            position: "absolute",
            zIndex: "2147483647",
        };
    }
}

const COPIED_TEXT_STYLES: CSSStringKey[] = [
    "fontFamily",
    "fontSize",
    "fontStyle",
    "fontWeight",
    "fontVariant",
    "fontStretch",
    "fontSizeAdjust",
    "fontFeatureSettings",
    "fontKerning",
    "fontVariationSettings",
    "letterSpacing",
    "wordSpacing",
    "textTransform",
    "textRendering",
    "direction",
];

/** Copy just the text-appearance styles so the box's glyph matches the page's. */
function getTextStyles(source: Element): Partial<CSSStyleDeclaration> {
    const computed = window.getComputedStyle(source);
    const styles: Partial<CSSStyleDeclaration> = {};
    for (const property of COPIED_TEXT_STYLES) {
        styles[property] = computed[property];
    }
    return styles;
}

/**
 * The background the composing glyph actually sits on: the first opaque
 * background-color found walking up from the editor. A translucent background
 * can't occlude the underlying glyph on its own, so keep climbing; fall back to
 * the `Canvas` system colour (which tracks the user's light/dark scheme).
 */
function resolveOpaqueBackground(element: Element): string {
    let current: Element | null = element;
    while (current) {
        const backgroundColor = window.getComputedStyle(current).backgroundColor;
        if (isOpaqueColor(backgroundColor)) {
            return backgroundColor;
        }
        current = current.parentElement;
    }
    return "Canvas";
}

// True only for a fully opaque colour. getComputedStyle normalizes background-color
// to "rgb(...)"/"rgba(...)", or "rgba(0, 0, 0, 0)"/"transparent" when unset; treat
// anything with alpha < 1 (or unparseable) as see-through.
function isOpaqueColor(color: string): boolean {
    const channels = color.match(/^rgba?\(([^)]+)\)/);
    if (!channels) {
        return false;
    }
    const parts = channels[1].split(",");
    const alpha = parts.length >= 4 ? parseFloat(parts[3]) : 1;
    return alpha === 1;
}

type StringStyleKeys<T> = {
    [K in keyof T]: T[K] extends string ? K : never;
}[keyof T];

type CSSStringKey = Extract<StringStyleKeys<CSSStyleDeclaration>, string>;
