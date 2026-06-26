import { api } from "../platform/browser-api";

type WxtReloadContentScriptPayload = {
    registration: "manifest" | "runtime";
    contentScript: chrome.scripting.RegisteredContentScript;
};

const DEV_CONTENT_SCRIPT_ID = "wxt:content-scripts/content.js";
const DEV_CONTENT_SCRIPT: chrome.scripting.RegisteredContentScript = {
    id: DEV_CONTENT_SCRIPT_ID,
    matches: ["<all_urls>"],
    js: ["content-scripts/content.js"],
    css: ["content-scripts/content.css"],
    allFrames: true,
    runAt: "document_idle",
};

let devServerSocket: WebSocket | undefined;

export async function startFirefoxDevContentScriptRegistrationBridge() {
    if (
        !isFirefoxMv3Dev() ||
        !isRealExtensionRuntime() ||
        !api.scripting?.registerContentScripts ||
        !api.scripting?.getRegisteredContentScripts
    ) {
        return;
    }

    await registerOrUpdateContentScript(DEV_CONTENT_SCRIPT);
    connectToDevServer();
}

async function registerOrUpdateContentScript(contentScript: chrome.scripting.RegisteredContentScript) {
    const id = contentScript.id ?? getContentScriptId(contentScript);
    const contentScriptWithId = {
        ...contentScript,
        id,
        css: contentScript.css ?? [],
    };
    const registered = await api.scripting.getRegisteredContentScripts({ ids: [id] });
    if (registered.length > 0 && !isSameRegisteredContentScript(registered[0], contentScriptWithId)) {
        await api.scripting.updateContentScripts([contentScriptWithId]);
        await reloadHttpTabs();
    } else if (registered.length === 0) {
        await api.scripting.registerContentScripts([contentScriptWithId]);
        await reloadHttpTabs();
    }
}

function connectToDevServer() {
    if (devServerSocket !== undefined) {
        return;
    }

    devServerSocket = new WebSocket(getDevServerWebSocketUrl(), "vite-hmr");
    devServerSocket.addEventListener("open", () => sendWxtEvent("wxt:background-initialized"));
    devServerSocket.addEventListener("close", () => {
        devServerSocket = undefined;
    });
    devServerSocket.addEventListener("message", (event) => {
        const message = JSON.parse(String(event.data)) as { type?: string; event?: string; data?: unknown };
        if (message.type !== "custom" || message.event !== "wxt:reload-content-script") {
            return;
        }

        reloadContentScript(message.data as WxtReloadContentScriptPayload).catch((error) =>
            console.debug("Firefox dev content script reload failed:", error)
        );
    });
}

function sendWxtEvent(event: string) {
    devServerSocket?.send(JSON.stringify({ type: "custom", event }));
}

async function reloadContentScript(payload: WxtReloadContentScriptPayload) {
    if (payload.registration === "runtime") {
        await reloadRuntimeContentScript(payload.contentScript);
    } else {
        await registerOrUpdateContentScript({
            ...payload.contentScript,
            id: getContentScriptId(payload.contentScript),
            css: payload.contentScript.css ?? [],
        });
    }
}

async function reloadRuntimeContentScript(contentScript: chrome.scripting.RegisteredContentScript) {
    const registered = await api.scripting.getRegisteredContentScripts();
    const matches = registered.filter((script) => {
        const hasJs = contentScript.js?.some((js) => script.js?.includes(js));
        const hasCss = contentScript.css?.some((css) => script.css?.includes(css));
        return hasJs || hasCss;
    });

    if (matches.length === 0) {
        return;
    }

    await api.scripting.updateContentScripts(matches);
    await reloadHttpTabs();
}

function getContentScriptId(contentScript: chrome.scripting.RegisteredContentScript) {
    const js = contentScript.js?.[0];
    if (js === undefined) {
        throw new Error("Cannot register a Firefox dev content script without a JS file");
    }

    return `wxt:${js}`;
}

function isSameRegisteredContentScript(
    script: chrome.scripting.RegisteredContentScript,
    expected: chrome.scripting.RegisteredContentScript = DEV_CONTENT_SCRIPT
): boolean {
    return (
        arraysEqual(script.matches ?? [], expected.matches ?? []) &&
        arraysEqual(script.js ?? [], expected.js ?? []) &&
        arraysEqual(script.css ?? [], expected.css ?? []) &&
        script.allFrames === expected.allFrames &&
        script.runAt === expected.runAt
    );
}

function arraysEqual(left: string[], right: string[]) {
    return left.length === right.length && left.every((item, index) => item === right[index]);
}

function isFirefoxMv3Dev() {
    return import.meta.env.FIREFOX && import.meta.env.COMMAND === "serve" && import.meta.env.MANIFEST_VERSION === 3;
}

function getDevServerWebSocketUrl() {
    const moduleUrl = new URL(import.meta.url);
    moduleUrl.protocol = moduleUrl.protocol === "https:" ? "wss:" : "ws:";
    moduleUrl.pathname = "/";
    moduleUrl.search = "";
    moduleUrl.hash = "";
    return moduleUrl.toString();
}

function isRealExtensionRuntime() {
    const webExtensionGlobals = globalThis as typeof globalThis & {
        browser?: typeof chrome;
        chrome?: typeof chrome;
    };
    const extensionId = webExtensionGlobals.browser?.runtime?.id ?? webExtensionGlobals.chrome?.runtime?.id;
    return Boolean(extensionId && extensionId !== "test-extension-id");
}

async function reloadHttpTabs() {
    const tabs = await api.tabs.query({});
    await Promise.all(
        tabs.map(async (tab) => {
            if (tab.id === undefined || !/^https?:\/\//.test(tab.url ?? "")) {
                return;
            }

            await api.tabs.reload(tab.id);
        })
    );
}
