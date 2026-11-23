export const HEALTH_RED = {
  borderColor: "#ef4444",
  bgColor: "rgba(239, 68, 68, 0.3)",
};
export const HEALTH_YELLOW = {
  borderColor: "#eab308",
  bgColor: "rgba(234, 179, 8, 0.3)",
};
export const HEALTH_GREEN = {
  borderColor: "#069042",
  bgColor: "rgba(6, 144, 66, 0.3)",
};
export const HEALTH_NEUTRAL = {
  borderColor: "#6b7280",
  bgColor: "rgba(107, 114, 128, 0.2)",
};

export function healthScore(
  scores: Record<string, number>,
  activeAxes: string[] = [],
): number {
  const used = activeAxes.length ? activeAxes : Object.keys(scores);
  if (used.length === 0) return 0;
  return used.reduce((sum, key) => sum + (scores[key] ?? 0), 0) / used.length;
}

export function healthColor(avg: number): {
  borderColor: string;
  bgColor: string;
} {
  if (avg < 50) return HEALTH_RED;
  if (avg <= 66) return HEALTH_YELLOW;
  return HEALTH_GREEN;
}
