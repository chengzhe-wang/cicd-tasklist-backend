import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import testPrisma from "./setup.js";

// Mock the prisma singleton to use the test client
vi.mock("../../lib/prisma.js", () => ({
	default: testPrisma,
}));

// Import app AFTER mocking prisma
const { default: app } = await import("../../app.js");
import request from "supertest";

describe("Task API E2E Tests", () => {
	beforeEach(async () => {
		// Clean up database between tests
		await testPrisma.task.deleteMany();
	});

	afterAll(async () => {
		await testPrisma.$disconnect();
	});

	describe("POST /api/tasks", () => {
		it("should create a new task", async () => {
			const res = await request(app)
				.post("/api/tasks")
				.send({ title: "E2E Task", description: "E2E Description" });

			expect(res.status).toBe(201);
			expect(res.body).toHaveProperty("id");
			expect(res.body.title).toBe("E2E Task");
			expect(res.body.description).toBe("E2E Description");
			expect(res.body.completed).toBe(false);
		});
	});

	describe("GET /api/tasks", () => {
		it("should return all tasks", async () => {
			await testPrisma.task.create({
				data: {
					title: "First task",
					description: "First description",
				},
			});

			const res = await request(app).get("/api/tasks");

			expect(res.status).toBe(200);
			expect(Array.isArray(res.body)).toBe(true);
			expect(res.body).toHaveLength(1);
			expect(res.body[0].title).toBe("First task");
		});
	});

	describe("GET /api/tasks/:id", () => {
		it("should return a task when it exists", async () => {
			const task = await testPrisma.task.create({
				data: {
					title: "Task by id",
					description: "Find me",
				},
			});

			const res = await request(app).get(`/api/tasks/${task.id}`);

			expect(res.status).toBe(200);
			expect(res.body.id).toBe(task.id);
			expect(res.body.title).toBe("Task by id");
			expect(res.body.description).toBe("Find me");
		});

		it("should return 400 when the task id is invalid", async () => {
			const res = await request(app).get("/api/tasks/abc");

			expect(res.status).toBe(400);
			expect(res.body).toEqual({ error: "Invalid task ID" });
		});

		it("should return 404 when the task does not exist", async () => {
			const res = await request(app).get("/api/tasks/999999");

			expect(res.status).toBe(404);
			expect(res.body).toEqual({ error: "Task not found" });
		});
	});

	describe("POST /api/tasks validation", () => {
		it("should reject an empty title", async () => {
			const res = await request(app)
				.post("/api/tasks")
				.send({ title: "   ", description: "Invalid" });

			expect(res.status).toBe(400);
			expect(res.body).toEqual({
				error: "Title is required and must be a non-empty string",
			});
		});
	});

	describe("PUT /api/tasks/:id", () => {
		it("should update an existing task", async () => {
			const task = await testPrisma.task.create({
				data: {
					title: "Old title",
					description: "Old description",
				},
			});

			const res = await request(app)
				.put(`/api/tasks/${task.id}`)
				.send({
					title: "Updated title",
					description: "Updated description",
					completed: true,
				});

			expect(res.status).toBe(200);
			expect(res.body.id).toBe(task.id);
			expect(res.body.title).toBe("Updated title");
			expect(res.body.description).toBe("Updated description");
			expect(res.body.completed).toBe(true);
		});

		it("should return 404 when updating a missing task", async () => {
			const res = await request(app)
				.put("/api/tasks/999999")
				.send({ title: "Updated title" });

			expect(res.status).toBe(404);
			expect(res.body).toEqual({ error: "Task not found" });
		});

		it("should return 400 when updating with an invalid id", async () => {
			const res = await request(app)
				.put("/api/tasks/abc")
				.send({ title: "Updated title" });

			expect(res.status).toBe(400);
			expect(res.body).toEqual({ error: "Invalid task ID" });
		});
	});

	describe("DELETE /api/tasks/:id", () => {
		it("should delete an existing task", async () => {
			const task = await testPrisma.task.create({
				data: {
					title: "Delete me",
					description: "Temporary task",
				},
			});

			const deleteRes = await request(app).delete(`/api/tasks/${task.id}`);
			const getRes = await request(app).get(`/api/tasks/${task.id}`);

			expect(deleteRes.status).toBe(204);
			expect(deleteRes.text).toBe("");
			expect(getRes.status).toBe(404);
		});

		it("should return 400 when deleting with an invalid id", async () => {
			const res = await request(app).delete("/api/tasks/abc");

			expect(res.status).toBe(400);
			expect(res.body).toEqual({ error: "Invalid task ID" });
		});
	});
});
