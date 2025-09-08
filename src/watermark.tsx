import { dbg } from "./logger"; // adjust path
// watermark.ts
let lastSeenSec = -Infinity;
let watermarkSec = -Infinity;
let cooldownUntilSec = -Infinity;

const tsToSec = (text: string): number | null => {
  const m = text.match(/\[(\d{2}):(\d{2}):(\d{2})\]/);
  if (!m) return null;
  const h = +m[1], mi = +m[2], s = +m[3];
  return h * 3600 + mi * 60 + s;
};

// optional rollover safeguard (midnight)
const normalizeRollover = (sec: number) => {
  if (isFinite(lastSeenSec) && sec < lastSeenSec && lastSeenSec - sec > 12 * 3600) {
    lastSeenSec      -= 24 * 3600;
    watermarkSec     -= 24 * 3600;
    cooldownUntilSec -= 24 * 3600;
  }
};

export function shouldProcessLineWithReason(text: string) {
  const sec = tsToSec(text);
  if (sec == null) {
    // allow untimestamped lines (they won't move the clock)
    return { allow: true, reason: "no-timestamp", lineTs: null, lastSeenSec, watermarkSec, cooldownUntilSec };
  }

  normalizeRollover(sec);

  // decide first
  const byWatermark = sec <= watermarkSec;
  const byCooldown  = sec <= cooldownUntilSec;
  const allow = !byWatermark && !byCooldown;

  // then advance lastSeen (decision for this line already made)
  if (sec > lastSeenSec) lastSeenSec = sec;

  const reason = allow ? "allow" : byCooldown ? "≤ cooldown" : "≤ watermark";
  return { allow, reason, lineTs: sec, lastSeenSec, watermarkSec, cooldownUntilSec };
}

export function markResetWatermark() {
  watermarkSec = lastSeenSec;
}

export function markResetWithCooldown(seconds: number) {
  markResetWatermark();
  cooldownUntilSec = lastSeenSec + seconds;
  dbg?.("watermark/RESET", { lastSeenSec, watermarkSec, cooldownUntilSec, seconds });
}
