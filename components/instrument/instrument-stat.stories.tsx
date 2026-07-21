import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { InstrumentStat } from "./instrument-stat";

const meta = {
	title: "Instrument/InstrumentStat",
	component: InstrumentStat,
	parameters: { layout: "padded" },
} satisfies Meta<typeof InstrumentStat>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Tiles: Story = {
	args: {
		present: { kind: "stat", valueField: "value", labelField: "metric" },
		result: {
			rows: [
				{ metric: "spend ($)", value: 12.28 },
				{ metric: "tokens", value: 1804211 },
				{ metric: "sessions", value: 41 },
				{ metric: "tool calls", value: 244 },
			],
			stats: { elapsedMs: 12, readRows: 4 },
		} as never,
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText("12.28")).toBeVisible();
		await expect(canvas.getByText("1,804,211")).toBeVisible();
		await expect(canvas.getByText("sessions")).toBeVisible();
	},
};
