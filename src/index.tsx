import React, { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { mixColor } from "alt1";
import ChatBoxReader from "alt1/chatbox";
import { createRoot } from "react-dom/client";
import { displayDetectionMessage, alt1 } from "./helpers";
import {
  detectKillStart,
  detectMinionDeath,
} from "./textDetection";
import useMinionState from "./useMinionState";
import useSettings from "./useSettings";
import LettersDisplay from "./layouts/lettersDisplay";
import useEventLogState from "./useEventLogState";
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
  const reader = new ChatBoxReader();

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
  };

  return reader;
};

const MANUAL_COOLDOWN_SEC = 0;   // clicking Reset button
const TIMER_COOLDOWN_SEC = 0;    // auto boundary reset
const NATURAL_COOLDOWN_SEC = 22; // 5th-mechanic hard reset

const secondsForPoolToPop = 22;
const poolReminderSeconds = [3, 2, 1];

displayDetectionMessage("Better AOD starting", 5000);

// --- timestamp parsing ---
const tsToSec = (text: string): number | null => {
  const m = text.match(/\[(\d{2}):(\d{2}):(\d{2})\]/);
  if (!m) return null;
  const h = +m[1], mi = +m[2], s = +m[3];
  return h * 3600 + mi * 60 + s;
};

// tiny stable hash (FNV-1a)
const hash = (s: string) => {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
};

// --- batch-change detection (optional debug) ---
let __lastBatchHash = "";

// --- NEW: watermark across ticks ---
// last fully processed timestamp (seconds since midnight)
let __lastSec = -Infinity;
// for that last second, which line contents have we already processed
let __seenThisSec = new Set<string>();

function App() {
  const [infoWindow, setInfoWindow] = useState<Window | null>(null);
  const showInfo = () => {
    const newWindow = window.open("", "Info", "width=350,height=500");
    if (newWindow) {
      if (newWindow.document.getElementById("root") === null) {
        newWindow.document.write(`<div id="root" style="height: 100%; width: 100%;"></div>`);
      }
      setInfoWindow(newWindow);
    }
  };

  const [settingsWindow, setSettingsWindow] = useState<Window | null>(null);
  const showSettings = () => {
    const newWindow = window.open("", "Settings", "width=350,height=500");
    if (newWindow) {
      if (newWindow.document.getElementById("root") === null) {
        newWindow.document.write(`<div id="root" style="height: 100%; width: 100%"></div>`);
      }
      setSettingsWindow(newWindow);
    }
  };

  const [logWindow, setLogWindow] = useState<Window | null>(null);
  const showLog = () => {
    const newWindow = window.open("", "Log", "width=350,height=500");
    if (newWindow) {
      if (newWindow.document.getElementById("root") === null) {
        newWindow.document.write(`<div id="root" style="height: 100%; width: 100%"></div>`);
      }
      setLogWindow(newWindow);
    }
  };

  const [calculatorWindow, setcalculatorWindow] = useState<Window | null>(null);
  const showcalculator = () => {
    const newWindow = window.open("", "calculator", "width=350,height=500");
    if (newWindow) {
      if (newWindow.document.getElementById("root") === null) {
        newWindow.document.write(`<div id="root" style="height: 100%; width: 100%"></div>`);
      }
      setcalculatorWindow(newWindow);
    }
  };

  const readerRef = useRef(createNewReader());
  const [state, dispatch] = useMinionState();
  const [log, dispatchLog] = useEventLogState();
  const [settings, settingsDispatch] = useSettings();

  const [windowSize, setWindowSize] = useState({ height: window.innerHeight, width: window.innerWidth });
  const [elementSize, setElementSize] = useState(Math.min(window.innerWidth, window.innerHeight));

  window.onresize = () => {
    setWindowSize({ height: window.innerHeight, width: window.innerWidth });
    setElementSize(Math.min(window.innerWidth, window.innerHeight));
  };

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
          // dbg("scan/no-change");
        }

        // Enrich lines with parsed timestamps and sort oldest → newest
        const enriched = chatLines
          .map((l, i) => ({ line: l, sec: tsToSec(l.text), idx: i }))
          .sort((a, b) => (a.sec ?? Infinity) - (b.sec ?? Infinity) || a.idx - b.idx);

        // Compute newest timestamp visible in this snapshot (for diagnostics)
        const newestSec = enriched.reduce((mx, e) => e.sec != null ? Math.max(mx, e.sec) : mx, -Infinity);
        if (isFinite(newestSec)) {
          dbg("scan/visible", { newestSec, lastSec: __lastSec, behindBy: newestSec - __lastSec });
        }

        // --- NEW: accept lines newer than watermark, or new content in same second ---
        const newLines: typeof enriched = [];
        for (const e of enriched) {
          if (e.sec == null) continue;

          if (e.sec > __lastSec) {
            // moved to a newer second → advance watermark and clear per-second dedupe
            __lastSec = e.sec;
            __seenThisSec.clear();
          } else if (e.sec < __lastSec) {
            // older than watermark → skip
            continue;
          }
          // here: e.sec === __lastSec (or we just advanced to it)
          const key = hash(e.line.text); // include color/channel if you want even stronger keys
          if (__seenThisSec.has(key)) continue;

          __seenThisSec.add(key);
          newLines.push(e);
        }

        if (newLines.length === 0) {
          return; // nothing new by timestamp/content; bail
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

          // 👇👇👇 ONLY CHANGE: Flurry bypasses the gate
          // Peek detection once so we can know if it's Flurry without double work.
          const peek = detectMinionDeath(line.text);
          const isFlurry = (peek?.mechanic === "Flurry") || /flurry/i.test(line.text);

          // Gate with Flurry bypass
          const gate = isFlurry
            ? { allow: true, reason: "flurry-bypass" }
            : shouldProcessLineWithReason(line.text);

          if (!gate.allow) {
            dbg("gate/BLOCK", gate);     // { lineTs, lastSeenSec, watermarkSec, cooldownUntilSec, reason }
            continue;
          }

           if (isFlurry) {
            dbg("gate/BYPASS", { text: line.text });
          }
          
          // Only eligible lines reach detection (reuse peek for Flurry)
          const minion = isFlurry ? peek : detectMinionDeath(line.text);
          // 👆👆👆 END ONLY CHANGE

          if (minion) {
            dbg("pipeline/DETECTED", { add: `${minion.initial}/${minion.mechanic}`, text: line.text });
            dispatch({ type: "addMinion", minion });
          }

          // Note: (__lastSec, __seenThisSec) are already advanced above when we admitted the line.
        }
      } catch (error) {
        console.log(error);
        displayDetectionMessage("An error has occured", 600);
      }
    };

    const tickInterval = setInterval(tick, 600);
    return () => clearInterval(tickInterval);
  }, [settings, dispatch, dispatchLog]);

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
        width: 260,
        height: 260,
        minWidth: 260,
        minHeight: 260,
        resize: "both",       // still resizable if you want bigger
        overflow: "hidden",   // no scrollbars
        backgroundColor: "#04121b",
        backgroundImage: "url(./background.png)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        borderRadius: 8,
        border: "1px solid #2b2b2b",
        boxSizing: "border-box", // 👈 ensures border doesn’t add to 260px
      }}
    >
      <LettersDisplay
        windowSize={windowSize}
        state={state}
        onReset={(reason?: "manual" | "timer" | "natural") => {
          dispatch({ type: "clear" });

          const cd =
            reason === "manual" ? MANUAL_COOLDOWN_SEC :
            reason === "timer"  ? TIMER_COOLDOWN_SEC  :
                                  NATURAL_COOLDOWN_SEC; // default to natural

          markResetWithCooldown(cd);
          dbg("reset/applied", { reason, cooldown: cd });
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
);

const container = document.getElementById("root");
const root = createRoot(container!);
root.render(alt1 ? <App /> : notFound);

// Remove CodeSandbox popup
const clearPopupInterval = setInterval(() => {
  document.body.querySelectorAll("iframe").forEach((iframe) => {
    if (iframe.id.startsWith("sb__open-sandbox")) {
      const node = document.createElement("div");
      node.style.setProperty("display", "none", "important");
      node.id = iframe.id;
      document.getElementById(iframe.id)?.remove();
      document.body.appendChild(node);
      clearInterval(clearPopupInterval);
    }
  });
}, 250);
