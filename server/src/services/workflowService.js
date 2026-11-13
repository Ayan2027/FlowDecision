
const Workflow = require("../models/Workflow");
const Execution = require("../models/Execution");
const AuditLog = require("../models/AuditLog");
const { evaluateRules } = require("./ruleEngine");

function getFinalDecision(decisions) {
  if (decisions.includes("REJECTED")) return "REJECTED";
  if (decisions.includes("MANUAL_REVIEW")) return "MANUAL_REVIEW";
  return "APPROVED";
}

async function processExecution(execution, config) {
  try {
    execution.status = "IN_PROGRESS";
    execution.decision = "PROCESSING";
    execution.error = undefined;
    execution.explanation = [];
    execution.stageResults = [];
    await execution.save();

    const rules = config.rules || [];
    const stages = [...(config.stages || [])].sort(
      (a, b) => (a.order || 0) - (b.order || 0)
    );

    // Backward compatibility for workflows without rule assignments.
    const hasAssignments = stages.some(
      (stage) => Array.isArray(stage.ruleIds) && stage.ruleIds.length > 0
    );

    const decisions = [];
    const explanations = [];
    const allRuleResults = [];

    for (let index = 0; index < stages.length; index++) {
      const stage = stages[index];

      // Conditional branching: skip stages when a previous decision matches.
      const previousDecision = getFinalDecision(decisions);

      if (
        stage.skipIfDecision &&
        decisions.includes(stage.skipIfDecision)
      ) {
        execution.stageResults.push({
          stageName: stage.name,
          order: stage.order,
          status: "SKIPPED",
          decision: previousDecision,
          ruleResults: []
        });

        await execution.save();

        await AuditLog.create({
          executionId: execution._id,
          action: "STAGE_SKIPPED",
          details: {
            stage: stage.name,
            reason: `Previous decision was ${stage.skipIfDecision}`
          }
        });

        continue;
      }

      const stageRules = hasAssignments
        ? rules.filter((rule) => (stage.ruleIds || []).includes(rule.ruleId))
        : index === 0
          ? rules
          : [];

      const startedAt = new Date();
      let result = {
        decision: "APPROVED",
        explanation: [],
        results: []
      };

      if (stageRules.length > 0) {
        result = evaluateRules(stageRules, execution.input);
      }

      decisions.push(result.decision);
      explanations.push(...result.explanation);
      allRuleResults.push(...result.results);

      execution.stageResults.push({
        stageName: stage.name,
        order: stage.order,
        status: "COMPLETED",
        decision: result.decision,
        ruleResults: result.results,
        startedAt,
        completedAt: new Date()
      });

      await execution.save();

      await AuditLog.create({
        executionId: execution._id,
        action: "STAGE_COMPLETED",
        details: {
          stage: stage.name,
          decision: result.decision,
          rulesEvaluated: result.results.length
        }
      });
    }

    // Also support workflows that have rules but no stages.
    if (stages.length === 0) {
      const result = evaluateRules(rules, execution.input);
      decisions.push(result.decision);
      explanations.push(...result.explanation);
      allRuleResults.push(...result.results);
    }

    execution.decision = getFinalDecision(decisions);
    execution.status = "COMPLETED";
    execution.explanation = explanations;
    execution.completedAt = new Date();

    await execution.save();

    await AuditLog.create({
      executionId: execution._id,
      action: "EXECUTION_COMPLETED",
      details: {
        decision: execution.decision,
        stagesExecuted: execution.stageResults.filter(
          (stage) => stage.status === "COMPLETED"
        ).length,
        rulesEvaluated: allRuleResults.length
      }
    });

    return execution;
  } catch (error) {
    execution.status = "FAILED";
    execution.error = error.message;
    await execution.save();

    await AuditLog.create({
      executionId: execution._id,
      action: "EXECUTION_FAILED",
      details: { error: error.message }
    });

    throw error;
  }
}

async function executeWorkflow({ workflowId, input, idempotencyKey }) {
  const workflow = await Workflow.findById(workflowId);

  if (!workflow || !workflow.active) {
    const error = new Error("Active workflow not found");
    error.statusCode = 404;
    throw error;
  }

  if (idempotencyKey) {
    const existing = await Execution.findOne({ workflowId, idempotencyKey });

    if (existing) {
      if (existing.status === "COMPLETED") {
        return { execution: existing, duplicate: true };
      }

      const error = new Error("This request is already being processed");
      error.statusCode = 409;
      throw error;
    }
  }

  let execution;

  try {
    execution = await Execution.create({
      workflowId,
      workflowVersion: workflow.version,
      applicationId: input.applicationId || "",
      input,
      configSnapshot: {
        name: workflow.name,
        version: workflow.version,
        rules: workflow.rules,
        stages: workflow.stages
      },
      idempotencyKey
    });
  } catch (error) {
    if (error.code === 11000 && idempotencyKey) {
      const existing = await Execution.findOne({ workflowId, idempotencyKey });

      if (existing?.status === "COMPLETED") {
        return { execution: existing, duplicate: true };
      }

      const conflict = new Error("This request is already being processed");
      conflict.statusCode = 409;
      throw conflict;
    }

    throw error;
  }

  await AuditLog.create({
    executionId: execution._id,
    action: "EXECUTION_STARTED",
    details: { workflowName: workflow.name }
  });

  const completed = await processExecution(execution, execution.configSnapshot);
  return { execution: completed, duplicate: false };
}

async function retryExecution(executionId) {
  const execution = await Execution.findById(executionId);

  if (!execution) {
    const error = new Error("Execution not found");
    error.statusCode = 404;
    throw error;
  }

  if (execution.status !== "FAILED") {
    const error = new Error("Only failed executions can be retried");
    error.statusCode = 409;
    throw error;
  }

  if (!execution.configSnapshot) {
    const error = new Error("Execution configuration snapshot is missing");
    error.statusCode = 400;
    throw error;
  }

  execution.retryCount = (execution.retryCount || 0) + 1;

  await AuditLog.create({
    executionId: execution._id,
    action: "EXECUTION_RETRY_STARTED",
    details: { retryCount: execution.retryCount }
  });

  const completed = await processExecution(
    execution,
    execution.configSnapshot
  );

  return completed;
}

module.exports = { executeWorkflow, retryExecution };
