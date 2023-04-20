// call afterLoad when document is idle
document.addEventListener("DOMContentLoaded", afterLoad);

function afterLoad() {
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

    let lastInnerText = "";

    // add event listeners to input div
    inputEvents.forEach(eventKey => {
        inputDiv.addEventListener(eventKey, e => {
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
