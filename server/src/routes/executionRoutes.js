
const express = require("express");
const mongoose = require("mongoose");

const Execution = require("../models/Execution");
const AuditLog = require("../models/AuditLog");

const {
  executeWorkflow,
  retryExecution
} = require("../services/workflowService");

const router = express.Router();

// Submit an application for workflow evaluation
router.post("/", async (req, res, next) => {
  try {
    const { workflowId, input } = req.body || {};
    const errors = [];

    // Validate workflow ID
    if (!workflowId || !mongoose.Types.ObjectId.isValid(workflowId)) {
      errors.push("A valid workflowId is required.");
    }

    // Validate input object
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      errors.push("Input must be a valid object.");
    } else {
      if (
        typeof input.applicationId !== "string" ||
        !input.applicationId.trim()
      ) {
        errors.push("Application ID is required.");
      }

      if (
        input.age === undefined ||
        typeof input.age !== "number" ||
        !Number.isFinite(input.age) ||
        input.age < 18 ||
        input.age > 120
      ) {
        errors.push("Age must be a number between 18 and 120.");
      }

      if (
        input.monthlyIncome === undefined ||
        typeof input.monthlyIncome !== "number" ||
        !Number.isFinite(input.monthlyIncome) ||
        input.monthlyIncome < 0
      ) {
        errors.push("Monthly income must be a non-negative number.");
      }

      if (typeof input.documentsVerified !== "boolean") {
        errors.push("documentsVerified must be true or false.");
      }
    }

    // Invalid requests are never saved.
    if (errors.length > 0) {
      return res.status(422).json({
        success: false,
        message: "Application validation failed.",
        errors
      });
    }

    const result = await executeWorkflow({
      workflowId,
      input,
      idempotencyKey: req.get("Idempotency-Key")
    });

    res.status(result.duplicate ? 200 : 201).json({
      success: true,
      duplicate: result.duplicate,
      data: result.execution
    });
  } catch (error) {
    next(error);
  }
});

// Get execution history
router.get("/", async (req, res, next) => {
  try {
    const executions = await Execution.find()
      .populate("workflowId", "name")
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({
      success: true,
      data: executions
    });
  } catch (error) {
    next(error);
  }
});

// Retry a failed execution
router.post("/:id/retry", async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(422).json({
        success: false,
        message: "Invalid execution ID."
      });
    }

    const execution = await retryExecution(req.params.id);

    res.json({
      success: true,
      message: "Execution retried successfully.",
      data: execution
    });
  } catch (error) {
    next(error);
  }
});

// Get audit history for an execution
router.get("/:id/audit", async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(422).json({
        success: false,
        message: "Invalid execution ID."
      });
    }

    const logs = await AuditLog.find({
      executionId: req.params.id
    }).sort({ createdAt: 1 });

    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    next(error);
  }
});

// Get a specific execution
router.get("/:id", async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(422).json({
        success: false,
        message: "Invalid execution ID."
      });
    }

    const execution = await Execution.findById(req.params.id);

    if (!execution) {
      return res.status(404).json({
        success: false,
        message: "Execution not found."
      });
    }

    res.json({
      success: true,
      data: execution
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
