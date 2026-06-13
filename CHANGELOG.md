Install the latest release from the Chrome Web Store:
[https://chrome.google.com/webstore/detail/korean-ime/cimmbifnciobjhchpimjekibbndgmkfk?hl=en-GB]

# 2.7.0
2026-06-13

This release lets you choose your own Hangul/Latin toggle key and adds Japanese
and Portuguese localizations.

### Features
* The Hangul/Latin toggle key is now configurable — set your own key or combination in the options page, or turn it off entirely. The default is still Right Alt, and the choice is saved on your computer.
* Added Japanese localization
* Added Portuguese localization (Brazilian and European)

### Fixes
* Fixed a Firefox error ("element.matches is not a function") when focusing certain elements
* Fixed a double-character deletion in CKEditor when editing via the on-screen keyboard

### Internal
* Polished and translated the Chrome/Firefox store listing descriptions
* Removed dead code and tightened typing in the composition adapters
* `@trace` call-stack entries now link back to the TypeScript source
* Updated development dependencies

# 2.6.0
2026-06-10

This release adds Microsoft Word for the Web support and a round of on-screen
keyboard polish.

### Features
* Added support for typing Hangul in Microsoft Word for the Web

### Fixes
* Composition now dispatches proper composition events to inputs and textareas, improving compatibility with sites that listen for them
* On-screen keyboard header control glyphs are now centered
* The on-screen keyboard shows a grab/grabbing cursor while it is being dragged
* Resizing the on-screen keyboard is clamped so it can no longer be grown off-screen
* The on-screen keyboard close button no longer overflows the header when collapsed (Firefox)
* The on-screen keyboard close button's hover highlight keeps the rounded corner when collapsed
* The on-screen keyboard header now has a border so it no longer blends into a black page background

### Internal
* Updated development dependencies

# 2.5.0
2026-06-07

The previous release, 2.4.0, went out for Firefox only and was not released to
Chrome. This release catches Chrome up and includes the changes below.

### Features
* Added getting started page
* Added Spanish localization
* Added controls to enable Hangul typing and physical-key handling separately
* Added an independent on-screen keyboard Han/Yong toggle while Hangul typing is off
* Added selectable on-screen keyboard layouts
* Added resizing, anchored positioning, and saved position/collapsed state for the on-screen keyboard
* Added a clickable on-screen keyboard mode indicator
* The toolbar icon _tooltip_ now reflects the current mode

### Fixes
* When pages (like google.com) set the input focus before the content script ran, IME would not be initialized for that input
* The on-screen keyboard now stays clamped to the viewport more reliably
* The on-screen keyboard follows the cursor correctly when dragging under browser zoom
* The on-screen keyboard flushes unfinished composition when focus changes or physical typing resumes
* Popup converter, contentEditable composition, and the development test page now respect dark mode

### Internal
* Improved Chrome and Firefox development launch workflows
* Added Firefox CI/build quality-of-life updates
* Refined on-screen keyboard styling and icon generation
* Updated development dependencies

# 2.4.0
2026-06-03

Firefox support is the primary reason for this release.

### Features
* Added Firefox support
* Wired up Options page
    * Runtime now respects the settings from options (before they were ignored)
    * The wording is easier to understand
    * Made it localizable and added Korean translations

### Fixes
* Pasting into the romanization dialog no longer pastes formatting
* Menus now appear more reliably
* Fixed race condition opening romanization popup

### Internal
* Improved project structure
* Fixed Vue warning

# 2.3.0
2026-05-31

This is the Manifest V3 rewrite, and the first release back on the Chrome Web
Store after the previous listing (2.x, Manifest V2) was removed when Google's
MV3 requirement took effect.

### Features
* Added on-screen keyboard
* Added support for CKEditor
* Added options page

### Removed / not supported
* **Google Docs** is no longer supported. Docs moved to a canvas + EditContext
  editor that doesn't accept programmatic composition, so the integration can't
  work; the extension now stays out of the way on Docs rather than appearing
  broken.
* **Word for the Web** is disabled by default for the same trajectory (it still
  partly works via direct DOM editing but is fragile). It can be enabled in
  development builds with the `KIME_ENABLE_WORD` flag.

### Fixes
* Typing in Hangul now works on HTML documents loaded from the local file system
* Shift+Backspace now works with non-standard Hangul such as ㅘ, ㅙ, ㅚ, ㅝ, ㅞ, ㅟ, ㅢ

### Internal
* Updated manifest to v3
* Migrated project to TypeScript
* Switched to Parcel for builds

# 2.2.2
2020-01-12

### Fixes
* Issue 21. Holding down shift was completing the current composition.

# 2.2.0
2020-01-04

Should have been 1.2.0, but after accidentally uploading a manifest to the Chrome Webstore with 2.2.0, it was
impossible to reduce the version number.

### Features
* Added support for Google Docs
### Dev
* Now use Gulp for building

# 1.1.7
2018-01-20
### Fixes
* Shift+Backspace wasn't deleting the last jamo from the preceding character
### Features
* Added British English "translation"
* Added Korean translation

# 1.1.6
2018-01-20
### Fixes
* Arrow, Home, and End keys now work when clicking somewhere else in a contenteditable while a character is being composited.

# 1.1.5
### Release Date
2018-01-20
### Features
* Implemented new key mapping system
    * Mappings now work correctly for most keyboards. Alt will switch between whatever one's base keyboard is to Korean, and back. Tested on
        * Dvorak
        * Russian
        * Spanish

# 1.1.4
### Release Date
2018-01-17
### Features
* Popup converter now romanizes as you type
* Popup converter looks prettier
* You can now choose between romanizing inline or romanizing into a popup window, when right-clicking selected text in an editor

# 1.1.3
### Release Date
2018-01-17
### Fixes
* Compound vowels and double consonants weren't working (broken since 1.1.1)

# 1.1.2
### Release Date
2018-01-17
### Fixes
* Run extension in offline mode
* Romanization now more closely follows romanization rules (issue #6)

# 1.1.1
### Release Date
2018-01-16
### Fixes
* Inline romanization in [contenteditable]'s (e.g. Gmail Compose) was replacing the selected text instead of inserting after.
### Notes
Upgraded codebase to use ES6 modules to make moduralisation easier (and give me better intellisense).

# 1.1.0
### Release Date
2018-01-14
### Fixes
* Fix inline romanization.
### Features
* Allow user to remove last jamo from an already entered Hangul block by typing Shift+Backspace.
* UI for the popup romanization tool is cleaner.
### Notes
This release included major structural changes that should make it easier to implement features and fix certain types of bug in future.

# 1.0.1
### Release Date
2018-01-13
### Fixes
* Allow hangul to be edited in various places where it wouldn't before, including Gmail Chat.
* Prevent Gmail deselecting the morpheme block when using Hangul as the first character in an email.
### Features
* Allow user to toggle between Latin/Hangul input by using the right hand Alt, or Alt-Gr key.
