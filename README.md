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
* **Not supported:** Google Docs — moved to a canvas/EditContext-based that doesn't accept programmatic composition. The extension stays out of the way on those rather than mis-typing. 
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

The project is built with [WXT](https://wxt.dev) (on Vite). Everything is
Manifest V3 — both browsers, dev and release.

| Command | Description |
|---|---|
| `npm run dev:chrome` / `dev:firefox` | WXT dev server + launch the browser on a throwaway profile with HMR, opening the localhost test page. Session flags after `--`: `--enable-hanja`, `--locale=<code>`, `--dark`/`--light` |
| `npm run build:chrome` / `build:firefox` | Production build to `.output/<target>` — `.output/chrome-mv3` / `.output/firefox-mv3` (run `validate` separately for gates) |
| `npm run zip:chrome` / `zip:firefox` | Build + zip for the Web Store / AMO |
| `npm run validate` | Full gate: message keys → type-check → lint → translations → tests |
| `npm run lint` | Lint with ESLint (`npm run lint:fix` to auto-fix) |
| `npm test` | Run unit tests |
| `npm run package:chrome` / `package:firefox` | `validate` then `zip:<target>` |

Production builds output to `.output/<target>` (dev builds to
`.output/<target>-dev`, kept separate). Load as an unpacked extension:
1. **Chrome:** `chrome://extensions` → **Developer mode** → **Load unpacked** → `.output/chrome-mv3`
2. **Firefox:** `about:debugging` → **This Firefox** → **Load Temporary Add-on** → `.output/firefox-mv3/manifest.json`

#### Firefox development

`npm run dev:firefox` launches Firefox (MV3) via WXT/[`web-ext`](https://github.com/mozilla/web-ext) with the extension as a temporary add-on on a throwaway profile, with HMR — no manual loading. **Content-script injection in dev needs Firefox 147+** (WXT's MV3 dev mode depends on a Firefox CSP fix from 147); on an older Firefox, use `npm run build:firefox` + `about:debugging`. Set `FIREFOX_PATH` if Firefox isn't found automatically. The `--locale` flag below works the same as for `dev:chrome`.

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

The dev server (the **Start Dev Chrome** task) keeps running independently — stop it with `Ctrl+C` in its terminal when you're done.

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
full type-check (`tsc --noEmit`). Bypass with `git commit --no-verify` if you
ever need to.

## Contributing

Contributions are welcome — please open an issue on [GitHub](https://github.com/vmcnabb/korean-ime) first, then send a pull request for the agreed change. It's worth discussing your idea first to make sure it fits the direction of the project.

## License

[MIT](LICENSE)
