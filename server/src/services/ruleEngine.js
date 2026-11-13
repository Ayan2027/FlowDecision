function getValue(data, field) {
  return field.split(".").reduce((value, key) => value?.[key], data);
}

function evaluateRule(rule, input) {
  const actual = getValue(input, rule.field);
  const expected = rule.value;

  switch (rule.operator) {
    case "greaterThan":
      return actual > expected;
    case "greaterThanOrEqual":
      return actual >= expected;
    case "lessThan":
      return actual < expected;
    case "lessThanOrEqual":
      return actual <= expected;
    case "equals":
      return actual === expected;
    case "notEquals":
      return actual !== expected;
    case "exists":
      return actual !== undefined && actual !== null;
    default:
      throw new Error(`Unsupported rule operator: ${rule.operator}`);
  }
}

function evaluateRules(rules, input) {
  const results = rules.map((rule) => {
    const passed = evaluateRule(rule, input);

    return {
      ruleId: rule.ruleId,
      name: rule.name,
      field: rule.field,
      operator: rule.operator,
      expectedValue: rule.value,
      actualValue: getValue(input, rule.field),
      passed,
      outcome: rule.outcome
    };
  });

  const failedRules = results.filter((result) => !result.passed);

  // REJECTED takes priority over MANUAL_REVIEW.
  let decision = "APPROVED";

  if (failedRules.some((rule) => rule.outcome === "REJECTED")) {
    decision = "REJECTED";
  } else if (failedRules.some((rule) => rule.outcome === "MANUAL_REVIEW")) {
    decision = "MANUAL_REVIEW";
  }

  const explanation = results.map((result) => {
    return `${result.name}: ${result.passed ? "Passed" : "Failed"} (actual: ${result.actualValue}, expected: ${result.operator} ${result.expectedValue})`;
  });

  return { decision, results, explanation };
}

module.exports = { evaluateRules };