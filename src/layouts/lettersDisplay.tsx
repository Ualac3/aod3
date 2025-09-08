import React from "react";
import { State } from "../useMinionState";
import { dbg } from "../logger"; // adjust path

type Props = {
  windowSize: { height: number; width: number };
  state: State;
  onReset?: () => void; // custom callback to clear reducer state between cycles
};

const LettersDisplay: React.FC<Props> = ({ state, onReset }) => {
  const wrapperRef = React.useRef<HTMLDivElement | null>(null);
  const [size, setSize] = React.useState({ width: 300, height: 300 });

  // Measure the component itself (not the viewport)
  React.useEffect(() => {
    if (!wrapperRef.current) return;
    const el = wrapperRef.current;

    const update = () => {
      const rect = el.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
    };

    update(); // initial
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Typography scaled to the component (works well at 300x300)
  const minDim = Math.min(size.width, size.height);
  const buttonFontSize = Math.round(Math.max(14, Math.min(24, minDim * 0.08)));
  const outputFontSize = Math.round(Math.max(14, Math.min(28, minDim * 0.1)));

  // Mechanics (button labels)
  const buttons = ["Core", "Cannon", "Flurry", "Minions", "Beams"] as const;
  type ButtonLabel = (typeof buttons)[number];

  const [output, setOutput] = React.useState<string[]>([]);
  const [used, setUsed] = React.useState<Record<string, boolean>>({});

  const handleClick = React.useCallback((label: ButtonLabel) => {
    setUsed((u) => {
      if (u[label]) {
        dbg("ui/click-BLOCKED", label);
        return u;
      }
      dbg("ui/click", label);
      setOutput((prev) => [...prev, label]);
      return { ...u, [label]: true };
    });
  }, []);

  React.useEffect(() => {
    dbg("ui/output", { output });
  }, [output]);

  const handleReset = React.useCallback(() => {
    dbg("ui/reset");
    setOutput([]);
    setUsed({});
    onReset?.();
  }, [onReset]);

  // Auto-click new items in state.order — run synchronously to avoid "next line" lag
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
        if (label && !used[label]) handleClick(label);
      }
    }

    prevLenRef.current = currLen;
  }, [state.order.length, state.order, used, handleClick]);

  // Auto-reset after all five selected
  React.useEffect(() => {
    if (output.length === buttons.length) {
      dbg("ui/all-5, scheduling reset");
      const t = setTimeout(() => {
        dbg("ui/auto-reset fire");
        handleReset();
      }, 1_000);
      return () => clearTimeout(t);
    }
  }, [output, handleReset]);

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
              onClick={() => handleClick(label)}
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

      {/* Right column: output */}
      <div
        style={{
          gridColumn: "2 / 3",
          gridRow: "1 / 2",
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

      {/* Reset row */}
      <div
        style={{
          gridColumn: "1 / -1",
          gridRow: "2 / 3",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          paddingTop: 6,
        }}
      >
        <button
          onClick={handleReset}
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
