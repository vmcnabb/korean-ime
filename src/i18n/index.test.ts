/**
 * @jest-environment node
 */
import { t } from ".";

afterEach(() => {
    delete (globalThis as { chrome?: unknown }).chrome;
});

function mockI18n(messages: Record<string, string>) {
    // getMessage returns "" for unknown keys, matching chrome.i18n.
    Object.assign(globalThis, {
        chrome: { i18n: { getMessage: (key: string) => messages[key] ?? "" } },
    });
}

describe("t", () => {
    it("returns the localized message when chrome.i18n is available", () => {
        mockI18n({ options_title: "한글 입력기 설정" });

        expect(t("options_title")).toBe("한글 입력기 설정");
    });

    it("preserves an intentionally-empty translation instead of falling back to the key", () => {
        mockI18n({ menu_onScreenKeyboard: "" });

        expect(t("menu_onScreenKeyboard")).toBe("");
    });

    it("returns the key unchanged when chrome.i18n is unavailable", () => {
        // no chrome on globalThis (test/preview runtime)
        expect(t("options_title")).toBe("options_title");
    });
});
