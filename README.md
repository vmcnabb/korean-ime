# Korean IME Chrome Extension

## Introduction

Allows typing Hangul in Chrome without a Korean IME installed at the OS level. Useful for people who want to type Korean on a computer where they don't have rights to install the Microsoft IME.

[Install Korean IME from the Chrome Web Store](https://chromewebstore.google.com/detail/korean-ime/cimmbifnciobjhchpimjekibbndgmkfk)

## Features

### Hangul typing
* Toggle between Hangul and Latin input by clicking the extension icon or pressing the right-hand **Alt** key.
* Works in standard text inputs, textareas, `contenteditable` elements, and CKEditor.
* **Not supported:** Google Docs and Word for the Web — both moved to canvas/EditContext-based editors that don't accept programmatic composition. The extension stays out of the way on those rather than mis-typing. (Word still partly works and can be enabled for development with a build flag — see below — but it's off by default.)
* Re-enter composition on an existing character by placing the caret immediately after it and pressing **Shift+Backspace**. This lets you continue building a syllable block you've already committed.

### Romanization
* Select any Hangul text, right-click, and choose **Romanize** to convert it to its Latin equivalent.

### On-screen keyboard
* A floating keyboard showing both Latin and Hangul characters.
* Shift key toggles shifted characters; the Alt key on the keyboard toggles Hangul/Latin mode.
* Enable or disable it from the extension's context menu.

## [Change Log](CHANGELOG.md)

## Development

### Setup

```sh
npm install
```

### Building the Firefox add-on (for AMO reviewers)

Step-by-step instructions to reproduce an exact copy of the submitted add-on.

**Environment requirements**
- Operating system: any (Windows, macOS, or Linux) — the build is pure
  Node.js/Parcel with no OS-specific or native steps.
- Node.js **24** (the version in [`.nvmrc`](.nvmrc)) and npm (bundled with
  Node.js). Install Node from <https://nodejs.org/>, or with
  [nvm](https://github.com/nvm-sh/nvm): `nvm install 24 && nvm use 24`.
- No other globally installed programs are required; all build tools are
  project-local dependencies installed by `npm ci`.

**Build steps**
```sh
npm ci                   # install exact dependencies from package-lock.json
npm run package:firefox  # produces korean-ime-<version>-firefox.zip
```

`package:firefox` runs every step needed to produce the add-on: validate
(type-check → lint → translation check → tests) → generate the Firefox manifest
from `src/manifest.base.json` (`scripts/build-manifest.mjs`) → Parcel production
build into `dist-firefox/` → patch the emitted manifest's background key
(`scripts/patch-firefox-manifest.mjs`) → `web-ext lint` → zip the contents of
`dist-firefox/`. The contents of the resulting zip match the submitted add-on.

### Build

| Command | Description |
|---|---|
| `npm run build` | Build **both** targets (Chrome + Firefox) — an all-targets sanity build |
| `npm run build:chrome` | Production Chrome build to `/dist-chrome` (bundle only — run `validate` for gates) |
| `npm run build:firefox` | Production Firefox build to `/dist-firefox` |
| `npm run build-dev:chrome` | Development Chrome build to `/dist-chrome-dev` (no optimisation) |
| `npm run start:chrome` | Watch mode (to `/dist-chrome-dev`) — rebuilds on file changes |
| `npm run dev:chrome` | Watch + launch Chrome (persistent dev profile) on a test page; load unpacked once |
| `npm run check` | Type-check without emitting output |
| `npm run lint` | Lint with ESLint (`npm run lint:fix` to auto-fix) |
| `npm test` | Run unit tests |
| `npm run package:chrome` | Chrome build + zip `/dist-chrome` into `korean-ime-<version>-chrome.zip` (Web Store) |
| `npm run package:firefox` | Firefox build + `web-ext lint` + zip `/dist-firefox` into `korean-ime-<version>-firefox.zip` (AMO) |

The Chrome production build (`npm run build:chrome`) outputs to `/dist-chrome` (dev builds go to `/dist-chrome-dev`, kept separate so they can't be shipped by accident) and can be loaded directly as an unpacked extension:
1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `/dist-chrome` folder

#### Enabling the Word for the Web adapter

The Word for the Web adapter is off by default. To enable it for a dev session:

```sh
npm run dev:chrome -- --enable-word
```

This sets the `KIME_ENABLE_WORD` build flag (which Parcel inlines). For other builds, set the env var directly, e.g. `KIME_ENABLE_WORD=true npm run build-dev:chrome`.

#### Debugging in VS Code

`npm run dev:chrome` launches Chrome with the DevTools remote debugging port enabled on `localhost:9222`.

Press `F5` with one of these configs selected:

1. **Debug Extension in Dev Chrome** for content-script debugging on normal `http` and `https` pages
2. **Debug Options Page in Dev Chrome** for the extension settings page
3. **Debug Popup Converter in Dev Chrome** for the popup converter window

Stopping any of those debug sessions from VS Code also shuts down the matching Chrome/dev task.

If VS Code auto-attaches to `scripts/dev.mjs`, change the terminal's **Auto Attach** mode to **Only With Flag** or turn it off for that terminal. Auto Attach only targets the Node launcher; Chrome debugging uses the workspace launch configuration above.

### Releasing

See [RELEASING.md](RELEASING.md) for the step-by-step release checklist.

### Recommended VS Code Extensions
* ESLint
* Vue Language Features (Volar)
* TypeScript Vue Plugin (Volar)

### Pre-commit hook

`npm install` sets up a [husky](https://typicode.github.io/husky/) pre-commit
hook (via the `prepare` script). On commit it runs ESLint (`--fix`) on staged
files through [lint-staged](https://github.com/lint-staged/lint-staged), then a
full type-check (`npm run check`). Bypass with `git commit --no-verify` if you
ever need to.

## Contributing

Contributions are welcome — please open an issue or pull request on [GitHub](https://github.com/vmcnabb/korean-ime). It's worth discussing your idea first to make sure it fits the direction of the project.

## License

MIT
