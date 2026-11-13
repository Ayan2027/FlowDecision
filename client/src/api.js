import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5000/api",
  headers: {
    "Content-Type": "application/json"
  }
});

export const getWorkflows = () => api.get("/workflows");
export const getExecutions = () => api.get("/executions");

export const submitApplication = (workflowId, input) =>
  api.post("/executions", { workflowId, input });

export const updateWorkflow = (id, data) =>
  api.put(`/workflows/${id}`, data);

export const getAuditLogs = (executionId) =>
  api.get(`/executions/${executionId}/audit`);

export default api;