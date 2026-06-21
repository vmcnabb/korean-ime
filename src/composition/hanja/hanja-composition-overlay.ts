import { CompositingBox, GlyphRect } from "../compositing-box";
import { CompositionAdapter } from "../composition-adapters/composition-adapter";

export class HanjaCompositionOverlay {
    private box?: CompositingBox;
    private rect?: GlyphRect;

    constructor(
        private readonly host: HTMLElement,
        private readonly adapter: CompositionAdapter
    ) {}

    show(text: string): GlyphRect | undefined {
        this.box = new CompositingBox(this.host, () => {
            const rect = this.adapter.supportsMethods("getPreviousCharacterRect")
                ? this.adapter.getPreviousCharacterRect()
                : undefined;
            if (rect) {
                this.rect = rect;
            }
            return rect;
        });
        this.box.show(text);
        return this.rect;
    }

    remove(): void {
        this.box?.remove();
        this.box = undefined;
        this.rect = undefined;
    }
}
