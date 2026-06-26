# AGENTS.md

Guidance for working in this repo. Keep it short and current.

## What this is

A **Manifest V3 browser extension** (Chrome + Firefox) that lets people type
Hangul (Korean) in the browser without an OS-level Korean IME, plus romanization
tools and a floating on-screen keyboard. TypeScript, built with **WXT** (which
runs on Vite); the options page uses **Vue 3**.

## Workflow

Features and fixes should start with a GitHub issue. Branch off `master` using
`issue/<issue-number>-<short-kebab-case-description>` (release prep keeps its
own `release/vX.Y.Z` branch pattern). Open a PR that references the issue and
run `npm run validate` before pushing so CI passes on the first try. `master` is
protected, so changes are merged through PRs and GitHub auto-deletes the merged
branch. After a merge, **confirm it via the PR's merged state** (e.g. `gh pr
view <n> --json state`) rather than inferring it from local `git` — a local
checkout that's behind `origin/master`, or that still has the feature branch
around, can look merged when it isn't (or vice versa). `git checkout master &&
git pull` first if you do check locally.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev:chrome` | WXT dev server + launches Chrome on a throwaway profile with HMR, opening the localhost test page (`scripts/dev.mjs`). Session flags after `--`: `--enable-hanja`, `--locale=<code>`, `--dark`/`--light`. |
| `npm run dev:firefox` | Same, for Firefox (MV3). Content-script injection in dev needs **Firefox 147+** (see gotcha). |
| `npm run build:chrome` / `build:firefox` | Production build to `.output/<target>` (`gen-assets` → `wxt build`). Both targets are MV3. No gates — run `validate` separately. |
| `npm run zip:chrome` / `zip:firefox` | Build + zip for store upload (`wxt zip`) — Chrome Web Store / AMO. |
| `npm run validate` | `check-message-keys` + `tsc --noEmit` + `lint` + `check-translations` + `test` — the full gate (also run by `package:*` and CI). |
| `npm run package:chrome` / `package:firefox` | `validate` then `zip:<target>`. |
| `npm run lint` / `lint:fix` | ESLint (flat config in `eslint.config.mjs`) |
| `npm test` | Jest unit tests (ts-jest + jsdom) |
| `npm run gen-assets` | Generate the build inputs WXT doesn't (icons, OSK mode-icons, pin videos, public `_locales`) — see gotcha. Pass `chrome`/`firefox` for the right pin videos. |
| `npm run clean` | Remove `.output/`, `.wxt/`, and generated assets. |

Dev/release manifest version: **everything is MV3** — both browsers, dev and
release. Load `.output/chrome-mv3/` (or `.output/firefox-mv3/`) as an unpacked
extension at `chrome://extensions` / `about:debugging`.

## Architecture

The extension has three runtime contexts that talk via typed messages in `src/messaging/`:

- **`src/service-worker/`** — background service worker. `state-manager.ts` holds
  per-tab state (Hangul/Latin mode, on-screen-keyboard toggle) and is
  dependency-injected into the listeners (`content-script-listener.ts`,
  `menus.ts`, `action.ts`). Also hosts romanize context-menu actions and the
  romanize popup converter.
- **`src/content-script/`** — injected into all frames. Drives the IME on the
  focused element and renders the on-screen keyboard (`on-screen-keyboard/`).
- **`src/options-app/`** — Vue 3 options page.

Core domain logic (mostly pure, well unit-tested):

- **`src/composition/`** — the heart of the IME. `hangul-compositor.ts` assembles
  jamo into syllable blocks (`hangul-block.ts`, `hangul-maps.ts`).
  `hangul-ime-controller.ts` interprets keydown events and drives composition.
  **`composition-adapters/`** abstracts over editor types; the right adapter is
  chosen by `composition-adapter-factory.ts`. Active adapters: plain input,
  contentEditable, CKEditor. **Google Docs is unsupported** (factory returns no
  adapter — see gotcha below). The `GoogleDocsAdapter` file is kept for
  reference but is no longer selected.
- **`src/romanization/`** — Hangul → Latin conversion.
- **`src/settings/`** — a plain typed `Settings` object + defaults
  (`settings.ts`), loaded/saved to `chrome.storage.sync` via `settings-store.ts`.
  Other contexts react to changes via `chrome.storage.onChanged` (the options
  page only writes — there is no options→service-worker message).
- **`src/keyboard/`** — `korean-keyboard-map.ts`: the `KeyCode` enum, the key
  map (`keyMap`), and key helpers (`isModifierKey`, `isAltKey`). Foundational —
  imported across `composition/`, `content-script/`, and `messaging/`.
- Translation tone, locale inheritance, and regional wording guidance live in
  `TRANSLATIONS.md`; required complete locales are configured in
  `scripts/translations.config.json`.

## Gotchas

- **WXT generates the manifest — there is no `src/manifest.json` to edit.** It's
  built from the `manifest` field in `wxt.config.ts` plus the entrypoints WXT
  discovers under `src/entrypoints/`. `version` comes from `package.json` (so
  **bump the version there**). A stray `src/manifest.json` is a leftover Parcel
  artifact — gitignored; ignore it. WXT also emits the Firefox MV3
  `background.scripts` form automatically (no post-build patch needed).
- **Build output is `.output/`.** Release builds go to `.output/<target>` (e.g.
  `.output/chrome-mv3`, `.output/firefox-mv3`); dev builds to
  `.output/<target>-dev`. Both `.output/` and `.wxt/` are gitignored.
- **`scripts/gen-assets.mjs` generates the build inputs WXT doesn't** (run before
  every build/dev, and in `prepare`): the action/runtime icon PNGs (rendered from
  the SVGs — to `src/images/` for Vite-bundled use, and `public/images/` for the
  static manifest icons), the OSK mode-icon data-URL module (`mode-icons.ts`), the
  per-browser pin videos (`src/videos/` — pass the target `chrome`/`firefox` for
  the right variant), and the `public/_locales` copy. All gitignored. **`public/`
  lives at the repo root** (not under `src/`); WXT copies it to the output as-is.
- **Vite doesn't polyfill Node's `process` (Parcel did).** `src/platform/process-shim.ts`
  installs an empty `process.env` so runtime `process.env.*` reads don't throw —
  import it first in browser entrypoints. `process.env.NODE_ENV` is handled by
  Vite natively; the `KIME_ENABLE_HANJA` build flag reaches the browser via
  `import.meta.env` (mirrored from `VITE_ENABLE_HANJA`) in dev and the Vite
  `define` (which tree-shakes the gated Hanja UI) in production builds.
- **Firefox MV3 dev needs Firefox 147+.** WXT's MV3 dev mode relies on a Firefox
  CSP fix that landed in 147; on older Firefox the dev content script won't
  inject (the page/options/popup still load). Release is MV3 on both browsers
  regardless. To exercise Firefox MV3 on an older build, use `build:firefox` and
  load `.output/firefox-mv3` via `about:debugging`.
- **`dev:*` serves a localhost test page and opens it.** `scripts/dev.mjs` serves
  a textarea/input/contenteditable page on `http://localhost:3344` and WXT opens
  it on launch (`webExt.startUrls` in `wxt.config.ts`), so the content script
  injects into a real http page (it won't on `file:`/`about:` URLs). The Firefox
  dev profile also gets prefs to suppress Firefox's own first-run "Welcome" /
  Terms-of-Use modal.
- **Google Docs uses canvas + the EditContext API.** Docs
  ignores synthetic composition events entirely (input goes through an
  EditContext the page owns, not the DOM), so it's unsupported — the factory
  returns no adapter for it. Don't waste time trying to drive Docs with
  synthetic events; that door is closed (Google Input Tools only works via a
  private main-world bridge into Docs' internal `kix` editor).
- ESLint uses **flat config** (`eslint.config.mjs`). There is no `.eslintrc`.
- `tsc` is type-check only (`--noEmit`); **Vite (via WXT) does the actual bundling**.
- A **husky pre-commit hook** (`.husky/pre-commit`, installed via the `prepare`
  script on `npm install`) runs `lint-staged` (ESLint `--fix` on staged files)
  then `tsc --noEmit`. Commits with lint/type errors are blocked; `--no-verify`
  bypasses.
- Tracing decorator (`src/decorators/trace.ts`) is a no-op in production and
  logs method calls in dev — handy for debugging composition flow.

## Releases

For information on each release, see `CHANGELOG.md`.

The full release checklist is in `RELEASING.md`.

### Note
The first release to be properly tagged in the repo is 2.3.0.

All previous Git tags (v1.0.1–v2.2.2) were reconstructed after the fact on the day we did the 2.3.0 release
and are approximate: they're anchored to commits by best effort using the dates in
`CHANGELOG.md`, so they mark roughly where each release was, not exactly.
