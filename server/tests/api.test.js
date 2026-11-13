
const request = require("supertest");
const app = require("../src/app");

describe("FlowDecision API integration tests", () => {
  test("health endpoint responds successfully", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  test("rejects an invalid workflow ID", async () => {
    const response = await request(app)
      .post("/api/executions")
      .send({
        workflowId: "invalid-id",
        input: {}
      });

    expect(response.status).toBe(422);
    expect(response.body.success).toBe(false);
  });

  test("rejects negative age and income", async () => {
    const response = await request(app)
      .post("/api/executions")
      .send({
        workflowId: "6af6e55e159832ddd975b321",
        input: {
          applicationId: "TEST-001",
          age: -5,
          monthlyIncome: -1000,
          documentsVerified: true
        }
      });

    expect(response.status).toBe(422);
    expect(response.body.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Age"),
        expect.stringContaining("Monthly income")
      ])
    );
  });

  test("rejects missing required application fields", async () => {
    const response = await request(app)
      .post("/api/executions")
      .send({
        workflowId: "6af6e55e159832ddd975b321",
        input: {
          applicationId: "TEST-002"
        }
      });

    expect(response.status).toBe(422);
    expect(response.body.errors.length).toBeGreaterThan(0);
  });

  test("returns 404 for an unknown route", async () => {
    const response = await request(app).get("/api/unknown-route");

    expect(response.status).toBe(404);
  });
});
