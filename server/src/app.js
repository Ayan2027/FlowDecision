const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const workflowRoutes = require("./routes/workflowRoutes");
const executionRoutes = require("./routes/executionRoutes");
const errorHandler = require("./middleware/errorHandler");

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173"
}));
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "FlowDecision API is running"
  });
});

app.use("/api/workflows", workflowRoutes);
app.use("/api/executions", executionRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found"
  });
});

app.use(errorHandler);

module.exports = app;