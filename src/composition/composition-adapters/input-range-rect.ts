import { GlyphRect } from "./compositing-box";

/**
 * Measure the on-screen rect of a character range `[start, end)` inside an
 * `<input>`/`<textarea>`. There's no addressable DOM for the text inside a form
 * field, so we use the well-known **mirror** technique: build a hidden `<div>`
 * that replicates the field's text-layout box (font, padding, border, width,
 * wrapping), drop a marker span at the range, and read the marker's offset within
 * the mirror. That offset, plus the field's own border-box position and minus its
 * internal scroll, gives the range's viewport rect.
 *
 * Returns `undefined` when the marker can't be measured (e.g. jsdom, which has no
 * layout) so the caller can skip drawing.
 */
const MIRRORED_PROPERTIES: string[] = [
    "width",
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

export function measureInputRangeRect(
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
    // getComputedStyle resolves `width` to the *content-box* width regardless of the
    // field's own box-sizing, so force content-box here: the copied width is then the
    // content width and the copied padding/border sit outside it, matching the field's
    // text-layout box exactly (otherwise a border-box textarea would wrap too early).
    mirror.style.position = "fixed";
    mirror.style.top = "0";
    mirror.style.left = "0";
    mirror.style.visibility = "hidden";
    mirror.style.boxSizing = "content-box";
    // A single-line input never wraps; a textarea wraps at its content width.
    mirror.style.whiteSpace = isSingleLine ? "pre" : "pre-wrap";
    mirror.style.overflowWrap = isSingleLine ? "normal" : "break-word";

    if (isSingleLine) {
        mirror.style.width = "auto";
    }

    const value = field.value;
    if (value.length === 0) return undefined;

    mirror.textContent = value;

    doc.body.appendChild(mirror);

    const range = document.createRange();
    range.setStart(mirror.firstChild || mirror, start);
    range.setEnd(mirror.firstChild || mirror, end);
    const markerRect = range.getBoundingClientRect();

    doc.body.removeChild(mirror);

    const fieldRect = field.getBoundingClientRect();
    const measure = {
        left: markerRect.left + fieldRect.left - field.scrollLeft,
        top: markerRect.top + fieldRect.top - field.scrollTop,
        width: markerRect.width,
        height: markerRect.height,
    };

    return measure;
}

function toKebabCase(property: string): string {
    return property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}
