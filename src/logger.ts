let __seq = 0;
export const nextSeq = () => ++__seq;

/**
 * Log with local (system) time instead of UTC.
 * Example: [09:07:15.123] tag ...
 */
export const dbg = (tag: string, ...args: any[]) => {
  const d = new Date();

  // local time string with seconds + milliseconds
  const time = d.toLocaleTimeString("en-GB", { hour12: false }) + "." + d.getMilliseconds().toString().padStart(3, "0");

  // perf.now gives you a monotonic relative ms
  const ms = (performance?.now?.() ?? 0).toFixed(3).padStart(8, " ");

  console.log(`[${time} | +${ms}] ${tag}`, ...args);
};