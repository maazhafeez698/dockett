export interface NumberRules {
  minValue?: number;
  maxValue?: number;
  step?: number;
}

export function numberProblem(raw: string, rules: NumberRules): string | null {
  const text = raw.trim();
  if (text === "") return null;
  const n = Number(text);
  if (!Number.isFinite(n)) return "Enter a valid number.";
  const { minValue, maxValue, step } = rules;
  if (minValue !== undefined && n < minValue) return `Enter a number of at least ${minValue}.`;
  if (maxValue !== undefined && n > maxValue) return `Enter a number of at most ${maxValue}.`;
  if (step !== undefined && step > 0) {
    const base = minValue ?? 0;
    const q = (n - base) / step;
    if (Math.abs(q - Math.round(q)) > 1e-9) return `Enter a number in steps of ${step}.`;
  }
  return null;
}
