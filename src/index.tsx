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
import { markResetWithCooldown } from "./watermark";
import { dbg, nextSeq } from "./logger";
import { shouldProcessLineWithReason } from "./watermark";

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

// --- timing & diff helpers (module-scope, persist across ticks) ---
let __lastProcessedSec = -Infinity;   // newest [HH:MM:SS] we've processed
let __lastBatchHash = "";             // quick diff of visible chat text

const tsToSec = (text: string): number | null => {
    const m = text.match(/\[(\d{2}):(\d{2}):(\d{2})\]/);
    if (!m) return null;
    const h = +m[1], mi = +m[2], s = +m[3];
    return h * 3600 + mi * 60 + s;
};

// tiny stable hash for the whole chat snapshot
const hash = (s: string) => {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16);
};

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
                let chatLines = readerRef.current.read();

                if (chatLines === null) {
                    // try to relocate the chat box as you already do
                    const findResult = readerRef.current.find();

                    if (readerRef.current.pos) {
                        alt1.overLayRect(
                            mixColor(45, 186, 21),
                            readerRef.current.pos.mainbox.rect.x,
                            readerRef.current.pos.mainbox.rect.y,
                            readerRef.current.pos.mainbox.rect.width,
                            readerRef.current.pos.mainbox.rect.height,
                            1000,
                            1
                        );
                    }

                    if (findResult === null) {
                        displayDetectionMessage(
                            "Can't detect chatbox\nPlease press enter so chatbox is highlighted for detection",
                            600,
                            30
                        );
                        return;
                    }

                    chatLines = readerRef.current.read() || [];
                }

                // --- batch snapshot & change detection ---
                const batchStr = chatLines.map(l => l.text).join("\n");
                const batchHash = hash(batchStr);

                if (batchHash !== __lastBatchHash) {
                    dbg("scan/change", { count: chatLines.length, hash: batchHash });
                    __lastBatchHash = batchHash;
                } else {
                    // nothing visibly changed; keep it quiet
                    // dbg("scan/no-change");
                }

                // Enrich lines with parsed timestamps and sort oldest → newest
                const enriched = chatLines
                    .map(l => ({ line: l, sec: tsToSec(l.text) }))
                    .sort((a, b) => (a.sec ?? Infinity) - (b.sec ?? Infinity));

                // Compute newest timestamp visible in this snapshot (for diagnostics)
                const newestSec = enriched.reduce((mx, e) => e.sec != null ? Math.max(mx, e.sec) : mx, -Infinity);
                if (isFinite(newestSec)) {
                    dbg("scan/visible", { newestSec, lastProcessedSec: __lastProcessedSec, behindBy: newestSec - __lastProcessedSec });
                }

                // Only process lines strictly newer than what we've already processed.
                // This removes the "only updates when the next line arrives" symptom if the reader dumps backlogs.
                const newLines = enriched.filter(e => e.sec != null && e.sec > __lastProcessedSec);

                if (newLines.length === 0) {
                    return; // nothing new by timestamp; bail
                }

                dbg("scan/new-lines", newLines.map(e => e.line.text));

                // Process in chronological order so we never backfill out-of-order
                for (const { line, sec } of newLines) {
                    // latency: difference between chat's HH:MM:SS and now (helps if you suspect reader lag)
                    if (sec != null) {
                        const now = new Date();
                        const nowSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
                        dbg("latency/line", { lineTs: sec, procTs: nowSec, deltaSec: nowSec - sec });
                    }

                    // Start-of-kill as you already had
                    if (detectKillStart(line.text)) {
                        displayDetectionMessage(line.text, 2500);
                        dispatch({ type: "clear" });
                    }

                    // Minions (your flow, unchanged)
                    const evt = nextSeq();

                    // inside your tick loop, before detectMinionDeath:
const gate = shouldProcessLineWithReason(line.text);
if (!gate.allow) {
  dbg("gate/BLOCK", gate);     // { lineTs, lastSeenSec, watermarkSec, cooldownUntilSec, reason }
  continue;
}

// only eligible lines reach detection:
const minion = detectMinionDeath(line.text);
if (minion) {
  dbg("pipeline/DETECTED", { add: `${minion.initial}/${minion.mechanic}`, text: line.text });
  dispatch({ type: "addMinion", minion });
}

                    // advance the pointer so earlier lines never retrigger
                    if (sec != null && sec > __lastProcessedSec) {
                        __lastProcessedSec = sec;
                        dbg("scan/advance-lastProcessedSec", __lastProcessedSec);
                    }
                }
            } catch (error) {
                console.log(error);
                displayDetectionMessage("An error has occured", 600);
            }
        };

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
                        markResetWithCooldown(10);          // ⬅️ enforce 30s gap before next cycle can start
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
