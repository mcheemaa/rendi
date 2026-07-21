import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { installExecMock } from "@/components/instrument/story-fixtures";
import { InstrumentCard } from "./instrument-card";

const meta = {
	title: "Chat/InstrumentCard",
	component: InstrumentCard,
	parameters: {
		layout: "padded",
		a11y: {
			config: {
				// Shiki token palette in the Query tab is scoped out until the
				// Ember shiki theme lands; everything else is gated.
				rules: [{ id: "color-contrast", selector: "*:not(pre span)" }],
			},
		},
	},
	decorators: [
		(Story) => {
			installExecMock();
			return <Story />;
		},
	],
} satisfies Meta<typeof InstrumentCard>;

export default meta;
type Story = StoryObj<typeof meta>;

const topAuthors = {
	id: "d8a071da-65cc-4ffa-ada2-eccde826b4cd",
	version: 1,
	title: "Top authors by commit count",
	sql: "SELECT author, count() AS commits\nFROM git.commits\nGROUP BY author\nORDER BY commits DESC\nLIMIT {top_n:UInt32}",
	params: [
		{
			name: "top_n",
			type: "UInt32",
			control: "number" as const,
			defaultValue: "3",
		},
	],
	present: {
		kind: "chart" as const,
		type: "bar" as const,
		xField: "author",
		yField: "commits",
	},
};

export const Live: Story = {
	args: { instrument: topAuthors, conversationId: "storybook" },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		// ECharts aria narrates the actual data to screen readers, replacing
		// the static label; asserting on it proves the chart drew real rows.
		const chart = await canvas.findByRole("img");
		await waitFor(() => expect(chart.querySelector("svg")).toBeTruthy());
		await waitFor(() => expect(chart).toHaveAccessibleName(/Matt Aitken/));
		await expect(canvas.getByText("3 rows · 41 ms")).toBeVisible();

		// Steering re-executes with the model out of the loop: the fixture
		// answers with six rows, and both the footer and the chart's own
		// narration repaint.
		const control = canvas.getByRole("textbox", { name: "top_n" });
		await userEvent.clear(control);
		await userEvent.type(control, "6{Enter}");
		await expect(await canvas.findByText("6 rows · 41 ms")).toBeVisible();
		await waitFor(() => expect(chart).toHaveAccessibleName(/samejr/));

		await userEvent.click(canvas.getByRole("tab", { name: "Table" }));
		await expect(await canvas.findByText("2,479")).toBeVisible();

		await userEvent.click(canvas.getByRole("tab", { name: "Query" }));
		await expect(canvas.getByText("Completed")).toBeVisible();
		await expect(canvas.getByText("7,641")).toBeVisible();
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
		conversationId: "storybook",
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.queryByRole("tab", { name: "Chart" }),
		).not.toBeInTheDocument();
		await expect(await canvas.findByText("nyc_taxi")).toBeVisible();
		await expect(
			canvas.getByText(/rendi sees how you steer this/),
		).toBeVisible();
	},
};

export const ExecError: Story = {
	args: {
		instrument: {
			...topAuthors,
			id: "spec-error",
			title: "A broken instrument",
			sql: "SELECT boom FROM git.commits LIMIT {top_n:UInt32}",
		},
		conversationId: "storybook",
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			await canvas.findByText(/Unknown identifier 'boom'/),
		).toBeVisible();
	},
};

// Payloads persisted before the present lift carry `chart`; the card must
// keep rendering them as charts forever.
export const LegacyChartPayload: Story = {
	args: {
		instrument: {
			id: "legacy-instrument",
			version: 1,
			title: "Top authors by commit count",
			sql: topAuthors.sql,
			params: topAuthors.params,
			chart: { type: "bar" as const, xField: "author", yField: "commits" },
		},
		conversationId: "storybook",
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByRole("tab", { name: "Chart" })).toBeVisible();
		const chart = await canvas.findByRole("img");
		await waitFor(() => expect(chart.querySelector("svg")).toBeTruthy());
	},
};
