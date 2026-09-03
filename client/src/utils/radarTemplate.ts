/** Safe default: evaluates to a finite mid-range score, never NaN (P8). */
export const NEUTRAL_AXIS_EQUATION = "50";

/** Radar charts need at least a triangle; 1–2 axes look like a number, not a chart. */
export const MIN_RADAR_AXES = 3;
/** More than this and the spider chart is an unreadable scribble. */
export const MAX_RADAR_AXES = 8;

export type AxisTemplate = {
  equations: Record<string, string>;
  disabledEquations?: Record<string, string>;
};

export function activeAxes(template: AxisTemplate): string[] {
  return Object.keys(template.equations);
}

export function disabledAxes(template: AxisTemplate): string[] {
  return Object.keys(template.disabledEquations ?? {});
}

function disabledMap(template: AxisTemplate): Record<string, string> {
  return { ...(template.disabledEquations ?? {}) };
}

export function addAxis<T extends AxisTemplate>(template: T, name: string): T {
  const trimmed = name.trim();
  if (!trimmed) return template;
  if (Object.keys(template.equations).length >= MAX_RADAR_AXES) return template;
  if (template.equations[trimmed] !== undefined || disabledMap(template)[trimmed] !== undefined) {
    return template;
  }
  return {
    ...template,
    equations: {
      ...template.equations,
      [trimmed]: NEUTRAL_AXIS_EQUATION,
    },
  } as T;
}

export function uniqueAxisName(existing: string[], base = "New Axis"): string {
  if (!existing.includes(base)) return base;
  let i = 2;
  while (existing.includes(`${base} ${i}`)) i += 1;
  return `${base} ${i}`;
}

/** Turn an axis off without deleting its formula. Scoring uses `equations` only. */
export function disableAxis<T extends AxisTemplate>(template: T, name: string): T {
  if (!(name in template.equations)) return template;
  if (Object.keys(template.equations).length <= MIN_RADAR_AXES) return template;
  const equation = template.equations[name];
  const { [name]: _removed, ...rest } = template.equations;
  return {
    ...template,
    equations: rest,
    disabledEquations: { ...disabledMap(template), [name]: equation },
  } as T;
}

/** Turn a parked axis back on. */
export function enableAxis<T extends AxisTemplate>(template: T, name: string): T {
  const parked = disabledMap(template);
  if (!(name in parked) || name in template.equations) return template;
  if (Object.keys(template.equations).length >= MAX_RADAR_AXES) return template;
  const { [name]: equation, ...restDisabled } = parked;
  return {
    ...template,
    equations: { ...template.equations, [name]: equation },
    disabledEquations: restDisabled,
  } as T;
}

/**
 * Permanently delete an axis formula.
 * Active axes still cannot drop below MIN_RADAR_AXES. Disabled axes can always be deleted.
 */
export function removeAxis<T extends AxisTemplate>(template: T, name: string): T {
  const parked = disabledMap(template);
  if (name in parked) {
    const { [name]: _drop, ...restDisabled } = parked;
    return { ...template, disabledEquations: restDisabled } as T;
  }
  if (!(name in template.equations)) return template;
  if (Object.keys(template.equations).length <= MIN_RADAR_AXES) return template;
  const { [name]: _removed, ...rest } = template.equations;
  return { ...template, equations: rest } as T;
}

export function renameAxis<T extends AxisTemplate>(template: T, from: string, to: string): T {
  const next = to.trim();
  if (!from || !next || from === next) return template;
  const parked = disabledMap(template);
  const taken = next in template.equations || next in parked;
  if (taken) return template;

  if (from in template.equations) {
    const equations: Record<string, string> = {};
    for (const [key, value] of Object.entries(template.equations)) {
      equations[key === from ? next : key] = value;
    }
    return { ...template, equations } as T;
  }
  if (from in parked) {
    const disabledEquations: Record<string, string> = {};
    for (const [key, value] of Object.entries(parked)) {
      disabledEquations[key === from ? next : key] = value;
    }
    return { ...template, disabledEquations } as T;
  }
  return template;
}

export function setAxisEquation<T extends AxisTemplate>(template: T, name: string, equation: string): T {
  if (name in template.equations) {
    return {
      ...template,
      equations: { ...template.equations, [name]: equation },
    } as T;
  }
  const parked = disabledMap(template);
  if (name in parked) {
    return {
      ...template,
      disabledEquations: { ...parked, [name]: equation },
    } as T;
  }
  return template;
}
