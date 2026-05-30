# Korean IME Chrome Extension

## Introduction

Allows typing Hangul in Chrome without a Korean IME installed at the OS level. Useful for people who want to type Korean on a computer where they don't have rights to install the Microsoft IME.

[Install Korean IME from the Chrome Web Store](https://chromewebstore.google.com/detail/korean-ime/cimmbifnciobjhchpimjekibbndgmkfk)

## Features

### Hangul typing
* Toggle between Hangul and Latin input by clicking the extension icon or pressing the right-hand **Alt** key.
* Works in standard text inputs, textareas, `contenteditable` elements, Google Docs, Word for the Web, and CKEditor.
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
| `npm run build` | Production build (type check + lint + bundle) |
| `npm run build-dev` | Development build (no optimisation) |
| `npm start` | Watch mode — rebuilds on file changes |
| `npm run check` | Type-check without emitting output |
| `npm run lint` | Lint with ESLint (`npm run lint:fix` to auto-fix) |
| `npm test` | Run unit tests |
| `npm run package` | Build and zip `dist/` into `korean-ime-<version>.zip` for the store |

The output goes to `/dist` and can be loaded directly as an unpacked extension:
1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `/dist` folder

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
