export type LedTone = "text" | "up" | "down" | "flat";

/** Maps a signed number to the LED tone for its direction. */
export const toneFor = (value: number | null | undefined): LedTone =>
  value == null || value === 0 ? "flat" : value > 0 ? "up" : "down";
