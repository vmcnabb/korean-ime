# Korean IME Chrome Extension

## Introduction
The primary purpose of the project is to allow people to type Hangul in Chrome when the OS does not have a Korean IME installed.

It is primarily useful for people that want to type Korean on a computer where they don't have rights to install the Microsoft IME.

You can [install Korean IME extension from the Chrome Web Store](https://chrome.google.com/webstore/detail/korean-ime/cimmbifnciobjhchpimjekibbndgmkfk?hl=en-GB)

## Features
* Type in Hangul using the Korean keyboard layout.
  * Click the extension icon, or tap the right-hand Alt key to toggle between Hangul and Latin.
  * You can remove the last jamo from an existing character by positioning the caret just after the character and typing Shift+Backspace.
* Convert Hangul text into its Latin equivalent.
  * Select the text to convert, right click, and choose "Romanize" from the menu.

## [Change Log](CHANGELOG.md)

## Build
Korean IME uses Gulp to build. Just type `npm start build` or `npm start build-dev`.

The output goes to /dist and can be directly loaded as an unpacked extension.
