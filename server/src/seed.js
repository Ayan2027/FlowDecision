stages: [
  {
    name: "Eligibility Check",
    order: 1,
    ruleIds: ["AGE001", "INCOME001"]
  },
  {
    name: "Document Verification",
    order: 2,
    ruleIds: ["DOC001"],
    skipIfDecision: "REJECTED"
  },
  {
    name: "Final Decision",
    order: 3,
    ruleIds: []
  }
]