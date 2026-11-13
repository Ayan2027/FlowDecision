
const mongoose = require("mongoose");

const executionSchema = new mongoose.Schema(
  {
    workflowId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workflow",
      required: true
    },
    workflowVersion: Number,

    applicationId: String,

    input: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },

    decision: {
      type: String,
      enum: ["APPROVED", "REJECTED", "MANUAL_REVIEW", "PROCESSING"],
      default: "PROCESSING"
    },

    status: {
      type: String,
      enum: ["IN_PROGRESS", "COMPLETED", "FAILED"],
      default: "IN_PROGRESS"
    },

    explanation: {
      type: [String],
      default: []
    },

    stageResults: {
      type: Array,
      default: []
    },

    configSnapshot: {
      type: mongoose.Schema.Types.Mixed
    },

    idempotencyKey: String,

    retryCount: {
      type: Number,
      default: 0
    },

    error: String,

    completedAt: Date
  },
  { timestamps: true }
);

// Prevent duplicate requests for the same workflow and idempotency key.
executionSchema.index(
  { idempotencyKey: 1, workflowId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      idempotencyKey: { $type: "string" }
    }
  }
);

module.exports = mongoose.model("Execution", executionSchema);
