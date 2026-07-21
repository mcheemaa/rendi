import { z } from "zod";

const chartShape = z.object({
	type: z.enum(["bar", "line", "area"]),
	xField: z.string(),
	yField: z.string(),
});

export const present = z.discriminatedUnion("kind", [
	chartShape.extend({ kind: z.literal("chart") }),
	z.object({ kind: z.literal("table") }),
]);

export type Present = z.infer<typeof present>;

export const instrumentSpec = z.object({
	title: z.string(),
	sql: z
		.string()
		.describe(
			"ClickHouse SQL. Use a {name:Type} placeholder for any value a user would plausibly steer (time windows, limits, thresholds) and declare it in params. Plain SQL with no placeholders is fine when nothing needs steering.",
		),
	params: z
		.array(
			z
				.object({
					name: z.string(),
					type: z
						.string()
						.describe("ClickHouse type, e.g. DateTime, UInt32, String"),
					control: z.enum(["timerange", "select", "text", "number"]),
					defaultValue: z
						.string()
						.describe(
							"A bindable literal, never a SQL expression. DateTime params take ISO 8601 or a relative token: now, now-30d, now-12h, now-45m, now-2w. Numeric params take the number as a string.",
						),
					options: z
						.array(z.string())
						.optional()
						.describe(
							"The choices a select control offers, as bindable literals. Required when control is select.",
						),
				})
				.superRefine((param, ctx) => {
					if (param.control === "select" && !param.options?.length) {
						ctx.addIssue({
							code: "custom",
							message: "a select control declares its options",
						});
					}
				}),
		)
		.default([])
		.describe(
			"Only what the user should steer. Omit when nothing needs controls.",
		),
	present: present
		.optional()
		.describe(
			'How the result renders: {kind:"chart"} with type, xField, yField when a visual fits. Omit when a table is the honest presentation.',
		),
});

export type InstrumentSpec = z.infer<typeof instrumentSpec>;

// Payloads persisted before the present lift carry the retired chart field;
// they must parse forever. Render surfaces parse with this schema and
// normalize through presentOf; the tool schema stays the clean shape above.
export const persistedInstrumentSpec = instrumentSpec.extend({
	chart: chartShape.optional(),
});

export type PersistedInstrumentSpec = z.infer<typeof persistedInstrumentSpec>;

export function presentOf(spec: PersistedInstrumentSpec): Present {
	if (spec.present) return spec.present;
	if (spec.chart) return { kind: "chart", ...spec.chart };
	return { kind: "table" };
}

export type Instrument = PersistedInstrumentSpec & {
	id: string;
	version: number;
};
