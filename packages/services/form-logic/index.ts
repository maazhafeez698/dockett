export const NEXT_QUESTION = "__NEXT__";
export const END_FORM = "__END__";

export interface ConditionalRule {
  answer: string;
  targetFieldId: string;
  operator?: NumberOperator;
  conditions?: NumberCondition[];
  conditionJoin?: "AND" | "OR";
}

export type NumberOperator = "EQ" | "GT" | "LT" | "GTE" | "LTE";

export interface NumberCondition {
  operator: NumberOperator;
  value: string;
}

type NumericInterval = { low: number; lowInclusive: boolean; high: number; highInclusive: boolean };

const NUMBER_OPERATORS: NumberOperator[] = ["EQ", "GT", "LT", "GTE", "LTE"];

function numberOperator(rule: ConditionalRule): NumberOperator {
  return rule.operator ?? "EQ";
}

function numberRuleMatches(rule: ConditionalRule, answer: number): boolean {
  const conditions = numberConditionsFor(rule);
  const matches = conditions.map((condition) => {
    const threshold = Number(condition.value);
    switch (condition.operator) {
      case "GT": return answer > threshold;
      case "LT": return answer < threshold;
      case "GTE": return answer >= threshold;
      case "LTE": return answer <= threshold;
      default: return answer === threshold;
    }
  });
  return rule.conditionJoin === "OR" ? matches.some(Boolean) : matches.every(Boolean);
}

function conditionInterval(condition: NumberCondition): NumericInterval {
  const n = Number(condition.value);
  switch (condition.operator) {
    case "GT": return { low: n, lowInclusive: false, high: Infinity, highInclusive: false };
    case "LT": return { low: -Infinity, lowInclusive: false, high: n, highInclusive: false };
    case "GTE": return { low: n, lowInclusive: true, high: Infinity, highInclusive: false };
    case "LTE": return { low: -Infinity, lowInclusive: false, high: n, highInclusive: true };
    default: return { low: n, lowInclusive: true, high: n, highInclusive: true };
  }
}

function intersectIntervals(a: NumericInterval, b: NumericInterval): NumericInterval | null {
  const low = Math.max(a.low, b.low);
  const high = Math.min(a.high, b.high);
  const aIncludes = low !== a.low || a.lowInclusive;
  const bIncludes = low !== b.low || b.lowInclusive;
  const aHighIncludes = high !== a.high || a.highInclusive;
  const bHighIncludes = high !== b.high || b.highInclusive;
  const lowInclusive = aIncludes && bIncludes;
  const highInclusive = aHighIncludes && bHighIncludes;
  if (low > high || (low === high && !(lowInclusive && highInclusive))) return null;
  return { low, lowInclusive, high, highInclusive };
}

function numberRuleIntervals(rule: ConditionalRule): NumericInterval[] {
  const conditions = numberConditionsFor(rule);
  const intervals = conditions.map(conditionInterval);
  if (rule.conditionJoin === "OR") return intervals;
  let intersections = [intervals[0]!];
  for (const interval of intervals.slice(1)) {
    intersections = intersections
      .map((current) => intersectIntervals(current, interval))
      .filter((current): current is NumericInterval => current !== null);
  }
  return intersections;
}

function numericRuleIntervalsOverlap(left: ConditionalRule, right: ConditionalRule): boolean {
  return numberRuleIntervals(left).some((a) => numberRuleIntervals(right).some((b) => intersectIntervals(a, b) !== null));
}

export interface ConditionalLogic {
  rules: ConditionalRule[];
}

export interface LogicField {
  id: string;
  label?: string;
  type: string;
  isRequired?: boolean;
  config?: unknown;
}

export interface LogicIssue {
  fieldId: string;
  message: string;
}

export interface LogicAnalysis {
  errors: LogicIssue[];
  warnings: LogicIssue[];
}

function configOf(field: LogicField): Record<string, unknown> {
  return field.config && typeof field.config === "object" ? (field.config as Record<string, unknown>) : {};
}

export function logicOf(field: LogicField): ConditionalLogic | null {
  const logic = configOf(field).logic as { rules?: unknown } | undefined;
  if (!logic || !Array.isArray(logic.rules)) return null;
  return { rules: logic.rules as ConditionalRule[] };
}

export function logicChoices(field: LogicField): string[] {
  if (field.type === "YES_NO") return ["true", "false"];
  const config = configOf(field);
  if (field.type === "DROPDOWN" || field.type === "RADIO_GROUP") {
    return Array.isArray(config.options) ? (config.options as string[]) : [];
  }
  if (field.type === "RATING") {
    const max = typeof config.max === "number" ? config.max : 5;
    return Array.from({ length: Math.max(0, Math.min(10, max)) }, (_, index) => String(index + 1));
  }
  return [];
}

function numberConditionsFor(rule: ConditionalRule): NumberCondition[] {
  return rule.conditions?.length ? rule.conditions : [{ operator: numberOperator(rule), value: rule.answer }];
}

function isSupported(field: LogicField) {
  return field.type === "YES_NO" || field.type === "DROPDOWN" || field.type === "RADIO_GROUP" || field.type === "RATING" || field.type === "NUMBER";
}

/** Shared validation for creator feedback, publication, and submission checks. */
export function analyzeConditionalLogic(fields: LogicField[]): LogicAnalysis {
  const errors: LogicIssue[] = [];
  const warnings: LogicIssue[] = [];
  const positions = new Map(fields.map((field, index) => [field.id, index]));

  for (const [index, field] of fields.entries()) {
    const config = configOf(field);
    const rawLogic = config.logic as { rules?: unknown } | undefined;
    if (rawLogic === undefined) continue;
    if (!rawLogic || !Array.isArray(rawLogic.rules)) {
      errors.push({ fieldId: field.id, message: `The routes on "${field.label ?? "this question"}" are damaged. Remove and add the logic again.` });
      continue;
    }
    const logic = logicOf(field)!;
    if (!isSupported(field)) {
      errors.push({ fieldId: field.id, message: `"${field.label ?? "This question"}" can't control the next question. Use Number, Yes / No, Single-select, Radio group, or Rating.` });
      continue;
    }

    const choices = logicChoices(field);
    const seenAnswers = new Set<string>();
    for (const rule of logic.rules) {
      if (!rule || typeof rule.answer !== "string" || typeof rule.targetFieldId !== "string" || !rule.targetFieldId) {
        errors.push({ fieldId: field.id, message: `A route on "${field.label ?? "this question"}" is incomplete. Set an answer and where it should go.` });
        continue;
      }
      const numericAnswer = field.type === "NUMBER" ? Number(rule.answer) : undefined;
      const operator = field.type === "NUMBER" ? numberOperator(rule) : "EQ";
      if (field.type === "NUMBER") {
        const numberConfig = config as { minValue?: number; maxValue?: number; step?: number };
        const conditions = rule.conditions?.length
          ? rule.conditions
          : [{ operator, value: rule.answer }];
        if (rule.conditions && rule.conditions.length === 0) {
          errors.push({ fieldId: field.id, message: `Add at least one number condition to the route on "${field.label ?? "this question"}".` });
        }
        if (rule.conditionJoin !== undefined && rule.conditionJoin !== "AND" && rule.conditionJoin !== "OR") {
          errors.push({ fieldId: field.id, message: `Choose whether conditions on "${field.label ?? "this question"}" must all match or any one can match.` });
        }
        for (const condition of conditions) {
          const conditionValue = Number(condition.value);
          if (!NUMBER_OPERATORS.includes(condition.operator) || !Number.isFinite(conditionValue) || condition.value.trim() === "") {
            errors.push({ fieldId: field.id, message: `Every number condition on "${field.label ?? "this question"}" needs a comparison and a valid number.` });
            continue;
          }
          if (condition.operator === "EQ") {
            const base = numberConfig.minValue ?? 0;
            const offStep = numberConfig.step !== undefined && Math.abs((conditionValue - base) / numberConfig.step - Math.round((conditionValue - base) / numberConfig.step)) > 1e-9;
            if ((numberConfig.minValue !== undefined && conditionValue < numberConfig.minValue)
              || (numberConfig.maxValue !== undefined && conditionValue > numberConfig.maxValue)
              || offStep) {
              errors.push({ fieldId: field.id, message: `The number route ${condition.value} on "${field.label ?? "this question"}" can't be entered with its current number limits.` });
            }
          }
        }
        if (conditions.length > 0
          && conditions.every((condition) => condition && NUMBER_OPERATORS.includes(condition.operator) && Number.isFinite(Number(condition.value)))
          && numberRuleIntervals(rule).length === 0) {
          errors.push({ fieldId: field.id, message: `The AND conditions on "${field.label ?? "this question"}" can't all be true. Adjust the comparison values or choose OR.` });
        }
      } else if (field.type !== "NUMBER" && !choices.includes(rule.answer)) {
        errors.push({ fieldId: field.id, message: `The route answer "${rule.answer}" is no longer an option on "${field.label ?? "this question"}". Update or remove that route.` });
      }
      const answerKey = field.type === "NUMBER" && Number.isFinite(numericAnswer)
        ? JSON.stringify({ join: rule.conditionJoin ?? "AND", conditions: numberConditionsFor(rule).map((condition) => [condition.operator, Number(condition.value)]).sort() })
        : rule.answer;
      if (seenAnswers.has(answerKey)) {
        errors.push({ fieldId: field.id, message: `"${field.label ?? "This question"}" has more than one route for the same answer. Keep one route per answer.` });
      }
      seenAnswers.add(answerKey);

      if (field.type === "NUMBER" && Number.isFinite(numericAnswer)) {
        for (const earlier of logic.rules.slice(0, logic.rules.indexOf(rule))) {
          if (!earlier || numberConditionsFor(earlier).some((condition) => !Number.isFinite(Number(condition.value)))) continue;
          if (earlier.targetFieldId !== rule.targetFieldId && numericRuleIntervalsOverlap(earlier, rule)) {
            errors.push({ fieldId: field.id, message: `Number routes on "${field.label ?? "this question"}" overlap and lead to different questions. Adjust their comparisons or send them to the same place.` });
            break;
          }
        }
      }

      if (rule.targetFieldId === NEXT_QUESTION || rule.targetFieldId === END_FORM) continue;
      const targetIndex = positions.get(rule.targetFieldId);
      if (targetIndex === undefined) {
        errors.push({ fieldId: field.id, message: `A route from "${field.label ?? "this question"}" points to a question that was deleted. Choose a new destination.` });
      } else if (targetIndex <= index) {
        errors.push({ fieldId: field.id, message: `A route from "${field.label ?? "this question"}" goes backward and could loop. Choose a question below it.` });
      }
    }
  }

  if (fields.length > 0) {
    const reachable = new Set<number>([0]);
    const queue = [0];
    while (queue.length > 0) {
      const index = queue.shift()!;
      const field = fields[index]!;
      const logic = logicOf(field);
      const next = index + 1;
      const destinations = new Set<number>();
      if (!logic || !isSupported(field)) {
        if (next < fields.length) destinations.add(next);
      } else {
        const rules = new Map(logic.rules.filter((rule) => rule && typeof rule.answer === "string" && typeof rule.targetFieldId === "string").map((rule) => [rule.answer, rule.targetFieldId]));
        if (field.type === "NUMBER") {
          for (const rule of logic.rules) {
            if (!rule || typeof rule.answer !== "string" || typeof rule.targetFieldId !== "string") continue;
            const target = rule.targetFieldId;
            if (target === END_FORM) continue;
            if (target === NEXT_QUESTION) {
              if (next < fields.length) destinations.add(next);
              continue;
            }
            const targetIndex = positions.get(target);
            if (targetIndex !== undefined && targetIndex > index) destinations.add(targetIndex);
          }
          if (next < fields.length) destinations.add(next);
        } else {
        for (const answer of logicChoices(field)) {
          const target = rules.get(answer);
          if (target === END_FORM) continue;
          if (target === NEXT_QUESTION || !target) {
            if (next < fields.length) destinations.add(next);
            continue;
          }
          const targetIndex = positions.get(target);
          if (targetIndex !== undefined && targetIndex > index) destinations.add(targetIndex);
          else if (next < fields.length) destinations.add(next);
        }
        if (!field.isRequired && next < fields.length) destinations.add(next);
        }
      }
      for (const destination of destinations) {
        if (reachable.has(destination)) continue;
        reachable.add(destination);
        queue.push(destination);
      }
    }
    for (const [index, field] of fields.entries()) {
      if (!reachable.has(index)) {
        const source = fields.slice(0, index).reverse().find((candidate) =>
          logicOf(candidate)?.rules.some((rule) => {
            if (rule?.targetFieldId === END_FORM) return true;
            const targetIndex = positions.get(rule?.targetFieldId ?? "");
            return targetIndex !== undefined && targetIndex > index;
          }),
        );
        warnings.push({
          fieldId: source?.id ?? field.id,
          message: `"${field.label ?? "This question"}" can't currently be reached. Add an answer route to it, or change a route that skips it.`,
        });
      }
    }
  }

  return { errors, warnings };
}

/**
 * Calculates the one active path through a form. Invalid destinations safely fall through to the
 * following question; publish and submit validation report those configurations separately.
 */
export function calculateActivePath(fields: LogicField[], values: Record<string, string>): string[] {
  const positions = new Map(fields.map((field, index) => [field.id, index]));
  const path: string[] = [];
  const visited = new Set<number>();
  let index = 0;

  while (index >= 0 && index < fields.length && !visited.has(index)) {
    visited.add(index);
    const field = fields[index]!;
    path.push(field.id);
    const answer = values[field.id] ?? "";
    const rule = answer ? logicOf(field)?.rules.find((candidate) => {
      if (!candidate) return false;
      return field.type === "NUMBER"
        ? Number.isFinite(Number(answer)) && Number.isFinite(Number(candidate.answer)) && numberRuleMatches(candidate, Number(answer))
        : candidate.answer === answer;
    }) : undefined;
    if (!rule || rule.targetFieldId === NEXT_QUESTION) {
      index += 1;
      continue;
    }
    if (rule.targetFieldId === END_FORM) break;
    const targetIndex = positions.get(rule.targetFieldId);
    index = targetIndex !== undefined && targetIndex > index ? targetIndex : index + 1;
  }

  return path;
}
