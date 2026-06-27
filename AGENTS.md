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
| `npm run build:chrome` / `build:firefox` | Production build to `.output/<target>` (`gen-assets` → `wxt build`). Both targets are MV3. Pass `-- --enable-hanja` to include the gated Hanja feature. No gates — run `validate` separately. |
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

- **WXT generates the manifest** from the `manifest` field in `wxt.config.ts`
  plus the entrypoints under `src/entrypoints/`; `version` comes from
  `package.json` (**bump it there**). The Firefox MV3 `background.scripts` form is
  emitted for you.
- **Build output is `.output/`** — `.output/<target>` for release (`chrome-mv3`,
  `firefox-mv3`), `.output/<target>-dev` for dev. Both `.output/` and `.wxt/` are
  gitignored.
- **`scripts/gen-assets.mjs` generates the icons, OSK mode-icon module
  (`mode-icons.ts`), per-browser pin videos, and `public/_locales` copy** (run
  before each build/dev and in `prepare`). Icons go to `src/images/` for bundling
  and `public/images/` for the static manifest icons; pass `chrome`/`firefox` for
  the matching pin videos. `public/` sits at the repo root and WXT copies it to
  the output as-is.
- **Import `src/platform/process-shim.ts` first in browser entrypoints** — it
  installs `process.env` so build-flag reads work in the browser.
  `KIME_ENABLE_HANJA` reaches the browser via `import.meta.env` (mirrored from
  `VITE_ENABLE_HANJA`) in dev, and a Vite `define` that tree-shakes the gated
  Hanja UI in production.
- **Firefox MV3 dev needs Firefox 147+** — its MV3 dev mode relies on a CSP fix
  from 147; on older Firefox use `build:firefox` + `about:debugging` instead.
- **`dev:*` serves a localhost test page and opens it.** `scripts/dev.mjs` serves
  a textarea/input/contenteditable page on `http://localhost:3344`; WXT opens it
  (`webExt.startUrls`) so the content script injects into a real http page. The
  Firefox dev profile gets prefs to skip Firefox's first-run / Terms-of-Use modal.
- **Google Docs is unsupported** — it routes input through an EditContext it owns,
  ignoring synthetic events and DOM mutation, so the factory returns no adapter.
  (Google Input Tools only works via a private main-world bridge into Docs' `kix`
  editor.)
- ESLint uses **flat config** (`eslint.config.mjs`).
- `tsc --noEmit` type-checks; WXT (Vite) bundles.
- **husky pre-commit** (`.husky/pre-commit`) runs `lint-staged` then `tsc --noEmit`;
  bypass with `--no-verify`.
- The tracing decorator (`src/decorators/trace.ts`) logs method calls in dev and
  is a no-op in production — handy for tracing composition flow.

## Releases

For information on each release, see `CHANGELOG.md`.

The full release checklist is in `RELEASING.md`.

### Note
The first release to be properly tagged in the repo is 2.3.0.

All previous Git tags (v1.0.1–v2.2.2) were reconstructed after the fact on the day we did the 2.3.0 release
and are approximate: they're anchored to commits by best effort using the dates in
`CHANGELOG.md`, so they mark roughly where each release was, not exactly.
