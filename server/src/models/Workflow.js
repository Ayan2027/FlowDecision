const mongoose = require("mongoose");

const workflowSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      default: ""
    },
    version: {
      type: Number,
      default: 1
    },
    active: {
      type: Boolean,
      default: true
    },
    rules: {
      type: Array,
      default: []
    },
    stages: {
      type: Array,
      default: []
    },
    createdBy: {
      type: String,
      default: "admin"
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Workflow", workflowSchema);