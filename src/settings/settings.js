const availableOptions = {
    defaultLayout: ["qwerty", "hangul", "previous"],
    switchKey: ["rightAlt", "ctrlSpace"]
}

const defaultOptions = {
    defaultLayout: "qwerty",
    switchKey: "rightAlt"
}

// Saves options to chrome.storage.sync.
function save_options() {
    var color = document.getElementById('color').value;
    var likesColor = document.getElementById('like').checked;

    chrome.storage.sync.set(
        {
            favoriteColor: color,
            likesColor: likesColor
        },
        function() {
        // Update status to let user know options were saved.
            var status = document.getElementById('status');
            status.textContent = 'Options saved.';
            setTimeout(function() {
                status.textContent = '';
            }, 750);
        });
}

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
function restore_options() {
    // Use default value color = 'red' and likesColor = true.
    chrome.storage.sync.get({
        favoriteColor: 'red',
        likesColor: true
    },
    function(items) {
        document.getElementById('color').value = items.favoriteColor;
        document.getElementById('like').checked = items.likesColor;
    });
}

document.addEventListener('DOMContentLoaded', domLoaded);

const validShortcutKeys = [
    "KeyA", "KeyB", "KeyC", "KeyD", "KeyE", "KeyF", "KeyG", "KeyH", "KeyI",
    "KeyJ", "KeyK", "KeyL", "KeyM", "KeyN", "KeyO", "KeyP", "KeyQ", "KeyR",
    "KeyS", "KeyT", "KeyU", "KeyV", "KeyW", "KeyX", "KeyY", "KeyZ", "Comma",
    "Period", "Slash", "Semicolon", "Quote", "BracketLeft", "BracketLeft",
    "Backslash", "Digit0", "Digit1", "Digit2", "Digit3", "Digit4", "Digit5",
    "Digit6", "Digit7", "Digit8", "Digit9", "Space"
];

function domLoaded () {
    let test = document.getElementById("test");
    let shortcut = "";

    let modifiers = {
        ctrl: false,
        alt: false,
        shift: false
    };
    let lastChar = "";
    let lastKey = "";

    let updateModifiers = ev => {
        modifiers.ctrl = ev.ctrlKey;
        modifiers.alt = ev.altKey;
        modifiers.shift = ev.shiftKey;
    };

    let getModifierString = () => {
        let keyString = "";
        let addKey = k => keyString = keyString ? (keyString + "+" + k) : k;
    
        if (modifiers.ctrl) addKey("Ctrl");
        if (modifiers.alt) addKey("Alt");
        if (modifiers.shift) addKey("Shift");
        
        return keyString;
    };

    test.addEventListener(
        "keydown",
        ev => {
            updateModifiers(ev);
            let modifierString = getModifierString();

            console.log(ev);

            if (!(modifiers.alt || modifiers.ctrl)) {
                test.value = shortcut;

            } else if (validShortcutKeys.indexOf(ev.code) >= 0) {
                lastKey = ev.code;
                lastChar = ev.key;
                test.value = shortcut = modifierString + "+" + lastChar;

            } else {

                test.value = modifierString + "+";
            }

            ev.preventDefault();
        },
        true
    );

    test.addEventListener(
        "keyup",
        ev => {
            updateModifiers(ev);
            let modifierString = getModifierString();

            if (!(modifiers.alt || modifiers.ctrl)) {
                test.value = shortcut;

            } else if (lastKey === ev.code) {
                return;

            } else {
                test.value = modifierString + "+";
            }

            ev.preventDefault();
        },
        true
    );
}