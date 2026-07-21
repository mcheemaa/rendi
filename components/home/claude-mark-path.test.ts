import { describe, expect, it } from "vitest";
import { CLAUDE_MARK_D } from "./claude-mark-d";
import { morphClaudePath, parseClaudePath } from "./claude-mark-path";

const ZERO = { inOut: 0, turn: 0, breathe: 0 };

describe("claude mark morph", () => {
	it("parses the official path completely", () => {
		const commands = parseClaudePath(CLAUDE_MARK_D);
		expect(commands).not.toBeNull();
		expect(commands?.[0].op).toBe("M");
		expect(commands?.at(-1)?.op).toBe("Z");
		for (const cmd of commands ?? []) {
			for (const p of cmd.polar) {
				expect(Number.isFinite(p.r)).toBe(true);
				expect(Number.isFinite(p.a)).toBe(true);
			}
		}
	});

	// H/V shorthands normalize to L pairs, so string identity is not the
	// contract; geometric identity through a parse round-trip is.
	it("is the official geometry exactly at zero amplitude", () => {
		const commands = parseClaudePath(CLAUDE_MARK_D);
		if (!commands) throw new Error("parse failed");
		const roundTrip = parseClaudePath(morphClaudePath(commands, 12.34, ZERO));
		if (!roundTrip) throw new Error("round-trip parse failed");
		expect(roundTrip.length).toBe(commands.length);
		for (let i = 0; i < commands.length; i++) {
			expect(roundTrip[i].op).toBe(commands[i].op);
			expect(roundTrip[i].polar.length).toBe(commands[i].polar.length);
			for (let j = 0; j < commands[i].polar.length; j++) {
				expect(
					Math.abs(roundTrip[i].polar[j].r - commands[i].polar[j].r),
				).toBeLessThan(0.02);
			}
		}
	});

	it("stays finite and structurally intact at live amplitudes", () => {
		const commands = parseClaudePath(CLAUDE_MARK_D);
		if (!commands) throw new Error("parse failed");
		for (const t of [0, 1.7, 9.2, 48.6]) {
			const d = morphClaudePath(commands, t, {
				inOut: 0.024,
				turn: 0.017,
				breathe: 0.013,
			});
			expect(d).not.toContain("NaN");
			expect(d.match(/[MZ]/g)?.length).toBe(
				CLAUDE_MARK_D.match(/[MZz]/g)?.length,
			);
		}
	});
});
