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
    "borderTopWidth",
    "borderRightWidth",
    "borderBottomWidth",
    "borderLeftWidth",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
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
    "letterSpacing",
    "wordSpacing",
    "tabSize",
    "direction",
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
    mirror.style.boxSizing = "content-box";
    mirror.style.position = "absolute";
    mirror.style.top = "0";
    mirror.style.left = "0";
    mirror.style.visibility = "hidden";
    mirror.style.overflow = "hidden";
    // A single-line input never wraps; a textarea wraps at its content width.
    mirror.style.whiteSpace = isSingleLine ? "pre" : "pre-wrap";
    mirror.style.wordWrap = isSingleLine ? "normal" : "break-word";
    if (isSingleLine) {
        mirror.style.width = "auto";
    }

    const value = field.value;
    mirror.textContent = value.substring(0, start);
    const marker = doc.createElement("span");
    // A zero-width range (collapsed) still needs something to measure.
    marker.textContent = value.substring(start, end) || "\u200b";
    mirror.appendChild(marker);
    mirror.appendChild(doc.createTextNode(value.substring(end)));

    doc.body.appendChild(mirror);
    const mirrorRect = mirror.getBoundingClientRect();
    const markerRect = marker.getBoundingClientRect();
    doc.body.removeChild(mirror);

    if (markerRect.width === 0 && markerRect.height === 0) {
        return undefined;
    }

    // The mirror replicates the field's border + padding, so the marker's offset
    // from the mirror's border-box equals its offset from the field's border-box
    // (before the field scrolls its content).
    const offsetLeft = markerRect.left - mirrorRect.left;
    const offsetTop = markerRect.top - mirrorRect.top;

    const fieldRect = field.getBoundingClientRect();
    return {
        left: fieldRect.left + offsetLeft - field.scrollLeft,
        top: fieldRect.top + offsetTop - field.scrollTop,
        width: markerRect.width,
        height: markerRect.height,
    };
}

function toKebabCase(property: string): string {
    return property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}
