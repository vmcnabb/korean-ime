/**
 * @jest-environment node
 */
import { popupConverterDataKey } from "./popup-converter-data";

describe("popupConverterDataKey", () => {
    it("namespaces the key by window id", () => {
        expect(popupConverterDataKey(42)).toBe("popupConverterData-42");
    });

    it("produces distinct keys per window so concurrent popups don't collide", () => {
        expect(popupConverterDataKey(1)).not.toBe(popupConverterDataKey(2));
    });
});
