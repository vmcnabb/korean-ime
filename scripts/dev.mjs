// Dev launcher: builds the extension and launches Chrome with it available,
// opening a built-in test page served over http://localhost so the content
// script actually injects (it won't on data:/about: URLs).
//
// Two modes:
//   - Default: a one-off dev build, then launch. Re-run `npm run dev:chrome`
//     after changes to rebuild.
//   - `npm run dev:chrome --watch`: also runs Parcel in watch mode, so edits
//     auto-rebuild and the extension hot-reloads during the session.
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
import { createServer } from "node:http";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import * as ChromeLauncher from "chrome-launcher";

const root = process.cwd();
const DEFAULT_CHROME_DEBUG_PORT = 9222;
// Dev builds go to dist-chrome-dev/ so they can never be mistaken for, or
// clobber, the production dist-chrome/ that `npm run package:chrome` ships. Keep
// this in sync with the --dist-dir in the "start:chrome" npm script.
const distDir = resolve(root, "dist-chrome-dev");

// The Word for the Web adapter is disabled by default (see the factory). Turn it
// on for this dev session with `npm run dev:chrome -- --enable-word` (flag reaches argv)
// or `npm run dev:chrome --enable-word` (npm exposes it as npm_config_enable_word). The
// build reads KIME_ENABLE_WORD, which we set on the spawned Parcel process below.
function wordAdapterRequested() {
    if (process.argv.slice(2).includes("--enable-word")) return true;
    const cfg = process.env.npm_config_enable_word;
    if (cfg !== undefined && cfg !== "false" && cfg !== "0") return true;
    return process.env.KIME_ENABLE_WORD === "true";
}

// Watch mode (Parcel watch + hot reload) is opt-in:
// `npm run dev:chrome -- --watch` (flag reaches argv) or
// `npm run dev:chrome --watch` (npm exposes it as npm_config_watch).
function watchRequested() {
    if (process.argv.slice(2).includes("--watch")) return true;
    const cfg = process.env.npm_config_watch;
    return cfg !== undefined && cfg !== "false" && cfg !== "0";
}

// Optional UI locale for the dev Chrome, for testing chrome.i18n strings.
// `npm run dev:chrome -- --locale=ko` (flag reaches argv) or
// `npm run dev:chrome --locale=ko` (npm exposes it as npm_config_locale).
// Passed to Chrome as --lang, which sets the locale chrome.i18n resolves against.
function requestedLocale() {
    const fromArgv = process.argv.slice(2).find((a) => a.startsWith("--locale="));
    if (fromArgv) return fromArgv.slice("--locale=".length);
    return process.env.npm_config_locale || undefined;
}

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
                const { resolve: res, reject: rej } = pending.get(msg.id);
                pending.delete(msg.id);
                if (msg.error) rej(new Error(msg.error.message ?? "CDP error"));
                else res(msg.result);
            }
        }
    });

    return {
        send(method, params = {}) {
            const id = nextId++;
            return new Promise((res, rej) => {
                pending.set(id, { resolve: res, reject: rej });
                writeStream.write(`${JSON.stringify({ id, method, params })}\0`);
            });
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

const TEST_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Korean IME — test page</title>
<style>
  :root {
    color-scheme: light dark;
    --hint-bg: light-dark(#f4f4f4, #333);
    --hint-color: light-dark(#555, #ccc);
    --content-editable-border: light-dark(#bbb, #555);
    --input-bg: light-dark(white, #222);
  }
  body { font: 16px system-ui, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; }
  h1 { font-size: 1.3rem; }
  .hint { color: var(--hint-color); background: var(--hint-bg); padding: .75rem 1rem; border-radius: 6px; }
  label { display: block; margin: 1.25rem 0 .35rem; font-weight: 600; }
  textarea, input { width: 100%; font-size: 1.1rem; padding: .5rem; box-sizing: border-box; background: var(--input-bg); }
  textarea { height: 6rem; }
  [contenteditable] { border: 1px solid var(--content-editable-border); border-radius: 4px; padding: .5rem; min-height: 3rem; font-size: 1.1rem; background: var(--input-bg); }
</style>
</head>
<body>
  <h1>Korean IME — test page</h1>
  <p class="hint">Toggle Hangul with the right-hand <b>Alt</b> key (or click the extension icon).
  Try <code>dkssudgktpdy</code> → 안녕하세요.</p>

  <label for="ta">textarea</label>
  <textarea id="ta" placeholder="Type here…"></textarea>

  <label for="ti">input[type=text]</label>
  <input id="ti" type="text" placeholder="Type here…" />

  <label>contenteditable</label>
  <div contenteditable></div>
</body>
</html>`;

let server;
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

// child.kill() only kills the immediate process. On Windows, killing the whole
// process tree is the reliable way to take down the spawned Chrome — and, in
// --watch mode, the Parcel watcher (which runs through a shell) and its HMR
// server — with us.
function killTree(proc) {
    if (!proc || proc.pid === undefined || proc.killed) return;
    if (process.platform === "win32") {
        spawnSync("taskkill", ["/pid", String(proc.pid), "/T", "/F"], { stdio: "ignore" });
    } else {
        try {
            proc.kill("SIGTERM");
        } catch {
            /* already gone */
        }
    }
}

function shutdown(code = 0) {
    if (shuttingDown) return;
    shuttingDown = true;
    removeSessionFile();
    killTree(chrome);
    killTree(watch);
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

// 1. Serve the test page on a random localhost port.
server = createServer((_req, res) => {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(TEST_PAGE);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const testUrl = `http://localhost:${server.address().port}/`;

// 2. Build the extension. Default: a one-off build. With --watch: start Parcel
//    in watch mode (auto-rebuild + hot reload) and wait for the first build.
const enableWord = wordAdapterRequested();
const watchMode = watchRequested();
const buildEnv = { ...process.env, NODE_ENV: "development", KIME_ENABLE_WORD: enableWord ? "true" : "" };
console.log(`[dev] Word for the Web adapter: ${enableWord ? "enabled" : "disabled"} (Google Docs is unsupported)`);

if (watchMode) {
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

const locale = requestedLocale();
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
    ...(locale ? [`--lang=${locale}`] : []),
    // Open a blank page; the test page is opened over CDP after the extension is
    // loaded, so its content script injects on load.
    "about:blank",
];

if (locale) {
    console.log(`[dev] UI locale: ${locale}`);
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
    watchMode
        ? "[dev] Watch mode: edit & save to rebuild (auto-reloads). Close Chrome or press Ctrl+C to stop.\n"
        : "[dev] Re-run `npm run dev:chrome` after changes to rebuild (or add --watch). Close Chrome or press Ctrl+C to stop.\n"
);
