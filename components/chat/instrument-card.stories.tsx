import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { InstrumentCard } from "./instrument-card";

const meta = {
	title: "Chat/InstrumentCard",
	component: InstrumentCard,
	parameters: { layout: "padded" },
} satisfies Meta<typeof InstrumentCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BarChart: Story = {
	args: {
		instrument: {
			id: "d8a071da-65cc-4ffa-ada2-eccde826b4cd",
			version: 1,
			title: "Top authors by commit count",
			sql: "SELECT author, count() AS commits\nFROM git.commits\nGROUP BY author\nORDER BY commits DESC\nLIMIT {top_n:UInt32}",
			params: [
				{
					name: "top_n",
					type: "UInt32",
					control: "number",
					defaultValue: "3",
				},
			],
			chart: { type: "bar", xField: "author", yField: "commits" },
		},
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText("Top authors by commit count")).toBeVisible();
		await expect(canvas.getByText("top_n")).toBeVisible();
		await expect(canvas.getByText(/bar · author × commits/)).toBeVisible();
		await expect(
			canvas.getByText(/rendi sees how you steer this/),
		).toBeVisible();
	},
};

export const PlainTable: Story = {
	args: {
		instrument: {
			id: "spec-table",
			version: 1,
			title: "What I can query",
			sql: "SELECT database, name FROM system.tables WHERE database NOT IN ('system')",
			params: [],
		},
	},
	play: async ({ canvasElement }) => {
		await expect(within(canvasElement).getByText("table")).toBeVisible();
	},
};
