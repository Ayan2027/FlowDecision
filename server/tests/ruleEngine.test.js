
const { evaluateRules } = require("../src/services/ruleEngine");

describe("FlowDecision Rule Engine", () => {
  const rules = [
    {
      ruleId: "AGE001",
      name: "Minimum age",
      field: "age",
      operator: "greaterThanOrEqual",
      value: 21,
      outcome: "REJECTED"
    },
    {
      ruleId: "INCOME001",
      name: "Minimum income",
      field: "monthlyIncome",
      operator: "greaterThanOrEqual",
      value: 25000,
      outcome: "REJECTED"
    },
    {
      ruleId: "DOC001",
      name: "Document verification",
      field: "documentsVerified",
      operator: "equals",
      value: true,
      outcome: "MANUAL_REVIEW"
    }
  ];

  test("approves an eligible application", () => {
    const result = evaluateRules(rules, {
      age: 25,
      monthlyIncome: 40000,
      documentsVerified: true
    });

    expect(result.decision).toBe("APPROVED");
    expect(result.results.every(rule => rule.passed)).toBe(true);
  });

  test("rejects an application below minimum income", () => {
    const result = evaluateRules(rules, {
      age: 25,
      monthlyIncome: 15000,
      documentsVerified: true
    });

    expect(result.decision).toBe("REJECTED");
    expect(result.results[1].passed).toBe(false);
  });

  test("sends an application for manual review when documents are unverified", () => {
    const result = evaluateRules(rules, {
      age: 25,
      monthlyIncome: 40000,
      documentsVerified: false
    });

    expect(result.decision).toBe("MANUAL_REVIEW");
    expect(result.results[2].passed).toBe(false);
  });

  test("rejection takes priority over manual review", () => {
    const result = evaluateRules(rules, {
      age: 25,
      monthlyIncome: 15000,
      documentsVerified: false
    });

    expect(result.decision).toBe("REJECTED");
  });

  test("rejects an applicant below the minimum age", () => {
    const result = evaluateRules(rules, {
      age: 18,
      monthlyIncome: 40000,
      documentsVerified: true
    });

    expect(result.decision).toBe("REJECTED");
    expect(result.results[0].passed).toBe(false);
  });

  test("returns an explanation for every evaluated rule", () => {
    const result = evaluateRules(rules, {
      age: 25,
      monthlyIncome: 40000,
      documentsVerified: true
    });

    expect(result.explanation).toHaveLength(3);
    expect(result.explanation[0]).toContain("Minimum age");
  });

  test("supports nested input fields", () => {
    const nestedRules = [
      {
        ruleId: "CITY001",
        name: "City check",
        field: "applicant.city",
        operator: "equals",
        value: "Kolkata",
        outcome: "REJECTED"
      }
    ];

    const result = evaluateRules(nestedRules, {
      applicant: { city: "Kolkata" }
    });

    expect(result.decision).toBe("APPROVED");
  });

  test("throws an error for unsupported operators", () => {
    const invalidRules = [
      {
        ruleId: "INVALID",
        name: "Invalid rule",
        field: "age",
        operator: "unknownOperator",
        value: 21,
        outcome: "REJECTED"
      }
    ];

    expect(() =>
      evaluateRules(invalidRules, { age: 25 })
    ).toThrow("Unsupported rule operator");
  });
});
