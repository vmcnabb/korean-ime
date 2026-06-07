import { debugLog } from "../debug-log";
import { gettingStartedView, optionsAppPath } from "../getting-started-route";
import { api } from "../platform/browser-api";

type ManifestWithOptionsPage = chrome.runtime.Manifest & {
    options_ui?: {
        page?: string;
    };
};

export function setupGettingStartedOnInstall(): void {
    api.runtime.onInstalled.addListener((details) => {
        if (details.reason !== "install") {
            return;
        }

        api.tabs
            .create({ url: api.runtime.getURL(getGettingStartedPath()) })
            .catch((error) => debugLog("open getting-started page failed:", error));
    });
}

function getGettingStartedPath(): string {
    const manifest = api.runtime.getManifest() as ManifestWithOptionsPage;
    const optionsPage = manifest.options_ui?.page ?? optionsAppPath;
    const separator = optionsPage.includes("?") ? "&" : "?";
    return `${optionsPage}${separator}view=${gettingStartedView}`;
}
