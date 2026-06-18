import { measureInputRangeRect } from "./input-range-rect";

// jsdom doesn't do layout, so the mirror measurement can't produce real
// coordinates — but it must fail gracefully (return undefined, throw nothing) and
// must not leave its temporary mirror element behind in the document. The actual
// positioning is verified in-browser (see #152).
describe("measureInputRangeRect", () => {
    afterEach(() => {
        document.body.innerHTML = "";
    });

    it("returns undefined without throwing when layout is unavailable (jsdom)", () => {
        const textarea = document.createElement("textarea");
        textarea.value = "한국";
        document.body.appendChild(textarea);

        expect(measureInputRangeRect(textarea, 0, 1)).toBeUndefined();
    });

    it("cleans up its temporary mirror element", () => {
        const textarea = document.createElement("textarea");
        textarea.value = "한국";
        document.body.appendChild(textarea);

        measureInputRangeRect(textarea, 0, 1);

        // only the textarea remains; the mirror div was removed
        expect(document.body.childElementCount).toBe(1);
        expect(document.body.firstElementChild).toBe(textarea);
    });
});
