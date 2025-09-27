import React from "react";
import { State } from "../useMinionState";
import { dbg } from "../logger";
import { playSound, displayDetectionMessage } from "../helpers";

type ResetReason = "manual" | "timer" | "natural";

type Props = {
  windowSize: { height: number; width: number };
  state: State;
  onReset?: (reason?: ResetReason) => void; // HARD reset hook to parent
};

/** ── Timing & cue knobs ───────────────────────────────────────────── */
const LATE_START_OFFSET_SEC    = 100;  // 1:40
const LATE_WINDOW_DURATION_SEC = 10;   // 0:10 (1:40 → 1:50)
const SOUND_OFFSET_SEC         = 110;  // 1:50
const BOUNDARY_OFFSET_SEC      = 135;  // 2:10
const FINAL_GRACE_SEC          = 0;    // no grace
const SOUND_NAME: string       = "end"; // /public/resources/end.mp3

/** Watchdog for 1st mechanic miss (non-manual resets only) */
const FIRST_DETECT_TIMEOUT_SEC = 36;
const FIRST_MISS_MSG = "WARNING. 1ST MECHANIC";

/** Policy: 5th mechanic ALWAYS triggers a hard reset (natural). */
const HARD_RESET_ON_FIFTH = true;

const LettersDisplay: React.FC<Props> = ({ state, onReset }) => {
  // ----- Responsive sizing -----
  const wrapperRef = React.useRef<HTMLDivElement | null>(null);
  const [size, setSize] = React.useState({ width: 300, height: 300 });
  React.useEffect(() => {
    if (!wrapperRef.current) return;
    const el = wrapperRef.current;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const minDim = Math.min(size.width, size.height);
  const buttonFontSize = Math.round(Math.max(14, Math.min(24, minDim * 0.08)));
  const outputFontSize = Math.round(Math.max(14, Math.min(28, minDim * 0.1)));

  // ----- Mechanics/buttons state -----
  const buttons = ["Core", "Cannon", "Flurry", "Minions", "Beams"] as const;
  type ButtonLabel = (typeof buttons)[number];
  type Source = "auto" | "manual";

  const [output, setOutput] = React.useState<string[]>([]);
  const [used, setUsed] = React.useState<Record<string, boolean>>({});
  const lastAddSourceRef = React.useRef<Source | null>(null);

  const handleClick = React.useCallback((label: ButtonLabel, source: Source) => {
    setUsed((u) => {
      if (u[label]) {
        dbg("ui/add-BLOCKED", { label, source });
        return u;
      }
      dbg("ui/add", { label, source });
      lastAddSourceRef.current = source;
      setOutput((prev) => [...prev, label]);
      return { ...u, [label]: true };
    });
  }, []);

  React.useEffect(() => {
    dbg("ui/output", { output });
  }, [output]);

  // Auto-click items arriving from detection pipeline (SOURCE = "auto")
  const prevLenRef = React.useRef(0);
  React.useLayoutEffect(() => {
    const prevLen = prevLenRef.current;
    const currLen = state.order.length;

    if (currLen !== prevLen) {
      dbg("ui/order-change", {
        prevLen,
        currLen,
        newItems: state.order.slice(prevLen).map((x) => x.mechanic),
      });
    }
    if (currLen > prevLen) {
      const newItems = state.order.slice(prevLen, currLen);
      for (const m of newItems) {
        const label = m.mechanic as ButtonLabel;
        if (label && !used[label]) handleClick(label, "auto");
      }
    }
    prevLenRef.current = currLen;
  }, [state.order.length, state.order, used, handleClick]);

  // ================== FIRST-mechanic anchoring & arming ==================
  const firstAnchorMsRef = React.useRef<number | null>(null);
  const armedRef = React.useRef<boolean>(false);

  // Watchdog for missed FIRST
  const firstWatchDeadlineMsRef = React.useRef<number | null>(null);
  const firstWatchWarnedRef = React.useRef<boolean>(false);
  const [firstMissBanner, setFirstMissBanner] = React.useState(false); // sticky orange banner

  // Core-first banner
  const [coreFirstBanner, setCoreFirstBanner] = React.useState(false);

  // Dodgy flag (persists until end of current cycle; clears on ANY reset)
  const [dodgyActive, setDodgyActive] = React.useState(false);

  // Ticker
  const [nowMs, setNowMs] = React.useState<number>(Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 200);
    return () => clearInterval(id);
  }, []);

  // Elapsed since FIRST
  const elapsedFromFirstSec = React.useMemo(() => {
    const a = firstAnchorMsRef.current;
    return a == null ? 0 : (nowMs - a) / 1000;
  }, [nowMs]);

  // One-shots per cycle
  const [lateShown, setLateShown] = React.useState(false);
  const [soundPlayed, setSoundPlayed] = React.useState(false);

  // FIRST mechanic anchoring (output 0 → 1)
  const prevOutputLenForFirstRef = React.useRef(0);
  React.useEffect(() => {
    const prev = prevOutputLenForFirstRef.current;
    const curr = output.length;

    if (prev === 0 && curr === 1 && firstAnchorMsRef.current == null) {
      const firstLabel = output[0]; // the label that just anchored
      firstAnchorMsRef.current = Date.now();
      armedRef.current = true;
      setLateShown(false);
      setSoundPlayed(false);

      // Core-first banner
      setCoreFirstBanner(firstLabel === "Core");

      // FIRST arrived → cancel watchdog (banner stays until reset, as requested)
      firstWatchDeadlineMsRef.current = null;
      firstWatchWarnedRef.current = false;

      dbg("cycle/FIRST_ANCHORED", { atMs: firstAnchorMsRef.current, firstLabel });
      displayDetectionMessage("Cycle started", 2000); // keep the toast
    }

    prevOutputLenForFirstRef.current = curr;
  }, [output.length, output]);

  // Watchdog: arm after non-manual reset; fire sticky orange banner if missed
  React.useEffect(() => {
    const deadline = firstWatchDeadlineMsRef.current;
    if (deadline == null) return;            // not armed
    if (firstWatchWarnedRef.current) return; // already fired

    if (nowMs >= deadline && firstAnchorMsRef.current == null) {
      firstWatchWarnedRef.current = true;
      setFirstMissBanner(true);              // show sticky orange banner
      dbg("watchdog/first-miss", { timeoutSec: FIRST_DETECT_TIMEOUT_SEC });
    }
  }, [nowMs]);

  // Pre-final window overlay (Alt1 popup) — 10s before sound
  React.useEffect(() => {
    if (!armedRef.current) return;
    if (firstAnchorMsRef.current == null || lateShown) return;

    const start = LATE_START_OFFSET_SEC; // +1:40
    const end = LATE_START_OFFSET_SEC + LATE_WINDOW_DURATION_SEC; // +1:50

    if (elapsedFromFirstSec >= start && elapsedFromFirstSec < end) {
      const remainingMs = Math.max(1000, Math.round((end - elapsedFromFirstSec) * 1000));
      dbg("ui/pre-final/overlay", {
        at: elapsedFromFirstSec.toFixed(2),
        start,
        end,
        ms: remainingMs,
      });
      displayDetectionMessage("Final mechanic window", remainingMs);
      setLateShown(true);
    }
  }, [elapsedFromFirstSec, lateShown]);

  // Sound at +1:50
  React.useEffect(() => {
    if (!armedRef.current) return;
    if (firstAnchorMsRef.current == null || soundPlayed) return;

    if (elapsedFromFirstSec >= SOUND_OFFSET_SEC) {
      dbg("ui/pre-final/sound", {
        at: elapsedFromFirstSec.toFixed(2),
        target: SOUND_OFFSET_SEC,
        name: SOUND_NAME,
      });
      try { playSound(SOUND_NAME); } catch (e) { dbg("ui/sound-error", e); }
      setSoundPlayed(true);
    }
  }, [elapsedFromFirstSec, soundPlayed]);

  // HARD reset helper — clears timer/UI and all banners; arms watchdog for non-manual
  const hardReset = React.useCallback((reason: ResetReason) => {
    dbg(`ui/hard-reset (${reason})`);
    // Clear UI
    setOutput([]);
    setUsed({});
    // Reset cycle
    firstAnchorMsRef.current = null;
    armedRef.current = false;
    setLateShown(false);
    setSoundPlayed(false);

    // Clear ALL in-app sticky banners/flags on ANY reset
    setFirstMissBanner(false);
    setCoreFirstBanner(false);
    setDodgyActive(false); // << resets Dodgy state (and banner) on any reset

    // Arm watchdog ONLY for non-manual resets
    if (reason === "timer" || reason === "natural") {
      firstWatchWarnedRef.current = false;
      firstWatchDeadlineMsRef.current = Date.now() + FIRST_DETECT_TIMEOUT_SEC * 1000;
      dbg("watchdog/armed", { reason, timeoutSec: FIRST_DETECT_TIMEOUT_SEC });
    } else {
      firstWatchDeadlineMsRef.current = null;
      firstWatchWarnedRef.current = false;
    }

    onReset?.(reason);
  }, [onReset]);

  // Timer-driven reset at +2:10 (no grace)
  React.useEffect(() => {
    if (!armedRef.current) return;
    if (firstAnchorMsRef.current == null) return;

    const boundary = BOUNDARY_OFFSET_SEC + FINAL_GRACE_SEC;
    if (elapsedFromFirstSec >= boundary) {
      dbg("ui/timer-hard-reset", {
        at: elapsedFromFirstSec.toFixed(2),
        boundary,
        grace: FINAL_GRACE_SEC,
      });
      hardReset("timer");
    }
  }, [elapsedFromFirstSec, hardReset]);

  // 5th mechanic → hard reset (natural)
  React.useEffect(() => {
    const buttonsCount = buttons.length;
    if (HARD_RESET_ON_FIFTH && output.length === buttonsCount) {
      const src = lastAddSourceRef.current || "auto";
      dbg("ui/5th mechanic → HARD reset", { source: src, reason: "natural" });
      const t = setTimeout(() => {
        hardReset("natural");
      }, 200);
      return () => clearTimeout(t);
    }
  }, [output, hardReset]);

  // Manual Reset button
  const handleManualReset = React.useCallback(() => {
    hardReset("manual");
  }, [hardReset]);

  // ================== UI ==================
  return (
    <div
      ref={wrapperRef}
      style={{
        display: "grid",
        gridTemplateColumns: "45% 1fr",
        gridTemplateRows: "1fr auto",
        gap: 12,
        height: "100%",
        width: "100%",
        padding: 8,
        boxSizing: "border-box",
      }}
    >
      {/* Left column: mechanics */}
      <div
        style={{
          gridColumn: "1 / 2",
          gridRow: "1 / 2",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-evenly",
          alignItems: "stretch",
          minHeight: 0,
        }}
      >
        {buttons.map((label) => {
          const isUsed = !!used[label];
          return (
            <button
              key={label}
              onClick={() => handleClick(label, "manual")}
              disabled={isUsed}
              style={{
                width: "100%",
                cursor: isUsed ? "not-allowed" : "pointer",
                border: "1px solid #666",
                borderRadius: 8,
                background: isUsed ? "#000000" : "#1e1e1e",
                color: isUsed ? "#888888" : "#E0E0E0", // grey when used
                fontFamily: "sans-serif",
                fontSize: buttonFontSize,
                lineHeight: 1.1,
                padding: "6px 10px",
                boxSizing: "border-box",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Right column: output + sticky banners (unchanged plus Dodgy banner) */}
      <div
        style={{
          gridColumn: "2 / 3",
          gridRow: "1 / 2",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
          padding: 4,
          boxSizing: "border-box",
        }}
      >
        {/* Sticky orange banner (watchdog) — unchanged */}
        {firstMissBanner && (
          <div
            style={{
              position: "absolute",
              top: 6,
              right: 6,
              maxWidth: "85%",
              background: "#ff8a00",
              color: "#111",
              borderRadius: 10,
              padding: "6px 10px",
              fontFamily: "sans-serif",
              fontSize: 12,
              lineHeight: 1.2,
              boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
              border: "1px solid rgba(0,0,0,0.25)",
              pointerEvents: "none",
              userSelect: "none",
              zIndex: 1,
            }}
          >
            {FIRST_MISS_MSG}
          </div>
        )}

        {/* Sticky blue banner (Core-first) — unchanged (top-right) */}
        {coreFirstBanner && (
          <div
            style={{
              position: "absolute",
              top: 22,
              right: 8,
              maxWidth: "80%",
              background: "#4aa3ff",
              color: "#061e3a",
              borderRadius: 10,
              padding: "6px 10px",
              fontFamily: "sans-serif",
              fontSize: 12,
              lineHeight: 1.2,
              boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
              border: "1px solid rgba(0,0,0,0.25)",
              pointerEvents: "none",
              userSelect: "none",
              zIndex: 2,
            }}
          >
            Core 1
          </div>
        )}

        {/* Dodgy banner — same vertical level as Core, closer to mechanics (left) */}
        {dodgyActive && (
          <div
            style={{
              position: "absolute",
              top: 22,          // same height as Core banner
              left: 8,          // closer to mechanics column
              maxWidth: "80%",
              background: "#ff3b30", // red while active
              color: "#1a0b0b",
              borderRadius: 10,
              padding: "6px 10px",
              fontFamily: "sans-serif",
              fontSize: 12,
              lineHeight: 1.2,
              boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
              border: "1px solid rgba(0,0,0,0.25)",
              pointerEvents: "none",
              userSelect: "none",
              zIndex: 2,        // overlap like Core does
            }}
          >
            Dodgy
          </div>
        )}

        {/* Output list */}
        {output.map((val, i) => (
          <h1
            key={`${val}-${i}`}
            style={{
              margin: 0,
              fontFamily: "sans-serif",
              fontSize: outputFontSize,
              color: "#E0E0E0",
              whiteSpace: "nowrap",
            }}
          >
            {val}
          </h1>
        ))}
      </div>

      {/* Bottom row: Dodgy (left) + Reset (right column centered) */}
      <div
        style={{
          gridColumn: "1 / 2",
          gridRow: "2 / 3",
          display: "flex",
          justifyContent: "flex-start",
          alignItems: "center",
          paddingTop: 6,
          gap: 8,
        }}
      >
        {/* Dodgy button — bottom-left under mechanics; blue → red while active */}
        <button
          onClick={() => {
            if (!dodgyActive) {
              setDodgyActive(true);
              dbg("ui/dodgy/activated");
            }
          }}
          disabled={dodgyActive}
          style={{
            border: "1px solid #27466f",
            borderRadius: 8,
            padding: "6px 12px",
            background: dodgyActive ? "#ff3b30" : "#2a66b3",
            color: "#ffffff",
            fontFamily: "sans-serif",
            fontSize: 14,
            cursor: dodgyActive ? "not-allowed" : "pointer",
            boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
          }}
          title={dodgyActive ? "Active until reset" : "Mark this cycle as Dodgy"}
        >
          Dodgy
        </button>
      </div>

      <div
        style={{
          gridColumn: "2 / 3",
          gridRow: "2 / 3",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          paddingTop: 6,
        }}
      >
        <button
          onClick={handleManualReset}
          style={{
            cursor: "pointer",
            border: "1px solid #888",
            borderRadius: 8,
            padding: "6px 12px",
            background: "#2a2a2a",
            color: "#ffffff",
            fontFamily: "sans-serif",
            fontSize: 14,
          }}
        >
          Reset
        </button>
      </div>
    </div>
  );
};

export default LettersDisplay;
