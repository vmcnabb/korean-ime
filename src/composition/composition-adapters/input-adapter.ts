import { KeyCode } from "../../keyboard/korean-keyboard-map";
import { CompositionAdapter } from "./composition-adapter";
import { CompositingBox, GlyphRect } from "../compositing-box";

export class InputAdapter extends CompositionAdapter {
    private isCompositing = false;
    private currentBlock = "";
    // Where the composing block starts in `value`. We track it explicitly rather
    // than leaning on the field's selection because the composing region is shown
    // with the overlay box (caret collapsed), not a native selection.
    private blockStart = 0;
    private box?: CompositingBox;

    constructor(protected element: HTMLInputElement | HTMLTextAreaElement) {
        super(element);
    }

    blur(): void {
        // A focus/caret change (blur, or a mousedown elsewhere) abandons the
        // in-progress block. Commit it properly so a `compositionend` fires —
        // otherwise the page is left thinking composition is still active and its
        // value model diverges from the element (which clears the text on the next
        // click). The controller resets the compositor before calling blur, so end
        // with the last text we composed rather than asking the compositor.
        if (this.isCompositing) {
            this.endComposition(this.currentBlock);
        }
    }

    beginComposition(text: string, keyCode: KeyCode): void {
        const start = this.element.selectionStart ?? 0;
        const end = this.element.selectionEnd ?? start;
        this.blockStart = start;

        this._beginComposition(text, keyCode, () => this.spliceValue(start, end, text));
        this.currentBlock = text;
        this.isCompositing = true;

        // Draw the composing block as an overlay box, mirroring the contentEditable
        // adapter (which collapses the caret and overlays the glyph). `spliceValue`
        // already collapsed the selection, so there's no native highlight underneath.
        this.box = new CompositingBox(this.element, () => this.measureCompositingRect());
        this.box.show(text);
    }

    updateComposition(text: string, keyCode: KeyCode) {
        const previous = this.currentBlock;
        this._updateComposition(text, keyCode, () =>
            this.spliceValue(this.blockStart, this.blockStart + previous.length, text)
        );
        this.currentBlock = text;
        this.box?.update(text);
    }

    endComposition(text: string) {
        const previous = this.currentBlock;
        this._endComposition(text, () => this.spliceValue(this.blockStart, this.blockStart + previous.length, text));
        this.isCompositing = false;
        this.currentBlock = "";
        this.box?.remove();
        this.box = undefined;
    }

    /**
     * Replace `value[start, end)` with `text` and collapse the caret to the end of
     * the inserted text — so the composing block is shown by the overlay box, not a
     * native selection highlight.
     */
    private spliceValue(start: number, end: number, text: string) {
        const element = this.element;
        element.value = element.value.substring(0, start) + text + element.value.substring(end);
        const caret = start + text.length;
        element.selectionStart = caret;
        element.selectionEnd = caret;
    }

    private measureCompositingRect() {
        return measureInputRangeRect(this.element, this.blockStart, this.blockStart + this.currentBlock.length);
    }

    getPreviousCharacterRect() {
        const caret = this.element.selectionStart;
        if (!caret || caret < 1) {
            return undefined;
        }

        return measureInputRangeRect(this.element, caret - 1, caret);
    }

    inputCharacter(data: string, keyCode: KeyCode): void {
        super._inputCharacter(data, keyCode, () => {
            const element = this.element;
            const start = element.selectionStart;

            if (start == null) {
                return;
            }

            let end = element.selectionEnd || 0;

            element.value =
                element.value.substring(0, start) + data + element.value.substring(end, element.value.length);
            end = start + data.length;
            element.selectionStart = end;
            element.selectionEnd = end;
        });
    }

    collapseSelection(toStart?: boolean) {
        if (toStart) {
            this.element.selectionEnd = this.element.selectionStart;
        } else {
            this.element.selectionStart = this.element.selectionEnd;
        }
    }

    getPreviousCharacter() {
        const element = this.element;

        const start = (element.selectionStart || 0) - 1;
        const end = start + 1;

        if (start < 0) {
            return;
        }

        const returnVal = element.value.substring(start, end);
        return returnVal;
    }

    deleteContentBackwards() {
        const element = this.element;

        super._deleteContentBackwards(() => {
            if (element.selectionStart == null || element.selectionEnd == null) {
                return;
            }

            // If there is a selection, delete it
            if (element.selectionStart !== this.element.selectionEnd) {
                element.value =
                    this.element.value.substring(0, element.selectionStart) +
                    this.element.value.substring(element.selectionEnd, element.value.length);
                element.selectionEnd = element.selectionStart;
                return;
            }

            // If there is no selection, delete the previous character
            const caretPos = element.selectionStart; // get the current caret position
            if (caretPos > 0) {
                // make sure the caret is not at the beginning of the input field
                const newVal = element.value.slice(0, caretPos - 1) + element.value.slice(caretPos); // remove the character preceding the caret
                element.value = newVal; // set the new value of the input field
                element.selectionStart = caretPos - 1; // set the caret position to the deleted character's position
                element.selectionEnd = caretPos - 1;
            }
        });
    }
}

/**
 * Measure the on-screen rect of a character range `[start, end)` inside an
 * `<input>`/`<textarea>`. There's no addressable DOM for the text inside a form
 * field, so we use the well-known mirror technique: build a hidden `<div>` that
 * replicates the field's text-layout box, measure a Range inside it, then combine
 * that with the field's own viewport position.
 */
const MIRRORED_PROPERTIES: string[] = [
    "boxSizing",
    "borderTop",
    "borderRight",
    "borderBottom",
    "borderLeft",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "paddingBlock",
    "paddingInline",
    "fontStyle",
    "fontVariant",
    "fontWeight",
    "fontStretch",
    "fontSize",
    "fontSizeAdjust",
    "lineHeight",
    "fontFamily",
    "textAlign",
    "textTransform",
    "textIndent",
    "textRendering",
    "letterSpacing",
    "wordSpacing",
    "tabSize",
    "direction",
    "overflowWrap",
    "overflowClip",
    "overflowClipMargin",
];

function measureInputRangeRect(
    field: HTMLInputElement | HTMLTextAreaElement,
    start: number,
    end: number
): GlyphRect | undefined {
    const doc = field.ownerDocument;
    const computed = window.getComputedStyle(field);
    const isSingleLine = field.nodeName === "INPUT";

    const mirror = doc.createElement("div");
    const style = mirror.style as unknown as Record<string, string>;
    for (const property of MIRRORED_PROPERTIES) {
        style[property] = computed.getPropertyValue(toKebabCase(property));
    }

    mirror.style.position = "fixed";
    mirror.style.top = "0";
    mirror.style.left = "0";
    mirror.style.visibility = "hidden";
    mirror.style.boxSizing = "content-box";
    mirror.style.whiteSpace = isSingleLine ? "pre" : "pre-wrap";
    mirror.style.overflowWrap = isSingleLine ? "normal" : "break-word";

    if (isSingleLine) {
        mirror.style.width = "auto";
    } else {
        const paddingLeft = parseFloat(computed.paddingLeft) || 0;
        const paddingRight = parseFloat(computed.paddingRight) || 0;
        mirror.style.width = `${field.clientWidth - paddingLeft - paddingRight}px`;
    }

    const value = field.value;
    if (value.length === 0) {
        return undefined;
    }

    mirror.textContent = value;
    doc.body.appendChild(mirror);

    const range = document.createRange();
    range.setStart(mirror.firstChild || mirror, start);
    range.setEnd(mirror.firstChild || mirror, end);
    const markerRect = range.getBoundingClientRect();

    doc.body.removeChild(mirror);

    if (markerRect.width === 0 && markerRect.height === 0) {
        return undefined;
    }

    const fieldRect = field.getBoundingClientRect();
    return {
        left: markerRect.left + fieldRect.left - field.scrollLeft,
        top: markerRect.top + fieldRect.top - field.scrollTop,
        width: markerRect.width,
        height: markerRect.height,
    };
}

function toKebabCase(property: string): string {
    return property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}
