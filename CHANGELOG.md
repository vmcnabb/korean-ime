Download the latest release at the Chrome Web Store:
[https://chrome.google.com/webstore/detail/korean-ime/cimmbifnciobjhchpimjekibbndgmkfk?hl=en-GB]

# 1.1.1
### Release Date
2018-01-16
### Fixes
* Inline romanization in [contenteditable]'s (e.g. Gmail Compose) was replacing the selected text instead of inserting after.
### Notes
Upgraded codebase to use ES6 modules to make moduralization easier (and give me better intellisense).

# 1.1.0
### Release Date
2018-01-14
### Fixes
* Fix inline romanization.
### Features
* Allow user to remove last jamo from an already entered Hangeul block by typing Shift+Backspace.
* UI for the popup romanization tool is cleaner.
### Notes
This release included major structural changes that should make it easier to implement features and fix certain types of bug in future.

# 1.0.1
### Release Date
2018-01-13
### Fixes
* Allow hangeul to be edited in various places where it wouldn't before, including Gmail Chat.
* Prevent Gmail deselecting the morpheme block when using Hangeul as the first character in an email.
### Features
* Allow user to toggle between Latin/Hangeul input by using the right hand Alt, or Alt-Gr key.
