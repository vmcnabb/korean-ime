// call afterLoad when document is idle
document.addEventListener("DOMContentLoaded", onLoad);

function onLoad() {
    const inputDiv = document.getElementById("input");

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
        "selectstart"
    ];

    let silence = true;
    let lastInnerText = "";

    // add event listeners to silence checkbox
    document.getElementById("silence").addEventListener("change", e => {
        silence = e.target.checked;
    });

    // add event listeners to input div
    inputEvents.forEach(eventKey => {
        document.addEventListener(eventKey, e => {
            if (silence) return;

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

            console.log(eventKey, e);
        })
    });
}
