import React from "react";
import { State } from "../useMinionState";
import { dbg } from "../logger";
import { playSound } from "../helpers";

type ResetReason = "manual" | "natural";

type Props = {
  windowSize: { height: number; width: number };
  state: State;
  onReset?: (reason?: ResetReason) => void; // HARD reset hook to parent
  resetCounter?: number; // Signal from parent to trigger auto-reset
};

/** Policy: 5th mechanic ALWAYS triggers a hard reset (natural). */
const HARD_RESET_ON_FIFTH = true;

const LettersDisplay: React.FC<Props> = ({ state, onReset, resetCounter }) => {
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
  const buttons = ["Beams", "Cannon", "Core", "Flurry", "Minions"] as const;
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
      if (label === "Flurry") {
        playSound("flurry");
      }
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

      if (!used[label]) {
        const previousSource = lastAddSourceRef.current;

        handleClick(label, "manual");

        setTimeout(() => {
          lastAddSourceRef.current = previousSource;
        }, 0);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleClick, used]);

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

  // ================== NEW: Last reset banner ==================
  type ResetBannerInfo = { reason: ResetReason; atMs: number };
  const [lastResetBanner, setLastResetBanner] = React.useState<ResetBannerInfo | null>(null);
  const handledResetCounterRef = React.useRef<number>(0);

  const resetReasonLabel = (reason: ResetReason) => {
    if (reason === "natural") return "Detected";
    return "Manual";
  };

  const formatTime = (ms: number) => {
    const d = new Date(ms);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  };

  const hardReset = React.useCallback((reason: ResetReason, showBanner: boolean = true) => {
    dbg(`ui/hard-reset (${reason})`);
    if (showBanner) {
      setLastResetBanner({ reason, atMs: Date.now() });
    }
    setOutput([]);
    setUsed({});
    lastAddSourceRef.current = null;
    onReset?.(reason);
  }, [onReset]);

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

  // Watch for external reset signal (e.g., player death auto-reset)
  React.useEffect(() => {
    if (resetCounter !== undefined && resetCounter > 0 && resetCounter !== handledResetCounterRef.current) {
      handledResetCounterRef.current = resetCounter;
      hardReset("natural", false);
    }
  }, [resetCounter, hardReset]);

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
                color: isUsed ? "#888888" : "#E0E0E0",
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

      {/* Right column: output + sticky banner */}
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

      {/* Bottom row: reset button */}
      <div
        style={{
          gridColumn: "1 / -1",
          gridRow: "2 / 3",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 8,
          paddingTop: 6,
          flexWrap: "nowrap",
        }}
      >
        <button
          onClick={() => hardReset("manual")}
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
