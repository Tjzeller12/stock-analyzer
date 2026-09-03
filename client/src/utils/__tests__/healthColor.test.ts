import { describe, expect, it } from "vitest";
import { HEALTH_GREEN, HEALTH_RED, HEALTH_YELLOW, healthColor } from "../healthColor";

describe("healthColor", () => {
  it("uses the same color for 3-axis and 6-axis equivalent averages (P3)", () => {
    const three = { A: 80, B: 80, C: 80 };
    const six = { A: 80, B: 80, C: 80, D: 80, E: 80, F: 80 };
    expect(healthColor(three, Object.keys(three))).toEqual(HEALTH_GREEN);
    expect(healthColor(six, Object.keys(six))).toEqual(healthColor(three, Object.keys(three)));
  });

  it("turns red below average 50 and yellow through 66", () => {
    expect(healthColor({ A: 40, B: 40 }, ["A", "B"])).toEqual(HEALTH_RED);
    expect(healthColor({ A: 60, B: 60 }, ["A", "B"])).toEqual(HEALTH_YELLOW);
    expect(healthColor({ A: 70, B: 70 }, ["A", "B"])).toEqual(HEALTH_GREEN);
  });

  it("does not use a fixed 600-sum threshold", () => {
    // Old logic: 3 * 70 = 210 < 300 → red. Average 70 → green.
    expect(healthColor({ A: 70, B: 70, C: 70 }, ["A", "B", "C"])).toEqual(HEALTH_GREEN);
  });
});
