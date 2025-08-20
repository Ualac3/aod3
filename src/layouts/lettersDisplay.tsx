import React from "react"

import { State } from "../useMinionState"

type LettersDisplayProps = {
  windowSize: { height: number; width: number };
  state: State; // assumes state.order: { name: string; color: string; initial: string }[]
};

const lettersDisplay: React.FC<{ windowSize: { height: number; width: number }; state: State }> = ({
  windowSize,
  state
}) => {
  const [output, setOutput] = React.useState<string[]>([]);
  const [used, setUsed] = React.useState<Record<string, boolean>>({});

  const fontSize = Math.min(windowSize.width / 8, windowSize.height / 10);
  const buttons = ["core", "arms", "flurry", "minions", "beams"];

  const handleClick = (label: string) => {
    if (used[label]) return;
    setOutput((prev) => [...prev, label]);
    setUsed((u) => ({ ...u, [label]: true }));
  };

  const handleReset = () => {
    setOutput([]);
    setUsed({});
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%"
      }}
    >
      {/* Top: two-column content */}
      <div
        style={{
          display: "flex",
          gap: 24,
          alignItems: "stretch",
          justifyContent: "flex-start",
          width: "100%",
          flex: 1,
          minHeight: 0
        }}
      >
        {/* Left column: five vertical buttons */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            width: "min(280px, 35%)"
          }}
        >
          {buttons.map((label, index) => {
            const isSpecial = index === 3 && !state.allDead;
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
                  lineHeight: 1,
                  textDecoration: isSpecial ? "underline overline" : "none",
                  textAlign: "center",
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

        {/* Right column: each clicked value on its own row */}
        <div
          style={{
            flex: 1,
            borderLeft: "1px solid #444",
            paddingLeft: 16,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-start",
            alignItems: "center",
            overflowY: "auto",
            paddingTop: 16
          }}
        >
          {output.length === 0 ? (
            <h2
              style={{
                margin: 0,
                fontFamily: "sans-serif",
                fontSize: 20,
                color: "#888"
              }}
            >
              Click a button →
            </h2>
          ) : (
            output.map((val, i) => (
              <h1
                key={i}
                style={{
                  margin: "8px 0",
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

      {/* Bottom: centered Reset button */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: "12px 0"
        }}
      >
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






export default lettersDisplay
