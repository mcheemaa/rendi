import { beforeEach, describe, expect, it, vi } from "vitest";

const applyCanvasEntry = vi.hoisted(() => vi.fn());
const loadCanvas = vi.hoisted(() => vi.fn());

vi.mock("@/lib/rendi/harness/canvas-db", () => ({
	applyCanvasEntry,
	loadCanvas,
}));

import { GET, POST } from "./route.ts";

const params = { params: Promise.resolve({ id: "conv-1" }) };

beforeEach(() => {
	applyCanvasEntry.mockReset();
	loadCanvas.mockReset();
});

describe("canvas ops route", () => {
	it("returns null before the canvas exists", async () => {
		loadCanvas.mockResolvedValue(undefined);
		const response = await GET(new Request("http://rendi.local"), params);
		expect(await response.json()).toBeNull();
	});

	it("applies a user entry through the single writer", async () => {
		applyCanvasEntry.mockResolvedValue({ doc: { version: 3 }, version: 3 });
		const response = await POST(
			new Request("http://rendi.local", {
				method: "POST",
				body: JSON.stringify({
					baseVersion: 2,
					entry: { op: "place", id: "a", x: 640 },
				}),
			}),
			params,
		);

		expect(response.status).toBe(200);
		expect(applyCanvasEntry).toHaveBeenCalledWith(
			"conv-1",
			{ op: "place", id: "a", x: 640 },
			"user",
		);
	});

	it("rejects malformed entries without writing", async () => {
		const response = await POST(
			new Request("http://rendi.local", {
				method: "POST",
				body: JSON.stringify({ baseVersion: 0, entry: { op: "explode" } }),
			}),
			params,
		);
		expect(response.status).toBe(400);
		expect(applyCanvasEntry).not.toHaveBeenCalled();
	});
});
