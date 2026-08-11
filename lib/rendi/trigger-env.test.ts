import { afterEach, describe, expect, it } from "vitest";
import { isArchived } from "./archive.ts";
import { envFromKey, triggerEnv } from "./trigger-env.ts";

const ORIGINAL = process.env.TRIGGER_SECRET_KEY;

afterEach(() => {
	if (ORIGINAL === undefined) delete process.env.TRIGGER_SECRET_KEY;
	else process.env.TRIGGER_SECRET_KEY = ORIGINAL;
});

describe("envFromKey", () => {
	it("reads the environment segment from the key prefix", () => {
		expect(envFromKey("tr_dev_abc123")).toBe("dev");
		expect(envFromKey("tr_prod_abc123")).toBe("prod");
	});

	it("passes future environments through instead of guessing", () => {
		expect(envFromKey("tr_stg_abc123")).toBe("stg");
	});

	it("throws on a key with no environment prefix", () => {
		expect(() => envFromKey("sk_live_nope")).toThrow(/prefix/);
	});
});

describe("triggerEnv", () => {
	it("reads the process key", () => {
		process.env.TRIGGER_SECRET_KEY = "tr_dev_xyz";
		expect(triggerEnv()).toBe("dev");
	});

	it("throws when the key is missing", () => {
		delete process.env.TRIGGER_SECRET_KEY;
		expect(() => triggerEnv()).toThrow(/not set/);
	});
});

describe("isArchived", () => {
	it("archives only across environments, in both directions", () => {
		process.env.TRIGGER_SECRET_KEY = "tr_prod_xyz";
		expect(isArchived("dev")).toBe(true);
		expect(isArchived("prod")).toBe(false);
		process.env.TRIGGER_SECRET_KEY = "tr_dev_xyz";
		expect(isArchived("prod")).toBe(true);
		expect(isArchived("dev")).toBe(false);
	});
});
