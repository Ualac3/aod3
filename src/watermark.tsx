// watermark.ts
// Gate OCR lines using timestamp watermarks + an optional cooldown.

let lastSeenSec = -Infinity;     // latest HH:MM:SS observed (seconds since midnight)
let watermarkSec = -Infinity;    // ignore lines with ts <= watermarkSec
let cooldownUntilSec = -Infinity; // ignore lines with ts <= cooldownUntilSec

// [HH:MM:SS] -> seconds since midnight
export function tsToSec(text: string): number | null {
  const m = text.match(/\[(\d{2}):(\d{2}):(\d{2})\]/);
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]), s = Number(m[3]);
  return h * 3600 + min * 60 + s;
}

// Handle midnight rollover if times suddenly jump backwards by >12h
function normalizeRollover(sec: number) {
  if (isFinite(lastSeenSec) && sec < lastSeenSec && lastSeenSec - sec > 12 * 3600) {
    lastSeenSec -= 24 * 3600;
    watermarkSec -= 24 * 3600;
    cooldownUntilSec -= 24 * 3600;
  }
}

// Call before detection on every line.
// Returns true iff the line is new enough and past cooldown.
export function shouldProcessLine(text: string): boolean {
  const sec = tsToSec(text);
  if (sec == null) return true; // no timestamp found → allow

  normalizeRollover(sec);

  // advance lastSeen
  if (sec > lastSeenSec) lastSeenSec = sec;

  // gate by watermark and cooldown
  if (sec <= watermarkSec) return false;
  if (sec <= cooldownUntilSec) return false;
  return true;
}

// Set watermark to "ignore everything seen up to now".
export function markResetWatermark(): void {
  watermarkSec = lastSeenSec;
  // console.log("[watermark] watermark set to", watermarkSec);
}

// Set a cooldown: ignore lines for `seconds` after the latest seen timestamp.
export function markResetWithCooldown(seconds: number): void {
  markResetWatermark();                  // ignore up to lastSeen
  cooldownUntilSec = lastSeenSec + seconds; // ignore up to lastSeen + cooldown
  // console.log("[watermark] cooldown until", cooldownUntilSec);
}

// (Optional) set/extend cooldown without moving watermark
export function setCooldown(seconds: number): void {
  cooldownUntilSec = Math.max(cooldownUntilSec, lastSeenSec + seconds);
}
