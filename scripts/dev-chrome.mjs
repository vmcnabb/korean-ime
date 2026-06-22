// Dev launcher: builds the extension and launches Chrome with it available,
// opening a built-in test page served over http://localhost so the content
// script actually injects (it won't on data:/about: URLs).
//
// Two modes:
//   - Default: a one-off dev build, then launch. Re-run `npm run dev:chrome`
//     after changes to rebuild.
//   - `npm run dev:chrome --watch`: also runs Parcel in watch mode, so edits
//     auto-rebuild and the extension hot-reloads during the session.
//   - Add `--dark` or `--light` to force a colour scheme for testing extension
//     pages without changing the OS/browser theme.
//
// The default is the one-off build because a background watcher fights `clean`
// (from `build`/`package`) over the shared Parcel cache and dev dist dir — only
// opt into --watch when you actually want live reload.
//
// NOTE on loading the extension: Chrome 137+ removed the --load-extension
// command-line switch (anti-malware hardening), and by Chrome 148 even the
// --disable-features=DisableLoadExtensionCommandLineSwitch opt-out no longer
// works. So we can't load via the command line any more. Instead we drive the
// DevTools Protocol's Extensions domain: launch Chrome with a fresh throwaway
// profile, --remote-debugging-pipe and --enable-unsafe-extension-debugging, then
// call Extensions.loadUnpacked over the pipe to load dist-chrome-dev/ (rebuilt on
// each run). The Extensions domain is gated to the pipe transport — it returns
// "Method not available" over --remote-debugging-port. No manual "Load unpacked"
// step, and the fresh profile carries no stale state (so no uninstall needed)
// between runs. Requires a recent Chrome (we assume developers run the latest).
//
// chrome-launcher is used only to locate the Chrome binary. Close the Chrome
// window or press Ctrl+C to stop everything.

import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import * as ChromeLauncher from "chrome-launcher";
import { getDevFlags, killChromeByProfile, killStrayDevChromes, killTree, startTestPageServer } from "./dev-shared.mjs";

const root = process.cwd();
const DEFAULT_CHROME_DEBUG_PORT = 9222;
// Dev builds go to dist-chrome-dev/ so they can never be mistaken for, or
// clobber, the production dist-chrome/ that `npm run package:chrome` ships. Keep
// this in sync with the --dist-dir in the "start:chrome" npm script.
const distDir = resolve(root, "dist-chrome-dev");

function getChromeDebugPort() {
    const rawPort = process.env.KIME_CHROME_DEBUG_PORT ?? process.env.CHROME_DEBUG_PORT;
    if (rawPort === undefined || rawPort.trim() === "") return DEFAULT_CHROME_DEBUG_PORT;

    const port = Number(rawPort);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error(`Invalid Chrome debug port: ${rawPort}`);
    }

    return port;
}

async function waitForChromePageTarget(port, url, timeout = 10000) {
    const endpoint = `http://127.0.0.1:${port}/json/list`;
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
        try {
            const response = await fetch(endpoint);
            if (response.ok) {
                const targets = await response.json();
                if (
                    Array.isArray(targets) &&
                    targets.some((target) => target?.type === "page" && target?.url === url)
                ) {
                    return;
                }
            }
        } catch {
            // Chrome starts listening on the debugging port before it publishes targets.
        }

        await new Promise((resolveDelay) => setTimeout(resolveDelay, 200));
    }

    throw new Error(`[dev] Timed out waiting for a Chrome page target at ${endpoint}.`);
}

// A minimal CDP client over the DevTools *pipe* (not the WebSocket port). The
// Extensions domain (loadUnpacked/uninstall) is gated to the pipe transport plus
// --enable-unsafe-extension-debugging; it returns "Method not available" over
// --remote-debugging-port. With --remote-debugging-pipe, Chrome reads commands
// from fd 3 and writes replies/events to fd 4, each message NUL-terminated. We
// spawn Chrome with those fds piped (see the stdio array at launch).
function connectCdpPipe(chromeProc) {
    const writeStream = chromeProc.stdio[3]; // commands → browser (fd 3)
    const readStream = chromeProc.stdio[4]; // replies/events ← browser (fd 4)
    const pending = new Map();
    const listeners = new Map(); // CDP event method → Set<handler>
    let nextId = 1;
    let buffer = Buffer.alloc(0);

    readStream.on("data", (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        let end;
        while ((end = buffer.indexOf(0)) !== -1) {
            const raw = buffer.subarray(0, end).toString("utf8");
            buffer = buffer.subarray(end + 1);
            let msg;
            try {
                msg = JSON.parse(raw);
            } catch {
                continue;
            }
            if (msg.id && pending.has(msg.id)) {
                // Reply to a command. ids are unique across the whole connection
                // (one global counter), so matching by id alone is correct even
                // for replies that carry a sessionId.
                const { resolve: res, reject: rej } = pending.get(msg.id);
                pending.delete(msg.id);
                if (msg.error) rej(new Error(msg.error.message ?? "CDP error"));
                else res(msg.result);
            } else if (msg.method) {
                // An event (no id). In flat mode, session events carry sessionId.
                const handlers = listeners.get(msg.method);
                if (handlers) {
                    for (const handler of handlers) handler(msg.params ?? {}, msg.sessionId);
                }
            }
        }
    });

    return {
        // sessionId routes a command to an auto-attached target's flat session;
        // omit it for browser-level commands (Extensions.*, Target.*).
        send(method, params = {}, sessionId) {
            const id = nextId++;
            return new Promise((res, rej) => {
                pending.set(id, { resolve: res, reject: rej });
                const message = sessionId ? { id, method, params, sessionId } : { id, method, params };
                writeStream.write(`${JSON.stringify(message)}\0`);
            });
        },
        on(method, handler) {
            let handlers = listeners.get(method);
            if (!handlers) listeners.set(method, (handlers = new Set()));
            handlers.add(handler);
        },
        close() {
            try {
                writeStream.end();
            } catch {
                /* already closed */
            }
        },
    };
}

// The Chrome user-data-dir is now a fresh throwaway dir per run (created at
// launch, removed on shutdown) — see profileDir below. The session file, which
// scripts/stop-dev.mjs (the "Stop Dev Chrome" task) reads to find and kill this
// session, lives in a stable repo-local dir instead so it can be found without
// knowing the temp path.
const sessionDir = resolve(root, ".chrome-profile");
const sessionFile = resolve(sessionDir, "dev-session.json");
const chromeDebugPort = getChromeDebugPort();
let profileDir; // assigned to a fresh temp dir just before launch

let chrome;
let watch; // the Parcel watch process, only in --watch mode
let shuttingDown = false;

function removeSessionFile() {
    rmSync(sessionFile, { force: true });
}

function writeSessionFile(chromePid) {
    writeFileSync(
        sessionFile,
        JSON.stringify(
            {
                devPid: process.pid,
                chromePid,
                debugPort: chromeDebugPort,
                profileDir,
                startedAt: new Date().toISOString(),
                testUrl,
            },
            null,
            2
        )
    );
}

function shutdown(code = 0) {
    if (shuttingDown) return;
    shuttingDown = true;
    removeSessionFile();
    killTree(chrome);
    killTree(watch);
    // The Windows Chrome launcher detaches the real browser from the PID we
    // captured, so killTree(chrome) can miss it. Reap any Chrome still holding
    // this run's throwaway profile — scoped to kime-dev, so it never touches the
    // user's own Chrome. This must run before we rmSync the profile dir below.
    if (profileDir) killChromeByProfile([profileDir]);
    server?.close();
    // Throwaway profile: drop it so runs don't accumulate temp dirs. Chrome may
    // still hold a lock for a moment after kill, so this is best-effort.
    if (profileDir) {
        try {
            rmSync(profileDir, { recursive: true, force: true });
        } catch {
            /* Chrome may not have fully released the profile yet */
        }
    }
    process.exit(code);
}

process.on("uncaughtException", (err) => {
    console.error("[dev] uncaught error:", err);
    shutdown(1);
});
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

// 0. Clear any stray dev Chromes left by a previous run that didn't shut down
//    cleanly. On Windows the Chrome launcher detaches the real browser from the
//    PID we capture, so a crash or abrupt Ctrl+C can strand a kime-dev Chrome
//    holding the debug port — which then breaks this launch with a "Timed out
//    waiting for a Chrome page target" error. Scoped to the kime-dev throwaway
//    profile, so it never touches the user's own Chrome.
killStrayDevChromes();

// 1. Serve the test page on a random localhost port.
const { server, testUrl } = await startTestPageServer();

// 2. Build the extension. Default: a one-off build. With --watch: start Parcel
//    in watch mode (auto-rebuild + hot reload) and wait for the first build.
const devFlags = getDevFlags();
const hanjaKeyLabel = process.platform === "darwin" ? "Right Option" : "Right Ctrl";
console.log(`[dev] Hanja conversion (${hanjaKeyLabel}): ${devFlags.enableHanja ? "enabled" : "disabled"}`);
const buildEnv = {
    ...process.env,
    NODE_ENV: "development",
    KIME_ENABLE_HANJA: devFlags.enableHanja ? "true" : "",
};

console.log("[dev] Starting...");
if (devFlags.watch) {
    console.log("[dev] Starting Parcel in watch mode…");
    watch = spawn("npm", ["run", "start:chrome"], {
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
        // would stall the pipe and crash Parcel with EPIPE), resolving on a build.
        watch.stdout.on("data", (chunk) => {
            process.stdout.write(chunk);
            if (!built && /Built in/i.test(chunk.toString())) {
                built = true;
                clearTimeout(timeout);
                resolveBuild();
            }
        });
    });
} else {
    console.log("[dev] Building the extension (one-off)…");
    const build = spawnSync("npm", ["run", "build-dev:chrome"], {
        shell: true,
        stdio: "inherit",
        env: buildEnv,
    });
    if (build.status !== 0) {
        console.error(`[dev] Build failed (code ${build.status}).`);
        shutdown(1);
    }
}

// 3. Launch Chrome on a fresh throwaway profile.
const chromePath = process.env.CHROME_PATH || ChromeLauncher.Launcher.getFirstInstallation();
if (!chromePath) {
    console.error("[dev] Could not find Chrome. Set CHROME_PATH to the chrome executable.");
    shutdown(1);
}

mkdirSync(sessionDir, { recursive: true });
removeSessionFile();
// A new throwaway user-data-dir per run: no stale state, and nothing to "Load
// unpacked" by hand since we load over CDP below. Cleaned up on shutdown.
profileDir = mkdtempSync(join(tmpdir(), "kime-dev-"));

const args = [
    `--user-data-dir=${profileDir}`,
    // The port is kept for VS Code debugging and /json polling; the *pipe* (fd
    // 3/4) is what the Extensions CDP domain requires (the port rejects
    // loadUnpacked with "Method not available"). --enable-unsafe-extension-debugging
    // unlocks loadUnpacked/uninstall.
    `--remote-debugging-port=${chromeDebugPort}`,
    "--remote-debugging-pipe",
    "--enable-unsafe-extension-debugging",
    "--no-first-run",
    "--no-default-browser-check",
    // --lang sets the UI locale chrome.i18n resolves against. Every run uses a
    // fresh profile, so a locale change always takes effect.
    ...(devFlags.locale ? [`--lang=${devFlags.locale}`] : []),
    // NB: --dark / --light are NOT forced with a Chrome switch. Chrome only ships
    // --force-dark-mode (there is no --force-light-mode), so we emulate
    // prefers-color-scheme over CDP after launch instead — see below. That works
    // for both directions and covers extension pages too.
    // Open a blank page; the test page is opened over CDP after the extension is
    // loaded, so its content script injects on load.
    "about:blank",
];

if (devFlags.locale) {
    console.log(`[dev] UI locale: ${devFlags.locale}`);
}
if (devFlags.colorScheme) {
    console.log(`[dev] Color scheme: ${devFlags.colorScheme}`);
}

// fd 0-2 ignored; fd 3/4 are the CDP pipe (--remote-debugging-pipe).
chrome = spawn(chromePath, args, { stdio: ["ignore", "ignore", "ignore", "pipe", "pipe"] });
writeSessionFile(chrome.pid ?? null);
const launchedAt = Date.now();

chrome.on("exit", () => {
    if (!shuttingDown && Date.now() - launchedAt < 3000) {
        console.error("\n[dev] Chrome exited almost immediately — it may have handed off to an");
        console.error("[dev] already-running Chrome. Close ALL other Chrome windows and re-run.\n");
    }
    shutdown(0);
});

// 4. Load the extension over the DevTools Protocol pipe, then open the test page.
const cdp = connectCdpPipe(chrome);
try {
    // Force `prefers-color-scheme` without changing the OS theme. Chrome has no
    // --force-light-mode switch (only --force-dark-mode), so instead of a flag we
    // emulate the media feature over CDP, which works for both directions.
    // Emulation.setEmulatedMedia is per-target, so we auto-attach to every
    // page/iframe target and (re)apply it on attach. The filter keeps us off the
    // extension's own service worker (and every other non-page target), so the
    // extension under test is never paused or disturbed. New targets the dev
    // opens later — the options page, the action/romanize popups — are covered
    // automatically; the on-screen keyboard renders into the page target, so it's
    // covered by emulating that page. Enabled before the test page is created
    // below so the page is caught on attach.
    if (devFlags.colorScheme) {
        cdp.on("Target.attachedToTarget", ({ targetInfo, sessionId }) => {
            const type = targetInfo?.type;
            if (type !== "page" && type !== "iframe") return;
            cdp.send(
                "Emulation.setEmulatedMedia",
                { features: [{ name: "prefers-color-scheme", value: devFlags.colorScheme }] },
                sessionId
            ).catch(() => {
                /* target may have closed before we could emulate it */
            });
        });
        await cdp.send("Target.setAutoAttach", {
            autoAttach: true,
            waitForDebuggerOnStart: false,
            flatten: true,
            filter: [
                { type: "page", exclude: false },
                { type: "iframe", exclude: false },
            ],
        });
    }

    const { id } = await cdp.send("Extensions.loadUnpacked", { path: distDir });
    console.log(`[dev] Loaded unpacked extension: ${id}`);

    // Open the test page after the extension is loaded so its content script
    // injects on load.
    await cdp.send("Target.createTarget", { url: testUrl });

    await waitForChromePageTarget(chromeDebugPort, testUrl);
} catch (err) {
    console.error(`[dev] ${err instanceof Error ? err.message : err}`);
    console.error("[dev] Loading the extension over CDP failed. Make sure you're on a recent Chrome");
    console.error("[dev] (the Extensions DevTools domain + --enable-unsafe-extension-debugging are required).");
    shutdown(1);
}

console.log(`\n[dev] Dev profile:  ${profileDir}`);
console.log(`[dev] Extension:    ${distDir}`);
console.log(`[dev] Debug port:   ${chromeDebugPort}`);
console.log(`[dev] Test page:    ${testUrl}`);
console.log("[dev] VS Code debugger target ready.");
console.log(
    devFlags.watch
        ? "[dev] Watch mode: edit & save to rebuild (auto-reloads). Close Chrome or press Ctrl+C to stop.\n"
        : "[dev] Re-run `npm run dev:chrome` after changes to rebuild (or add --watch). Close Chrome or press Ctrl+C to stop.\n"
);
