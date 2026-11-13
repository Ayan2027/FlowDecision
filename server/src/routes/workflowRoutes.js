const express = require("express");
const Workflow = require("../models/Workflow");

const router = express.Router();

// Get all workflows
router.get("/", async (req, res, next) => {
  try {
    const workflows = await Workflow.find().sort({ createdAt: -1 });
    res.json({ success: true, data: workflows });
  } catch (error) {
    next(error);
  }
});

// Get one workflow
router.get("/:id", async (req, res, next) => {
  try {
    const workflow = await Workflow.findById(req.params.id);

    if (!workflow) {
      return res.status(404).json({ success: false, message: "Workflow not found" });
    }

    res.json({ success: true, data: workflow });
  } catch (error) {
    next(error);
  }
});

// Create a workflow
router.post("/", async (req, res, next) => {
  try {
    const { name, description, rules, stages } = req.body;

    if (!name || !Array.isArray(rules)) {
      return res.status(422).json({
        success: false,
        message: "Name and rules array are required"
      });
    }

    const workflow = await Workflow.create({
      name,
      description,
      rules,
      stages: stages || []
    });

    res.status(201).json({ success: true, data: workflow });
  } catch (error) {
    next(error);
  }
});

// Update workflow configuration and increment its version
router.put("/:id", async (req, res, next) => {
  try {
    const workflow = await Workflow.findById(req.params.id);

    if (!workflow) {
      return res.status(404).json({ success: false, message: "Workflow not found" });
    }

    if (req.body.name !== undefined) workflow.name = req.body.name;
    if (req.body.description !== undefined) workflow.description = req.body.description;
    if (req.body.rules !== undefined) workflow.rules = req.body.rules;
    if (req.body.stages !== undefined) workflow.stages = req.body.stages;
    if (req.body.active !== undefined) workflow.active = req.body.active;

    workflow.version += 1;
    await workflow.save();

    res.json({ success: true, data: workflow });
  } catch (error) {
    next(error);
  }
});

module.exports = router;