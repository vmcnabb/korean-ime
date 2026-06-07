/**
 * @jest-environment node
 */
import { setupGettingStartedOnInstall } from "./getting-started";

let installListener: (details: chrome.runtime.InstalledDetails) => void;
let tabsCreate: ReturnType<typeof jest.fn>;

beforeEach(() => {
    tabsCreate = jest.fn(async () => ({}));

    Object.assign(globalThis, {
        chrome: {
            runtime: {
                getURL: jest.fn((path: string) => `chrome-extension://test/${path}`),
                getManifest: jest.fn(() => ({ options_ui: { page: "options-app.hashed.html" } })),
                onInstalled: {
                    addListener: jest.fn((listener: typeof installListener) => {
                        installListener = listener;
                    }),
                },
            },
            tabs: { create: tabsCreate },
        },
    });
});

afterEach(() => {
    delete (globalThis as { chrome?: unknown }).chrome;
});

describe("setupGettingStartedOnInstall", () => {
    it("opens the getting-started page on first install", () => {
        setupGettingStartedOnInstall();

        installListener({ reason: "install" } as chrome.runtime.InstalledDetails);

        expect(chrome.runtime.getURL).toHaveBeenCalledWith("options-app.hashed.html?view=getting-started");
        expect(tabsCreate).toHaveBeenCalledWith({
            url: "chrome-extension://test/options-app.hashed.html?view=getting-started",
        });
    });

    it("falls back to the source options page path when the manifest page is missing", () => {
        (chrome.runtime.getManifest as jest.Mock).mockReturnValue({});
        setupGettingStartedOnInstall();

        installListener({ reason: "install" } as chrome.runtime.InstalledDetails);

        expect(chrome.runtime.getURL).toHaveBeenCalledWith("options-app/index.html?view=getting-started");
    });

    it("does not open the getting-started page on update", () => {
        setupGettingStartedOnInstall();

        installListener({ reason: "update" } as chrome.runtime.InstalledDetails);

        expect(tabsCreate).not.toHaveBeenCalled();
    });

    it("does not open the getting-started page for browser-update install events", () => {
        setupGettingStartedOnInstall();

        installListener({ reason: "chrome_update" } as chrome.runtime.InstalledDetails);

        expect(tabsCreate).not.toHaveBeenCalled();
    });
});
