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
 const BOUNDARY_OFFSET_SEC      = 133;  // 2:15 (update comment if you want 2:10 → 130)
const FINAL_GRACE_SEC          = 0;    // no grace
const SOUND_NAME: string       = "end"; // /public/resources/end.mp3

/** Policy: 5th mechanic ALWAYS triggers a hard reset (natural). */
const HARD_RESET_ON_FIFTH = true;

/** ── Independent ping schedule ───────────────────────────────────────
 * First ping at +2:00, then every +2:30:
 *  2:00, 4:30, 7:00, 9:30, 12:00, 14:30, 17:00, 19:30
 */
const PING_SOUND_NAME = "mechanic"; // /public/resources/mechanic.mp3
const PING_SCHEDULE_SEC = [120, 270, 420, 570, 720, 870, 1020, 1170];

const LettersDisplay: React.FC<Props> = ({ state, onReset }) => {
  // ----- Responsive sizing -----
  const wrapperRef = React.useRef<HTMLDivElement | null>(null);
  const [size, setSize] = React.useState({ width: 328, height: 300 });
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
  const buttonFontSize = Math.round(Math.max(13, Math.min(20, minDim * 0.07)));
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
    const handleKeyDown = (event: KeyboardEvent) => {
      const labelMap: Record<string, ButtonLabel> = {
        F13: "Beams",
        F14: "Cannon",
        F15: "Core",
      };
      const label = labelMap[event.key] || labelMap[event.code];
      if (!label) return;
      event.preventDefault();
      if (!used[label]) handleClick(label, "manual");
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleClick, used]);

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

  // Dodgy flag (persists until end of current cycle; clears on ANY reset)
  const [dodgyActive, setDodgyActive] = React.useState(false);

  // ================== NEW: Last reset banner ==================
  type ResetBannerInfo = { reason: ResetReason; atMs: number };
  const [lastResetBanner, setLastResetBanner] = React.useState<ResetBannerInfo | null>(null);

  const resetReasonLabel = (reason: ResetReason) => {
    // Requested examples: "detected" or "manual"
    if (reason === "natural") return "Detected";
    if (reason === "manual") return "Manual";
    return "Timer";
  };

  const formatTime = (ms: number) => {
    const d = new Date(ms);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  };

  // Independent timer state (completely separate from cycles/resets)
  const [timerActive, setTimerActive] = React.useState(false);
  const timerStartMsRef = React.useRef<number | null>(null);
  const timerIdxRef = React.useRef(0);

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

      dbg("cycle/FIRST_ANCHORED", { atMs: firstAnchorMsRef.current, firstLabel });
      displayDetectionMessage("Cycle started", 2000); // keep the toast
    }

    prevOutputLenForFirstRef.current = curr;
  }, [output.length, output]);

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

    // NEW: record last reset reason + timestamp for banner
    setLastResetBanner({ reason, atMs: Date.now() });

    // Clear UI
    setOutput([]);
    setUsed({});
    // Reset cycle
    firstAnchorMsRef.current = null;
    armedRef.current = false;
    setLateShown(false);
    setSoundPlayed(false);

    // Clear in-app sticky flags on ANY reset
    setDodgyActive(false);

    // (Intentionally do not touch independent timer here)

    onReset?.(reason);
  }, [onReset]);

  // Timer-driven reset at boundary
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

  // ================== Independent timer logic ==================
  React.useEffect(() => {
    if (!timerActive || timerStartMsRef.current == null) return;

    const elapsedSec = (nowMs - timerStartMsRef.current) / 1000;

    // Fire any due pings (while loop handles if the tab lags)
    while (
      timerIdxRef.current < PING_SCHEDULE_SEC.length &&
      elapsedSec >= PING_SCHEDULE_SEC[timerIdxRef.current]
    ) {
      const idx = timerIdxRef.current;
      try {
        playSound(PING_SOUND_NAME);
        dbg("pings/play", { idx, atSec: elapsedSec.toFixed(2), targetSec: PING_SCHEDULE_SEC[idx] });
      } catch (e) {
        dbg("pings/error", e);
      }
      timerIdxRef.current++;
    }

    // Stop automatically after the last ping
    if (timerIdxRef.current >= PING_SCHEDULE_SEC.length) {
      setTimerActive(false);
      dbg("pings/done");
    }
  }, [nowMs, timerActive]);

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

      {/* Right column: output + sticky banners */}
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
        {/* Sticky orange banner (last reset reason) */}
        {lastResetBanner && (
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
              zIndex: 2,
            }}
          >
            <div style={{ fontWeight: 700 }}>
              Reset: {resetReasonLabel(lastResetBanner.reason)}
            </div>
            <div style={{ opacity: 0.9 }}>
              {formatTime(lastResetBanner.atMs)}
            </div>
          </div>
        )}

        {/* Dodgy banner — same vertical as Core, closer to mechanics (left) */}
        {dodgyActive && (
          <div
            style={{
              position: "absolute",
              top: 22,
              left: 8,
              maxWidth: "80%",
              background: "#ff3b30",
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
              zIndex: 2,
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

      {/* Bottom row: all four buttons horizontally */}
      <div
        style={{
          gridColumn: "1 / -1",
          gridRow: "2 / 3",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          gap: 8,
          paddingTop: 6,
          flexWrap: "nowrap",
        }}
      >
        {/* Dodgy */}
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
            padding: "6px 10px",
            background: dodgyActive ? "#ff3b30" : "#2a66b3",
            color: "#ffffff",
            fontFamily: "sans-serif",
            fontSize: 13,
            cursor: dodgyActive ? "not-allowed" : "pointer",
            boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
            whiteSpace: "nowrap",
          }}
          title={dodgyActive ? "Active until reset" : "Mark this cycle as Dodgy"}
        >
          Dodgy
        </button>

        {/* Timer (start independent schedule) */}
        <button
          onClick={() => {
            if (!timerActive) {
              timerStartMsRef.current = Date.now();
              timerIdxRef.current = 0;
              setTimerActive(true);
              dbg("pings/start", { scheduleSec: PING_SCHEDULE_SEC });
            }
          }}
          disabled={timerActive}
          style={{
            border: "1px solid #206b37",
            borderRadius: 8,
            padding: "6px 10px",
            background: timerActive ? "#27ae60" : "#1f7a3a",
            color: "#ffffff",
            fontFamily: "sans-serif",
            fontSize: 13,
            cursor: timerActive ? "not-allowed" : "pointer",
            boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
            whiteSpace: "nowrap",
          }}
          title={
            timerActive
              ? "Timer running (2:00, 4:30, 7:00, 9:30, 12:00, 14:30, 17:00, 19:30)"
              : "Start independent timer"
          }
        >
          Timer
        </button>

        {/* Cancel (stop & reset independent schedule) */}
        <button
          onClick={() => {
            if (timerActive || timerStartMsRef.current != null || timerIdxRef.current !== 0) {
              setTimerActive(false);
              timerStartMsRef.current = null;
              timerIdxRef.current = 0;
              dbg("pings/cancel");
            }
          }}
          disabled={!timerActive && timerStartMsRef.current == null && timerIdxRef.current === 0}
          style={{
            border: "1px solid #6b2a2a",
            borderRadius: 8,
            padding: "6px 10px",
            background: "#8e2d2d",
            color: "#ffffff",
            fontFamily: "sans-serif",
            fontSize: 13,
            cursor:
              !timerActive && timerStartMsRef.current == null && timerIdxRef.current === 0
                ? "not-allowed"
                : "pointer",
            boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
            whiteSpace: "nowrap",
          }}
          title="Stop and reset the independent timer"
        >
          Cancel
        </button>

        {/* Reset (cycle manual reset) */}
        <button
          onClick={() => {
            // This is the cycle manual reset; it does not touch the independent timer
            hardReset("manual");
          }}
          style={{
            cursor: "pointer",
            border: "1px solid #888",
            borderRadius: 8,
            padding: "6px 12px",
            background: "#2a2a2a",
            color: "#ffffff",
            fontFamily: "sans-serif",
            fontSize: 13,
            whiteSpace: "nowrap",
          }}
        >
          Reset
        </button>
      </div>
    </div>
  );
};

export default LettersDisplay;
