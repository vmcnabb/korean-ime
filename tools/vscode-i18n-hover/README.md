# Korean IME i18n Hover

Local VS Code extension for this repo. It shows the English Chrome i18n message
when hovering over `t("message_key")` or `t('message_key')` calls in Vue,
TypeScript, and JavaScript files.

## Install

From the repo root:

```sh
npm run install-i18n-vscode
```

This packages the extension as a VSIX, installs it into VS Code, then removes
the generated VSIX file.

The extension reads `src/_locales/en/messages.json` and reloads it when the file
changes. It is editor tooling only; it does not affect the browser extension
runtime.

If hovers do not appear, run `Korean IME i18n Hover: Show Status` from the
Command Palette. It prints the workspace and loaded message catalog details to
the `Korean IME i18n Hover` output channel.

## Debug

1. Open `tools/vscode-i18n-hover/korean-ime-i18n-hover.code-workspace` in VS Code.
2. Run the `Debug i18n Hover` launch configuration from that workspace.
3. In the Extension Development Host window, open a Vue file and hover over a
   `t("...")` key.

The workspace file includes both the repo root and this extension folder, then
launches the extension with `tools/vscode-i18n-hover` as
`--extensionDevelopmentPath`. It uses a private VS Code user-data directory
under `.vscode/` so the Extension Development Host can open the repo even when
the same folder is already open in your normal VS Code window.
