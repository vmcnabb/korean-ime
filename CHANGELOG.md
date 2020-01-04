Download the latest release at the Chrome Web Store:
[https://chrome.google.com/webstore/detail/korean-ime/cimmbifnciobjhchpimjekibbndgmkfk?hl=en-GB]

# 1.2.0
2020-01-04
### Features
* Added support for Google Docs

# 1.1.7
2018-01-20
### Fixes
* Shift+Backspace wasn't deleting the last jamo from the preceding character
### Features
* Added British English translation
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
* Popup converter now romanises as you type
* Popup converter looks prettier
* You can now choose between romanising inline or romanising into a popup window, when right-clicking selected text in an editor

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
* Romanisation now more closely follows romanisation rules (issue #6)

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
* UI for the popup romanisation tool is cleaner.
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
