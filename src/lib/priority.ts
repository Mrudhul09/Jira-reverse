export const PRIORITY_LABEL: Record<number, string> = { 1: "P1 Highest", 2: "P2 High", 3: "P3 Medium", 4: "P4 Low", 5: "P5 Lowest" };
export const IMPACT_LABEL: Record<number, string> = { 1: "Extensive", 2: "Significant", 3: "Moderate", 4: "Minor" };
export const URGENCY_LABEL: Record<number, string> = { 1: "Critical", 2: "High", 3: "Medium", 4: "Low" };

// The lower impact + urgency, the higher the priority.
export function priorityFrom(impact: number, urgency: number): number {
  const sum = impact + urgency;
  if (sum <= 2) return 1;
  if (sum === 3) return 2;
  if (sum === 4) return 3;
  if (sum <= 6) return 4;
  return 5;
}

export function asPriority(v: unknown, fallback = 3): number {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : fallback;
}

export function asLevel(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 4 ? n : null;
}
