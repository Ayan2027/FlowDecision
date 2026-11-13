const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    executionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Execution"
    },
    action: {
      type: String,
      required: true
    },
    actor: {
      type: String,
      default: "system"
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("AuditLog", auditLogSchema);