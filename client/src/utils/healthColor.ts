export const HEALTH_RED = { borderColor: "#ef4444", bgColor: "rgba(239, 68, 68, 0.3)" };
export const HEALTH_YELLOW = { borderColor: "#eab308", bgColor: "rgba(234, 179, 8, 0.3)" };
export const HEALTH_GREEN = { borderColor: "#069042", bgColor: "rgba(6, 144, 66, 0.3)" };
export const HEALTH_NEUTRAL = { borderColor: "#6b7280", bgColor: "rgba(107, 114, 128, 0.2)" };

/**
 * Traffic-light color from the average active-axis score (0–100).
 * Invariant to axis count: a 3-axis radar and a 6-axis radar use the same
 * thresholds (P3).
 */
export function healthColor(
  scores: Record<string, number>,
  activeAxes: string[] = [],
): { borderColor: string; bgColor: string } {
  const used = activeAxes.length ? activeAxes : Object.keys(scores);
  if (used.length === 0) return HEALTH_NEUTRAL;

  const avg = used.reduce((sum, key) => sum + (scores[key] ?? 0), 0) / used.length;
  if (avg < 50) return HEALTH_RED;
  if (avg <= 66) return HEALTH_YELLOW;
  return HEALTH_GREEN;
}
