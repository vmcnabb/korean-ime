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

### Build

| Command | Description |
|---|---|
| `npm run build` | Production build to `/dist` (type check + lint + bundle) |
| `npm run build-dev` | Development build to `/dist-dev` (no optimisation) |
| `npm start` | Watch mode (to `/dist-dev`) — rebuilds on file changes |
| `npm run dev` | Watch + launch Chrome (persistent dev profile) on a test page; load unpacked once |
| `npm run check` | Type-check without emitting output |
| `npm run lint` | Lint with ESLint (`npm run lint:fix` to auto-fix) |
| `npm test` | Run unit tests |
| `npm run package` | Build and zip `dist/` into `korean-ime-<version>.zip` for the store |

The production build output goes to `/dist` (dev builds go to `/dist-dev`, kept separate so they can't be shipped by accident) and can be loaded directly as an unpacked extension:
1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `/dist` folder

#### Enabling the Word for the Web adapter

The Word for the Web adapter is off by default. To enable it for a dev session:

```sh
npm run dev -- --enable-word
```

This sets the `KIME_ENABLE_WORD` build flag (which Parcel inlines). For other builds, set the env var directly, e.g. `KIME_ENABLE_WORD=true npm run build-dev`.

#### Debugging in VS Code

`npm run dev` launches Chrome with the DevTools remote debugging port enabled on `localhost:9222`.

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

## Contributing

Contributions are welcome — please open an issue or pull request on [GitHub](https://github.com/vmcnabb/korean-ime). It's worth discussing your idea first to make sure it fits the direction of the project.

## License

MIT
