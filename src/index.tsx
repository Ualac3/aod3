import React, { useEffect, useRef, useState } from "react"
import ReactDOM from "react-dom"
import { mixColor } from "alt1"
import ChatBoxReader from "alt1/chatbox"
import { createRoot } from "react-dom/client"
import { displayDetectionMessage, alt1 } from "./helpers"
import {
    detectKillStart,
    detectMinionDeath,
} from "./textDetection"
import useMinionState from "./useMinionState"
import useSettings from "./useSettings"
import LettersDisplay from "./layouts/lettersDisplay"
import useEventLogState from "./useEventLogState"
import { shouldProcessLine } from "./watermark";
import { markResetWithCooldown } from "./watermark";

// Changes made on 5 Nov 2024 with thanks to Jhaego / Frakkefyr

// Stable version
// alt1://addapp/https://cgyi4.csb.app/appconfig.json
// https://cgyi4.csb.app/

// Dev version
// alt1://addapp/https://5tjf8.csb.app/appconfig.json
// https://5tjf8.csb.app/

const createNewReader = () => {
    const reader = new ChatBoxReader()

    reader.readargs = {
        colors: [
            mixColor(255, 160, 0), // Orange practice mode
            mixColor(45, 186, 21), // Completion time green
            mixColor(45, 184, 20), // Completion time green
            mixColor(159, 255, 159), // Clan chat green
            mixColor(255, 82, 86), // PM red
            mixColor(225, 35, 35), // Nex P3 spec text
            mixColor(235, 47, 47), // Nex P3 spec text NEW 16/7/24
            mixColor(153, 255, 153), // "Nex:" green
            mixColor(155, 48, 255), // "Nex:" purple
            mixColor(255, 0, 255), //
            mixColor(0, 255, 255), //
            mixColor(255, 0, 0), // Red
            mixColor(255, 255, 255), // White
            mixColor(127, 169, 255), // Clock blue
            mixColor(0, 153, 0), //Ariane
            mixColor(204, 51, 153) //Azzanadra
        ]
    }

    return reader
}

const secondsForPoolToPop = 22
const poolReminderSeconds = [3, 2, 1]

displayDetectionMessage("Better AOD starting", 5000)

function App() {
    const [infoWindow, setInfoWindow] = useState<Window | null>(null)
    const showInfo = () => {
        const newWindow = window.open("", "Info", "width=350,height=500")

        if (newWindow) {
            if (newWindow.document.getElementById("root") === null) {
                newWindow.document.write(`<div id="root" style="height: 100%; width: 100%;"></div>`)
            }

            setInfoWindow(newWindow)
        }
    }

    const [settingsWindow, setSettingsWindow] = useState<Window | null>(null)
    const showSettings = () => {
        const newWindow = window.open("", "Settings", "width=350,height=500")

        if (newWindow) {
            if (newWindow.document.getElementById("root") === null) {
                newWindow.document.write(`<div id="root" style="height: 100%; width: 100%;"></div>`)
            }

            setSettingsWindow(newWindow)
        }
    }

    const [logWindow, setLogWindow] = useState<Window | null>(null)
    const showLog = () => {
        const newWindow = window.open("", "Log", "width=350,height=500")

        if (newWindow) {
            if (newWindow.document.getElementById("root") === null) {
                newWindow.document.write(`<div id="root" style="height: 100%; width: 100%"></div>`)
            }

            setLogWindow(newWindow)
        }
    }

    const [calculatorWindow, setcalculatorWindow] = useState<Window | null>(null)
    const showcalculator = () => {
        const newWindow = window.open("", "calculator", "width=350,height=500")

        if (newWindow) {
            if (newWindow.document.getElementById("root") === null) {
                newWindow.document.write(`<div id="root" style="height: 100%; width: 100%"></div>`)
            }

            setcalculatorWindow(newWindow)
        }
    }

    const readerRef = useRef(createNewReader())
    const [state, dispatch] = useMinionState()
    const [log, dispatchLog] = useEventLogState()
    const [settings, settingsDispatch] = useSettings()

    const [windowSize, setWindowSize] = useState({ height: window.innerHeight, width: window.innerWidth })
    const [elementSize, setElementSize] = useState(Math.min(window.innerWidth, window.innerHeight))

    window.onresize = () => {
        setWindowSize({ height: window.innerHeight, width: window.innerWidth })
        setElementSize(Math.min(window.innerWidth, window.innerHeight))
    }

    useEffect(() => {
        const tick = () => {
            try {
                let chatLines = readerRef.current.read()

                if (chatLines === null) {
                    console.log("attempting find")

                    const findResult = readerRef.current.find()

                    if (readerRef.current.pos) {
                        alt1.overLayRect(
                            mixColor(45, 186, 21),
                            readerRef.current.pos.mainbox.rect.x,
                            readerRef.current.pos.mainbox.rect.y,
                            readerRef.current.pos.mainbox.rect.width,
                            readerRef.current.pos.mainbox.rect.height,
                            1000,
                            1
                        )
                    }

                    if (findResult === null) {
                        displayDetectionMessage(
                            "Can't detect chatbox\nPlease press enter so chatbox is highlighted for detection",
                            600,
                            30
                        )

                        return
                    }

                    chatLines = readerRef.current.read() || []
                }

                chatLines.forEach((line) => {

                    // Start of kill
                    if (detectKillStart(line.text)) {
                        displayDetectionMessage(line.text, 2500);
                        console.log("HIYA");
                        console.log("DEASDA");
                        dispatch({ type: "clear" })

                        if (settings.newKillMessage.text) {
                            // displayDetectionMessage("New kill", 5000)
                        }

                    }

                    const minion = detectMinionDeath(line.text);
                    console.log("[pipeline] detectMinionDeath returned:", minion && `${minion.initial}/${minion.mechanic}`);
                    // Minions dying
                    if (shouldProcessLine(line.text)) {
                        const minion = detectMinionDeath(line.text);
                        console.log("[pipeline] eligible line, detection returned:", minion && `${minion.initial}/${minion.mechanic}`);
                        if (minion) dispatch({ type: "addMinion", minion });
                    } else {
                        // Optional debug:
                        // console.log("[pipeline] skipped old line:", line.text);
                    }
                })
            } catch (error) {
                console.log(error)
                displayDetectionMessage("An error has occured", 600)
            }
        }

        const tickInterval = setInterval(tick, 600)

        return () => clearInterval(tickInterval)
    }, [settings, dispatch, dispatchLog])

    return (
        <div
            style={{
                display: "grid",
                placeItems: "center",
                height: "100vh",
                width: "100vw",
                background: "transparent", // no big backdrop
            }}
        >
            <div
                style={{
                    width: 300,
                    height: 300,
                    minWidth: 260,     // tweak to taste
                    minHeight: 260,
                    resize: "both",    // 👈 drag bottom/right to resize
                    overflow: "hidden",
                    backgroundColor: "#04121b",
                    backgroundImage: "url(./background.png)",
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    borderRadius: 8,
                    border: "1px solid #2b2b2b",
                }}
            >
                <LettersDisplay
                    windowSize={windowSize}
                    state={state}
                    onReset={() => {
                        dispatch({ type: "clear" });        // your existing reducer clear
                        markResetWithCooldown(30);          // ⬅️ enforce 30s gap before next cycle can start
                    }}
                />
            </div>
        </div>
    );


}

const notFound = (
    <div className="App">
        <h1>ALT1 not found</h1>
    </div>
)

const container = document.getElementById("root")

const root = createRoot(container!)
root.render(alt1 ? <App /> : notFound)

const clearPopupInterval = setInterval(() => {
    // Removes the "Open with sandbox button" as it won't scale
    // Super hate this but no other good options and this is already public
    // https://github.com/codesandbox/codesandbox-client/issues/3912
    document.body.querySelectorAll("iframe").forEach((iframe) => {
        if (iframe.id.startsWith("sb__open-sandbox")) {
            const node = document.createElement("div")
            node.style.setProperty("display", "none", "important")
            node.id = iframe.id
            document.getElementById(iframe.id)?.remove()
            document.body.appendChild(node)

            clearInterval(clearPopupInterval)
        }
    })
}, 250)
