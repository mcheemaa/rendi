import { z } from "zod";

export const instrumentSpec = z.object({
	title: z.string(),
	sql: z
		.string()
		.describe(
			"ClickHouse SQL. Use a {name:Type} placeholder for any value a user would plausibly steer (time windows, limits, thresholds) and declare it in params. Plain SQL with no placeholders is fine when nothing needs steering.",
		),
	params: z
		.array(
			z.object({
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
			}),
		)
		.default([])
		.describe(
			"Only what the user should steer. Omit when nothing needs controls.",
		),
	chart: z
		.object({
			type: z.enum(["bar", "line", "area"]),
			xField: z.string(),
			yField: z.string(),
		})
		.optional()
		.describe("Omit when a table is the right presentation."),
});

export type InstrumentSpec = z.infer<typeof instrumentSpec>;

export type Instrument = InstrumentSpec & {
	id: string;
	version: number;
};
