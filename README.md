# Korean IME Browser Extension

A free, open-source browser extension for typing Hangul (Korean) without a
Korean IME installed at the OS level — handy when you can't install the system
IME (e.g. a locked-down work machine). Also includes a romanization tool and an
on-screen keyboard. Works in Chrome and Firefox.

- [Install from the Chrome Web Store](https://chromewebstore.google.com/detail/korean-ime/cimmbifnciobjhchpimjekibbndgmkfk)
- [Install from Firefox Add-ons](https://addons.mozilla.org/firefox/addon/korean-ime-and-romanization/)

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

## Change Log
See [Change Log](CHANGELOG.md)

## Development

Requires Node.js 24 (see [`.nvmrc`](.nvmrc)) and npm.

```sh
npm install
```

### Build

| Command | Description |
|---|---|
| `npm run build` | Build **both** targets (Chrome + Firefox) — an all-targets sanity build |
| `npm run build:chrome` | Production Chrome build to `/dist-chrome` (bundle only — run `validate` for gates) |
| `npm run build:firefox` | Production Firefox build to `/dist-firefox` |
| `npm run build-dev:chrome` | Development Chrome build to `/dist-chrome-dev` (no optimisation) |
| `npm run start:chrome` | Watch mode (to `/dist-chrome-dev`) — rebuilds on file changes |
| `npm run dev:chrome` | Build + launch Chrome (fresh throwaway profile), auto-load the extension over CDP, open a test page (add `--watch` for live reload) |
| `npm run dev:firefox` | Build + launch Firefox (via `web-ext`, temporary add-on on a throwaway profile), open a test page (add `--watch` to rebuild + reload on change) |
| `npm run check` | Type-check without emitting output |
| `npm run lint` | Lint with ESLint (`npm run lint:fix` to auto-fix) |
| `npm test` | Run unit tests |
| `npm run package:chrome` | Chrome build + zip `/dist-chrome` into `korean-ime-<version>-chrome.zip` (Web Store) |
| `npm run package:firefox` | Firefox build + `web-ext lint` + zip `/dist-firefox` into `korean-ime-<version>-firefox.zip` (AMO) |

The Chrome production build (`npm run build:chrome`) outputs to `/dist-chrome` (dev builds go to `/dist-chrome-dev`, kept separate so they can't be shipped by accident) and can be loaded directly as an unpacked extension:
1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `/dist-chrome` folder

#### Firefox development

`npm run dev:firefox` builds to `/dist-firefox-dev` and uses [`web-ext`](https://github.com/mozilla/web-ext) to launch Firefox with the extension installed as a temporary add-on on a throwaway profile — no manual loading. Add `--watch` to rebuild, re-patch the manifest, and reload the extension on every change. Set `FIREFOX_PATH` if Firefox isn't found automatically. The `--enable-word` and `--locale` flags below work the same as for `dev:chrome`.

#### Enabling the Word for the Web adapter

The Word for the Web adapter is off by default. To enable it for a dev session:

```sh
npm run dev:chrome -- --enable-word
```

This sets the `KIME_ENABLE_WORD` build flag (which Parcel inlines). For other builds, set the env var directly, e.g. `KIME_ENABLE_WORD=true npm run build-dev:chrome`.

#### Testing a different locale

Launch the dev Chrome in a specific UI language to check the `chrome.i18n` strings (e.g. Korean):

```sh
npm run dev:chrome -- --locale=ko
```

This passes `--lang=ko` to Chrome. Every `dev:chrome` run uses a fresh throwaway profile, so a locale change always takes effect.

#### Debugging in VS Code

`npm run dev:chrome` launches Chrome with the DevTools remote debugging port enabled on `localhost:9222`.

Press `F5` with one of these configs selected:

1. **Debug Extension in Dev Chrome** for content-script debugging on normal `http` and `https` pages
2. **Debug Options Page in Dev Chrome** for the extension settings page
3. **Debug Popup Converter in Dev Chrome** for the popup converter window

Stopping any of those debug sessions from VS Code also shuts down the matching Chrome/dev task. (If VS Code keeps auto-attaching to `scripts/dev.mjs`, set the terminal's **Auto Attach** to **Only With Flag** — it only targets the Node launcher, not Chrome.)

### Releasing

See [RELEASING.md](RELEASING.md) for the release checklist. Building the Firefox add-on for AMO source review is documented in [AMO-SOURCE-SUBMISSION.md](AMO-SOURCE-SUBMISSION.md).

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

Contributions are welcome — please open an issue or pull request on [GitHub](https://github.com/vmcnabb/korean-ime). It's worth discussing your idea first to make sure it fits the direction of the project. `master` is protected, so all changes go through a pull request.

## License

[MIT](LICENSE)
