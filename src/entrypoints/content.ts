import "../platform/process-shim";
import { defineContentScript } from "wxt/utils/define-content-script";
import { ContentScriptController } from "../content-script/content-script-controller";

// CSS imported transitively here (the on-screen keyboard and Hanja window SCSS,
// pulled in via ContentScriptController) is bundled by Vite and WXT adds it to
// the manifest's content_scripts[].css — no per-element styling or codegen.
export default defineContentScript({
    matches: ["<all_urls>"],
    matchAboutBlank: true,
    allFrames: true,
    runAt: "document_idle",
    main() {
        console.log("Hi from the content script!");
        const controller = new ContentScriptController();
        controller.initialize(window === top);
    },
});
