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
// works. So we can't auto-load into a throwaway profile any more. Instead we use
// a *persistent* dev profile: you "Load unpacked" once, and every later run
// reuses the profile with the extension still installed. The unpacked extension
// is read from dist-chrome-dev/ on each launch, which this script rebuilds, so a
// fresh `npm run dev:chrome` is current (use the extension's reload button, or
// reload the page, to pick it up if Chrome was already open).
//
// chrome-launcher is used only to locate the Chrome binary. Close the Chrome
// window or press Ctrl+C to stop everything.

import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
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

const profileDir = resolve(root, ".chrome-profile");
const sessionFile = resolve(profileDir, "dev-session.json");
const chromeDebugPort = getChromeDebugPort();

const TEST_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Korean IME — test page</title>
<style>
  body { font: 16px system-ui, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; }
  h1 { font-size: 1.3rem; }
  .hint { color: #555; background: #f4f4f4; padding: .75rem 1rem; border-radius: 6px; }
  label { display: block; margin: 1.25rem 0 .35rem; font-weight: 600; }
  textarea, input { width: 100%; font-size: 1.1rem; padding: .5rem; box-sizing: border-box; }
  textarea { height: 6rem; }
  [contenteditable] { border: 1px solid #bbb; border-radius: 4px; padding: .5rem; min-height: 3rem; font-size: 1.1rem; }
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

// 3. Launch Chrome on the persistent dev profile.
const chromePath = process.env.CHROME_PATH || ChromeLauncher.Launcher.getFirstInstallation();
if (!chromePath) {
    console.error("[dev] Could not find Chrome. Set CHROME_PATH to the chrome executable.");
    shutdown(1);
}

const firstRun = !existsSync(profileDir);
mkdirSync(profileDir, { recursive: true });
removeSessionFile();

// On first run, also open the extensions page so the one-time load is easy.
const urls = firstRun ? ["chrome://extensions", testUrl] : [testUrl];
const locale = requestedLocale();
const args = [
    `--user-data-dir=${profileDir}`,
    `--remote-debugging-port=${chromeDebugPort}`,
    "--no-first-run",
    "--no-default-browser-check",
    // --lang sets the UI locale chrome.i18n resolves against. Note: Chrome
    // caches the UI language in an existing profile, so a locale change is most
    // reliable on a fresh .chrome-profile/ (delete it to force a re-read).
    ...(locale ? [`--lang=${locale}`] : []),
    ...urls,
];

if (locale) {
    console.log(`[dev] UI locale: ${locale} (delete .chrome-profile/ if it doesn't take effect)`);
}

chrome = spawn(chromePath, args, { stdio: "ignore" });
writeSessionFile(chrome.pid ?? null);
const launchedAt = Date.now();

chrome.on("exit", () => {
    if (!shuttingDown && Date.now() - launchedAt < 3000) {
        console.error("\n[dev] Chrome exited almost immediately — it may have handed off to an");
        console.error("[dev] already-running Chrome. Close ALL other Chrome windows and re-run.\n");
    }
    shutdown(0);
});

try {
    await waitForChromePageTarget(chromeDebugPort, testUrl);
} catch (err) {
    console.error(err instanceof Error ? err.message : err);
    shutdown(1);
}

if (firstRun) {
    console.log("\n[dev] First run on this dev profile — load the extension once:");
    console.log('[dev]   1. On the chrome://extensions tab, turn on "Developer mode" (top right).');
    console.log('[dev]   2. Click "Load unpacked" and select:');
    console.log(`[dev]        ${distDir}`);
    console.log("[dev]   It stays loaded for future `npm run dev:chrome` runs (each run rebuilds it).");
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
