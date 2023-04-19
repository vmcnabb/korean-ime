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
        "compositionend"
    ];

    // add event listeners to input div
    inputEvents.forEach(event => {
        inputDiv.addEventListener(event, e => {
            console.log(event);
            console.log(e);
        })
    });
}
