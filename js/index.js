// CODE WAS COMMENTED WITH BLACKBOX.AI (as i saw it commented everything right, but i'm not sure)

import WebSocketManager from "./socket.js";

let websocketUrl = "127.0.0.1:24050";
const socket = new WebSocketManager(websocketUrl);

// Cache for key presses
const cache = {
    K1: false,
    K2: false,
    M1: false,
    M2: false,
};

// Cache for BPM (beats per minute)
const bpmCache = {
    K1: { date: Date.now(), timeout: null },
    K2: { date: Date.now(), timeout: null },
    M1: { date: Date.now(), timeout: null },
    M2: { date: Date.now(), timeout: null },
};

// Settings
let noteSpeed;

// Get references to the HTML elements for each key
let keys = {
    k1: document.getElementById("counterK1"),
    k2: document.getElementById("counterK2"),
    m1: document.getElementById("counterM1"),
    m2: document.getElementById("counterM2"),
};

socket.sendCommand("getSettings", encodeURI(window.COUNTER_PATH));
socket.commands((data) => {
    try {
        const { command, message } = data;
        // get updates for "getSettings" command
        if (command == "getSettings") {
            noteSpeed = parseInt(message.noteSpeed);

            document.body.style.setProperty("--gradientColor1", message.gradientColor1);
            document.body.style.setProperty("--gradientColor2", message.gradientColor2);
            document.body.style.setProperty("--dashedOutlineColor", message.dashedOutlineColor);
            document.body.style.setProperty("--activeKeyColor", message.activeKeyColor);
            document.body.style.setProperty("--noteColor", message.noteColor);
            document.body.style.setProperty("--transitionDuration", message.transitionDuration);
            document.body.style.setProperty("--transitionTimingFunction",message.transitionTimingFunction,);
            document.body.style.setProperty("--trackWidth", message.trackWidth);
            document.body.style.setProperty("--trackHeight", message.trackHeight);
            document.body.style.setProperty("--centerLines", +message.centerLines);
            document.body.style.setProperty("--bmcLogo", +message.bmcLogo);

            const mainContainerRects = document
                .getElementById("mainContainer")
                .getBoundingClientRect();

            if (message.overlayDirection == "To top") {
                document.body.style.setProperty("--pressCounterAlign", "center");
                document.body.style.setProperty("--pressCounterRotate", "270deg");
                document.body.style.setProperty("--overlayRotate", "90deg");
                document.body.style.setProperty("--overlayTranslate", `0px, -${mainContainerRects.height}px`,);
            } else if (message.overlayDirection == "To right") {
                document.body.style.setProperty("--pressCounterAlign", "flex-start");
                document.body.style.setProperty("--pressCounterRotate", "180deg");
                document.body.style.setProperty("--overlayRotate", "180deg");
                document.body.style.setProperty("--overlayTranslate", `-${mainContainerRects.width}px, -${mainContainerRects.height}px`,
                );
            } else if (message.overlayDirection == "To bottom") {
                document.body.style.setProperty("--pressCounterAlign", "center");
                document.body.style.setProperty("--pressCounterRotate", "90deg");
                document.body.style.setProperty("--overlayRotate", "270deg");
                document.body.style.setProperty("--overlayTranslate", `-${mainContainerRects.width}px, 0px`,
                );
            } else {
                document.body.style.setProperty("--pressCounterAlign", "flex-end");
                document.body.style.setProperty("--pressCounterRotate", "0deg");
                document.body.style.setProperty("--overlayRotate", "0deg");
                document.body.style.setProperty("--overlayTranslate", "0, 0");
            }

            document.getElementById("trackK1").parentElement.dataset.mode = message.visibilityK1;
            document.getElementById("trackK2").parentElement.dataset.mode = message.visibilityK2;
            document.getElementById("trackM1").parentElement.dataset.mode = message.visibilityM1;
            document.getElementById("trackM2").parentElement.dataset.mode = message.visibilityM2;
        }
    } catch (error) {
        console.log(error);
    }
});

socket.api_v2_precise((data) => {
    // Loop through each key in the event data
    for (const key in data.keys) {
        if (Object.prototype.hasOwnProperty.call(data.keys, key)) {
            let _key = key.toUpperCase();

            const isPressed = data.keys[key].isPressed;
            const count = data.keys[key].count;

            // Dev section: display key state and count
            document.getElementById(`${key}Dev`).innerHTML = `${_key}: ${isPressed} (${count})`;

            try {
                if (isPressed) {
                    // Create a new odometer (counter) for the key
                    const counter = new Odometer({
                        el: keys[key],
                        value: 0,
                    });
                    counter.update(count);

                    // Add active class to the key element
                    document.getElementById(_key).classList.add("active");

                    if (document.getElementById(_key).parentElement.dataset.mode != "Hide") {
                        document.getElementById(_key).parentElement.classList.add("show");
                    }

                    if (!cache[_key]) {
                        // Create a new note element
                        const note = document.createElement("div");
                        note.classList.add("note");
                        note.style.width = "0px";
                        note.style.marginRight = "0px";

                        // Add the note to the track
                        document.getElementById(`track${_key}`).prepend(note);

                        // Update the BPM display
                        document.getElementById(`bpm${_key}`).innerHTML =
                            `${Math.round((60 / (Date.now() - bpmCache[_key].date)) * 500)}<span class="fs-small">bpm</span>`;
                        bpmCache[_key].date = Date.now();

                        // Clear the BPM timeout and set a new one
                        clearTimeout(bpmCache[_key].timeout);
                        bpmCache[_key].timeout = setTimeout(() => {
                            document.getElementById(`bpm${_key}`).innerHTML =
                                `0<span class="fs-small fw-regular">bpm</span>`;
                        }, 1000);
                    } else {
                        // Update the existing note element
                        const notes = document
                            .getElementById(`track${_key}`)
                            .getElementsByClassName("note");
                        const noteWidth = notes[0].style.width;
                        notes[0].style.width =
                            parseInt(noteWidth.slice(0, noteWidth.indexOf("px"))) +
                            noteSpeed +
                            "px";

                        // Prevent the note from sliding
                        notes[0].style.marginRight = "0px";
                    }

                    cache[_key] = true;
                } else {
                    // Remove the active class from the key element
                    document.getElementById(_key).classList.remove("active");
                    cache[_key] = false;
                }

                // Move all notes on the track
                const notes = document
                    .getElementById(`track${_key}`)
                    .getElementsByClassName("note");

                for (let i = 0; i < notes.length; i++) {
                    const noteMargin = notes[i].style.marginRight;

                    // Remove the note if it is outside of the track
                    if (
                        parseInt(noteMargin.slice(0, noteMargin.indexOf("px"))) >=
                        Math.max(
                            document.getElementById(`trackK1`).getBoundingClientRect().width,
                            document.getElementById(`trackK1`).getBoundingClientRect().height,
                        )
                    ) {
                        notes[i].remove();
                    }

                    notes[i].style.marginRight =
                        parseInt(noteMargin.slice(0, noteMargin.indexOf("px"))) + noteSpeed + "px";
                }
            } catch (error) {}
        }
    }
});

socket.api_v2((data) => {
    // Dev section: display game state
    gameState.innerText = `Game state: ${data.state.number} | ${data.state.name}`;

    if (data.state.number != 2) {
        // Hide the main container if the game state is not 2
        document.getElementById("mainContainer").style.opacity = 0;

        // Hide each key container with a delay
        Array.from(document.getElementsByClassName("key-container")).forEach(async (element, i) => {
            setTimeout(() => {
                element.classList.remove("show");
            }, 50 * i);
            element
                .querySelector("div")
                .querySelector("div.press-counter")
                .querySelector("span").innerHTML = 0;
        });
    } else {
        // Show the main container if the game state is 2
        document.getElementById("mainContainer").style.opacity = 1;

        Array.from(document.getElementsByClassName("key-container")).forEach(async (element, i) => {
            if (element.dataset.mode == "Show") {
                setTimeout(() => {
                    element.classList.add("show");
                }, 50 * i);
            }
        });
    }
});
