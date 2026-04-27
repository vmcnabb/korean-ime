import { isContentScriptRequestMessage, ContentScriptRequestAction } from "./content-to-service-messages";
import { isServiceScriptMessage, ServiceScriptMessageAction } from "./service-to-content-messages";
import { isContentScriptBroadcastMessage, ContentScriptBroadcastAction } from "./content-to-content-messages";

describe("isContentScriptRequestMessage", () => {
    it("should return true for a valid RefreshState message", () => {
        expect(
            isContentScriptRequestMessage({
                type: "contentScriptRequest",
                action: ContentScriptRequestAction.RefreshState,
            })
        ).toBe(true);
    });

    it("should return true for a valid ToggleHanYongMode message", () => {
        expect(
            isContentScriptRequestMessage({
                type: "contentScriptRequest",
                action: ContentScriptRequestAction.ToggleHanYongMode,
            })
        ).toBe(true);
    });

    it("should return true for a valid SendKey message", () => {
        expect(
            isContentScriptRequestMessage({
                type: "contentScriptRequest",
                action: ContentScriptRequestAction.SendKey,
                data: { key: "ㄱ", keyCode: "KeyR" },
            })
        ).toBe(true);
    });

    it("should return false for a wrong type", () => {
        expect(
            isContentScriptRequestMessage({
                type: "serviceScriptMessage",
                action: ContentScriptRequestAction.RefreshState,
            })
        ).toBe(false);
    });

    it("should return false for an unknown action", () => {
        expect(
            isContentScriptRequestMessage({
                type: "contentScriptRequest",
                action: "unknownAction",
            })
        ).toBe(false);
    });

    it("should return false when type is missing", () => {
        expect(
            isContentScriptRequestMessage({
                action: ContentScriptRequestAction.RefreshState,
            })
        ).toBe(false);
    });

    it("should return false when action is missing", () => {
        expect(
            isContentScriptRequestMessage({
                type: "contentScriptRequest",
            })
        ).toBe(false);
    });

    it("should return false for null", () => {
        expect(isContentScriptRequestMessage(null)).toBe(false);
    });

    it("should return false for a non-object", () => {
        expect(isContentScriptRequestMessage("hello")).toBe(false);
        expect(isContentScriptRequestMessage(42)).toBe(false);
    });
});

describe("isServiceScriptMessage", () => {
    it("should return true for a valid UpdateState message", () => {
        expect(
            isServiceScriptMessage({
                type: "serviceScriptMessage",
                action: ServiceScriptMessageAction.UpdateState,
                data: { koreanKeyboardMode: 0, isOnScreenKeyboardEnabled: false },
            })
        ).toBe(true);
    });

    it("should return true for a valid SendKey message", () => {
        expect(
            isServiceScriptMessage({
                type: "serviceScriptMessage",
                action: ServiceScriptMessageAction.SendKey,
                data: { key: "ㄱ", keyCode: "KeyR" },
            })
        ).toBe(true);
    });

    it("should return true for a valid InsertTextAfterSelection message", () => {
        expect(
            isServiceScriptMessage({
                type: "serviceScriptMessage",
                action: ServiceScriptMessageAction.InsertTextAfterSelection,
                data: "hello",
            })
        ).toBe(true);
    });

    it("should return false for a wrong type", () => {
        expect(
            isServiceScriptMessage({
                type: "contentScriptRequest",
                action: ServiceScriptMessageAction.UpdateState,
            })
        ).toBe(false);
    });

    it("should return false for an unknown action", () => {
        expect(
            isServiceScriptMessage({
                type: "serviceScriptMessage",
                action: "unknownAction",
            })
        ).toBe(false);
    });

    it("should return false for null", () => {
        expect(isServiceScriptMessage(null)).toBe(false);
    });
});

describe("isContentScriptBroadcastMessage", () => {
    it("should return true for a valid UpdateCompositionFeatures message", () => {
        expect(
            isContentScriptBroadcastMessage({
                type: "broadcast",
                action: ContentScriptBroadcastAction.UpdateCompositionFeatures,
                data: {},
            })
        ).toBe(true);
    });

    it("should return false for a wrong type", () => {
        expect(
            isContentScriptBroadcastMessage({
                type: "contentScriptRequest",
                action: ContentScriptBroadcastAction.UpdateCompositionFeatures,
            })
        ).toBe(false);
    });

    it("should return false for an unknown action", () => {
        expect(
            isContentScriptBroadcastMessage({
                type: "broadcast",
                action: "unknownAction",
            })
        ).toBe(false);
    });

    it("should return false for null", () => {
        expect(isContentScriptBroadcastMessage(null)).toBe(false);
    });
});
