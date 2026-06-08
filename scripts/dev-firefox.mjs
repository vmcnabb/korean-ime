// Dev launcher for Firefox: builds the extension and launches Firefox with it
// installed as a temporary add-on (via web-ext), opening a built-in test page
// served over http://localhost so the content script actually injects.
//
// Two modes:
//   - Default: a one-off dev build, then launch. Re-run `npm run dev:firefox`
//     after changes to rebuild.
//   - `npm run dev:firefox --watch`: also runs Parcel in watch mode, re-patches
//     the manifest after every rebuild, and reloads the extension in Firefox.
//
// THE MANIFEST PATCH IS THE WHOLE TRICK IN --watch. Parcel only emits
// background.service_worker, but Firefox needs background.scripts, so
// scripts/patch-firefox-manifest.mjs adds it post-build (see that file + the
// Firefox build note in AGENTS.md). Parcel re-emits the service_worker-only
// manifest on *every* rebuild, dropping background.scripts, so we must re-patch
// after each build — and reload Firefox only *after* the patch, never on
// Parcel's raw emit. We therefore disable web-ext's own file watching
// (noReload) and drive the rebuild → patch → reload sequence ourselves.
//
// web-ext manages a throwaway Firefox profile and the temporary add-on install;
// close Firefox or press Ctrl+C to stop everything.

import { spawn, spawnSync } from "node:child_process";
import { resolve } from "node:path";
import webExt from "web-ext";
import { killFirefoxByProfile, killTree, requestedLocale, startTestPageServer, watchRequested } from "./dev-shared.mjs";

const root = process.cwd();
// Dev builds go to dist-firefox-dev/ so they can never be mistaken for, or
// clobber, the production dist-firefox/ that `npm run package:firefox` ships.
const distDir = resolve(root, "dist-firefox-dev");
const patchScript = resolve(root, "scripts/patch-firefox-manifest.mjs");
const reaperScript = resolve(root, "scripts/firefox-reaper.mjs");

let server;
let watch; // the Parcel watch process, only in --watch mode
let runner; // the web-ext extension runner
let reaper; // detached watchdog that closes Firefox if we're killed before cleanup
let firefoxProfileDirs = []; // throwaway profile dir(s) web-ext created, for teardown
let shuttingDown = false;

async function shutdown(code = 0) {
    if (shuttingDown) return;
    shuttingDown = true;
    killTree(watch);
    server?.close();
    killFirefoxByProfile(firefoxProfileDirs);
    // runner.exit() also removes the throwaway profile dir; cap the wait so a
    // hung teardown can't keep us alive.
    try {
        await Promise.race([runner?.exit?.() ?? Promise.resolve(), new Promise((r) => setTimeout(r, 3000))]);
    } catch {
        /* best-effort teardown */
    }
    process.exit(code);
}

process.on("uncaughtException", (err) => {
    console.error("[dev] uncaught error:", err);
    shutdown(1);
});
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

// Add background.scripts to the freshly emitted dist manifest (Firefox needs it;
// Parcel only emits service_worker). Runs after the initial build and after
// every watch rebuild.
function patchManifest() {
    const result = spawnSync(process.execPath, [patchScript, distDir], { stdio: "inherit" });
    if (result.status !== 0) {
        console.error(`[dev] Firefox manifest patch failed (code ${result.status}).`);
        shutdown(1);
    }
}

// 1. Serve the test page on a random localhost port.
const startedServer = await startTestPageServer();
server = startedServer.server;
const testUrl = startedServer.testUrl;

// 2. Build the extension. Default: a one-off build. With --watch: start Parcel
//    in watch mode and patch the manifest after the first build.
const watchMode = watchRequested();
const buildEnv = { ...process.env, NODE_ENV: "development" };

console.log("[dev] Starting...");
if (watchMode) {
    console.log("[dev] Starting Parcel in watch mode…");
    watch = spawn("npm", ["run", "start:firefox"], {
        shell: true,
        stdio: ["inherit", "pipe", "inherit"],
        env: buildEnv,
    });
    watch.on("exit", (code) => {
        if (!shuttingDown) {
            console.error(`[dev] Parcel watch exited (code ${code}). Shutting down.`);
            shutdown(1);
        }
    });

    await new Promise((resolveBuild) => {
        let built = false;
        const timeout = setTimeout(() => {
            console.error("[dev] Timed out waiting for the first Parcel build.");
            shutdown(1);
        }, 120000);
        // Permanent listener: always drain + tee Parcel's stdout (detaching it
        // would stall the pipe and crash Parcel with EPIPE). On each build, patch
        // the manifest; the first build resolves startup, later ones reload
        // Firefox (only after the patch — never on Parcel's raw emit).
        watch.stdout.on("data", (chunk) => {
            process.stdout.write(chunk);
            if (!/Built in/i.test(chunk.toString())) return;
            patchManifest();
            if (!built) {
                built = true;
                clearTimeout(timeout);
                resolveBuild();
            } else {
                runner?.reloadAllExtensions().catch((err) => {
                    console.error(`[dev] Reload failed: ${err instanceof Error ? err.message : err}`);
                });
            }
        });
    });
} else {
    console.log("[dev] Building the extension (one-off)…");
    const build = spawnSync("npm", ["run", "build-dev:firefox"], {
        shell: true,
        stdio: "inherit",
        env: buildEnv,
    });
    if (build.status !== 0) {
        console.error(`[dev] Build failed (code ${build.status}).`);
        shutdown(1);
    }
}

// 3. Launch Firefox with the extension as a temporary add-on. web-ext creates a
//    throwaway profile; noReload because we drive reloads ourselves (see above).
const locale = requestedLocale();
const runParams = {
    sourceDir: distDir,
    target: ["firefox-desktop"],
    startUrl: [testUrl],
    noReload: true,
    noInput: true,
};
if (process.env.FIREFOX_PATH) runParams.firefox = process.env.FIREFOX_PATH;
// intl.locale.requested sets the Firefox UI locale chrome.i18n resolves against.
if (locale) runParams.pref = { "intl.locale.requested": locale };

try {
    runner = await webExt.cmd.run(runParams);
} catch (err) {
    console.error(`[dev] ${err instanceof Error ? err.message : err}`);
    console.error("[dev] Could not launch Firefox. Install Firefox or set FIREFOX_PATH to its executable.");
    shutdown(1);
}
// Capture the throwaway profile dir(s) web-ext created so shutdown and the reaper
// can find and kill the matching Firefox process tree (see killFirefoxByProfile).
firefoxProfileDirs = (runner.extensionRunners ?? [])
    .map((r) => {
        try {
            return r?.profile?.path?.();
        } catch {
            return undefined;
        }
    })
    .filter(Boolean);

// Spawn the detached reaper: it closes Firefox if we're killed before our own
// shutdown can run (Ctrl+C through npm/cmd on Windows can preempt us). Detached
// + its own process group so the same Ctrl+C doesn't take it down too.
if (firefoxProfileDirs.length > 0) {
    reaper = spawn(process.execPath, [reaperScript, String(process.pid), ...firefoxProfileDirs], {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
    });
    reaper.unref();
}

// Stop the dev session when Firefox is closed.
runner.registerCleanup(() => shutdown(0));

if (locale) {
    console.log(`[dev] UI locale: ${locale}`);
}
console.log(`\n[dev] Extension:    ${distDir}`);
console.log(`[dev] Test page:    ${testUrl}`);
console.log(
    watchMode
        ? "[dev] Watch mode: edit & save to rebuild (re-patches + reloads). Close Firefox or press Ctrl+C to stop.\n"
        : "[dev] Re-run `npm run dev:firefox` after changes to rebuild (or add --watch). Close Firefox or press Ctrl+C to stop.\n"
);
