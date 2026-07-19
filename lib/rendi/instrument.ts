import { z } from "zod";

export const instrumentSpec = z.object({
	title: z.string(),
	sql: z
		.string()
		.describe(
			"ClickHouse SQL with a {name:Type} placeholder for every parameter, e.g. WHERE ts >= {from:DateTime}",
		),
	params: z.array(
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
	),
	chart: z.object({
		type: z.enum(["bar", "line", "area"]),
		xField: z.string(),
		yField: z.string(),
	}),
});

export type InstrumentSpec = z.infer<typeof instrumentSpec>;

export type Instrument = InstrumentSpec & {
	id: string;
	version: number;
};
