// Dev launcher. Serves a localhost test page (the content script injects on
// http(s) pages, not file:/about:/data: URLs) and runs `wxt`, which builds,
// loads the extension into a throwaway browser profile, and opens the test page
// — wxt.config.ts `webExt.startUrls` points at the port below. Browser launch
// and teardown are WXT/web-ext's job now, so this is just the page + server +
// flag plumbing (the Parcel-era dev-chrome/dev-firefox/dev-shared did all of
// that by hand).
//
// Session flags (after `--`, e.g. `npm run dev -- --dark --locale=ko`):
//   --enable-hanja   build with the gated Hanja feature on (KIME_ENABLE_HANJA)
//   --locale=<code>  force the browser UI locale chrome.i18n resolves against
//   --dark / --light force prefers-color-scheme without changing the OS theme
//                    (Chrome only forces dark — it has no --force-light-mode)
// The flags are read by wxt.config.ts from the env vars set below; remaining
// args (e.g. `-b firefox --mv3`) are forwarded to wxt untouched.

import { spawn } from "node:child_process";
import { createServer } from "node:http";

const PORT = 3344;

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

// Flags arrive either after `--` (in argv) or, for `npm run dev --dark`, as
// npm_config_* env vars. Support both, mirroring the old launcher.
const argv = process.argv.slice(2);
const npmConfig = (name) => process.env[`npm_config_${name.replace(/-/g, "_")}`];
const isTruthy = (value) => value !== undefined && value !== "" && value !== "false" && value !== "0";
const hasFlag = (name) => argv.includes(`--${name}`) || isTruthy(npmConfig(name));
const flagValue = (name) => {
    const prefix = `--${name}=`;
    return argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? npmConfig(name) ?? undefined;
};

const enableHanja = hasFlag("enable-hanja") || process.env.KIME_ENABLE_HANJA === "true";
const locale = flagValue("locale");
const dark = hasFlag("dark");
const light = hasFlag("light");

if (dark && light) {
    console.error("[dev] choose either --dark or --light, not both.");
    process.exit(1);
}
const colorScheme = dark ? "dark" : light ? "light" : undefined;

// wxt.config.ts reads these (build-time KIME_ENABLE_HANJA define + webExt args).
const env = { ...process.env };
if (enableHanja) env.KIME_ENABLE_HANJA = "true";
if (locale) env.KIME_DEV_LOCALE = locale;
if (colorScheme) env.KIME_DEV_COLOR_SCHEME = colorScheme;

// Forward only wxt's own args (e.g. `-b firefox --mv3`); strip our flags.
const ours = new Set(["--enable-hanja", "--dark", "--light"]);
const wxtArgs = argv.filter((arg) => !ours.has(arg) && !arg.startsWith("--locale="));

const server = createServer((_req, res) => {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(TEST_PAGE);
});

server.listen(PORT, "127.0.0.1", () => {
    console.log(`[dev] test page → http://localhost:${PORT}/`);
    if (enableHanja) console.log("[dev] Hanja feature: enabled");
    if (locale) console.log(`[dev] UI locale: ${locale}`);
    if (colorScheme) console.log(`[dev] Color scheme: ${colorScheme}`);
});

// Pass the command as one shell string (not a separate args array) to avoid
// Node's DEP0190 warning; wxtArgs are simple flags with no spaces to escape.
const wxt = spawn(["wxt", ...wxtArgs].join(" "), { stdio: "inherit", shell: true, env });

const shutdown = () => {
    server.close();
    if (!wxt.killed) {
        wxt.kill();
    }
};

wxt.on("exit", (code) => {
    server.close();
    process.exit(code ?? 0);
});
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
