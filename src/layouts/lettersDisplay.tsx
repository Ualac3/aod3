import React from "react"

import { State } from "../useMinionState"

const lettersDisplay: React.FC<{ windowSize: { height: number; width: number }; state: State }> = ({
  windowSize,
  state
}) => {
  const [output, setOutput] = React.useState<string[]>([]);
  const [used, setUsed] = React.useState<Record<string, boolean>>({});

  const fontSize = Math.min(windowSize.width / 8, windowSize.height / 10);

  // Fixed button labels (mechanics)
  const buttons = ["Core", "Cannon", "Flurry", "Minions", "Beams"] as const;
  type ButtonLabel = typeof buttons[number];

  // Availability line — still shows initials or ???? like your base did
  const availability =
    state.order.length > 0 ? state.order.map((m) => m.initial).join("") : "????";

  const handleClick = React.useCallback((label: ButtonLabel) => {
    console.log("handleClick called with:", label);
    setUsed((u) => {
      if (u[label]) {
        console.log("Already used:", label);
        return u;
      }
      setOutput((prev) => {
        console.log("Adding to output:", label);
        return [...prev, label];
      });
      return { ...u, [label]: true };
    });
  }, []);


  const handleReset = React.useCallback(() => {
    setOutput([]);
    setUsed({});
  }, []);

  // Auto-click when new minions are pushed into state.order
  const prevLenRef = React.useRef<number>(0);

  React.useEffect(() => {
    const prevLen = prevLenRef.current;
    const currLen = state.order.length;

    if (currLen > prevLen) {
      const newItems = state.order.slice(prevLen);
      console.log("[New deaths]", newItems.map(m => `${m.initial}:${m.mechanic}`));

      for (const m of newItems) {
        const label = m.mechanic as ButtonLabel;
        console.log("-> Checking", m.initial, "=>", label, "used?", used[label]);
        if (label && !used[label]) {
          console.log("✅ Auto-click", label);
          handleClick(label);
        } else {
          console.log("❌ Skipped", label);
        }
      }
    }

    prevLenRef.current = currLen;
  }, [state.order, used, handleClick]);

  // Auto-reset 15s after the last button is clicked
  React.useEffect(() => {
    if (output.length === buttons.length) {
      console.log("✅ All buttons clicked, starting 15s reset timer");
      const timer = setTimeout(() => {
        console.log("🔄 Auto-reset after 15s");
        handleReset();
      }, 1000);

      return () => clearTimeout(timer); // cleanup if reset happens early
    }
  }, [output, buttons.length, handleReset]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%" }}>
      {/* Top: two columns */}
      <div style={{ display: "flex", gap: 24, flex: 1, minHeight: 0 }}>
        {/* Left column: buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "min(280px, 35%)" }}>
          {buttons.map((label) => {
            const isUsed = !!used[label];
            return (
              <button
                key={label}
                onClick={() => handleClick(label)}
                disabled={isUsed}
                style={{
                  cursor: isUsed ? "not-allowed" : "pointer",
                  border: "1px solid #999",
                  borderRadius: 12,
                  padding: "8px 12px",
                  background: isUsed ? "#000000" : "#1e1e1e",
                  color: isUsed ? "#555555" : "#E0E0E0",
                  fontFamily: "sans-serif",
                  fontSize,
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: isUsed ? 0.6 : 1
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Right column */}
        <div
          style={{
            flex: 1,
            borderLeft: "1px solid #444",
            paddingLeft: 16,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden"
          }}
        >
          {/* Availability line */}
          <div
            style={{
              padding: "12px 0 8px 0",
              display: "flex",
              justifyContent: "center",
              borderBottom: "1px solid #333"
            }}
          >
            <span
              style={{
                fontFamily: "monospace",
                fontSize: Math.min(windowSize.width / 16, windowSize.height / 14),
                color: "#E0E0E0",
                letterSpacing: 2
              }}
            >
              {availability}
            </span>
          </div>

          {/* Output list */}
          <div
            style={{
              paddingTop: 12,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              flex: 1
            }}
          >
            {output.length === 0 ? (
              <h2 style={{ margin: 0, fontFamily: "sans-serif", fontSize: 20, color: "#888" }}>
                Waiting for picks…
              </h2>
            ) : (
              output.map((val, i) => (
                <h1
                  key={`${val}-${i}`}
                  style={{
                    margin: 0,
                    fontFamily: "sans-serif",
                    fontSize: Math.min(windowSize.width / 12, windowSize.height / 12),
                    color: "#E0E0E0"
                  }}
                >
                  {val}
                </h1>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Reset button */}
      <div style={{ display: "flex", justifyContent: "center", padding: "12px 0" }}>
        <button
          onClick={handleReset}
          style={{
            cursor: "pointer",
            border: "1px solid #888",
            borderRadius: 12,
            padding: "10px 16px",
            background: "#2a2a2a",
            color: "#ffffff",
            fontFamily: "sans-serif",
            fontSize: 16
          }}
        >
          Reset
        </button>
      </div>
    </div>
  );
};

export default lettersDisplay;
