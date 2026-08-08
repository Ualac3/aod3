import { mixColor } from "alt1"
import { minion, minionList } from "./data"

export const alt1 = window.alt1

export const displayDetectionMessage = (message: string, duration: number, size?: number) => {
    alt1?.overLayClearGroup("1")
    alt1?.overLaySetGroup("1")
    alt1?.overLayTextEx(
        message,
        mixColor(220, 30, 30),
        size || 48,
        Math.round(alt1.rsWidth / 2),
        Math.round(alt1.rsHeight / 4),
        duration,
        "serif",
        true,
        true
    )
}

export const getMinionFromInitial = (initial: string) => {
    const result = minionList.find((minion) => minion.initial === initial)

    if (!result) {
        console.error(`Minion not found from initial: ${initial}`)

        return null
    }

    return result
}

// helpers.ts

/**
 * Play a sound from /public/resources.
 * Example: playSound("Bomb") will try to load /resources/Bomb.mp3
 */
export function playSound(name: string) {
  try {
    const audio = new Audio(`/resources/${name}.mp3`);
    audio.volume = 1.0; // adjust 0.0 – 1.0 if you want quieter
    audio.play().catch((err) => {
      console.warn("playSound error", err);
    });
  } catch (e) {
    console.warn("playSound setup error", e);
  }
}