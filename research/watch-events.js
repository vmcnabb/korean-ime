// call afterLoad when document is idle
document.addEventListener("DOMContentLoaded", onLoad);

function onLoad() {
    const inputDiv = document.getElementById("divContentEditable");
    const inputInput = document.getElementById("input");

    // array of all input events
    const inputEvents = [
        "input",
        "change",
        "beforeinput",
        "drop",
        "keydown",
        "keyup",
        "keypress",
        "compositionstart",
        "compositionupdate",
        "compositionend",
        "selectionchange",
        "selectstart",
        "blur",
    ];

    let silence = false;
    let silenceDocument = false;
    let silenceDiv = true;
    let silenceInput = true;

    let lastInnerText = "";

    // add event listeners to silence checkbox
    document.getElementById("silence").addEventListener("change", e => {
        silence = e.target.checked;
    });

    document.getElementById("silence-document").addEventListener("change", e => {
        silenceDocument = e.target.checked;
    });

    document.getElementById("silence-div").addEventListener("change", e => {
        silenceDiv = e.target.checked;
    });

    document.getElementById("silence-input").addEventListener("change", e => {
        silenceInput = e.target.checked;
    });

    const logEventListener = (e) => {
        let innerText = inputDiv.innerText;
        if (innerText !== lastInnerText) {
            lastInnerText = innerText;
            console.log("innerText: ", innerText);
        }

        if (e.type === "selectionchange") {
            const selection = document.getSelection();
            console.log("selection: ", selection);
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                console.log("range: ", range);
            }
        }

        console.log(e.type, e);
    };

    // add event listeners
    inputEvents.forEach(eventKey => {
        document.addEventListener(eventKey, e => {
            if (silence || silenceDocument) return;

            logEventListener(e);
        });

        inputDiv.addEventListener(eventKey, e => {
            if (silence || silenceDiv) return;

            logEventListener(e);
        });

        inputInput.addEventListener(eventKey, e => {
            if (silence || silenceInput) return;

            logEventListener(e);
        });
    });
}
