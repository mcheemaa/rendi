import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { DatasetCard } from "./dataset-card";

const meta = {
	title: "Chat/DatasetCard",
	component: DatasetCard,
	parameters: { layout: "padded" },
} satisfies Meta<typeof DatasetCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Loading: Story = {
	args: {
		state: "output-available",
		input: { op: "load", slug: "hackernews" },
		output: {
			slug: "hackernews",
			status: "loading",
			rows_loaded: 3_400_000,
			est_rows: 10_000_000,
		},
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText("Loading hackernews")).toBeVisible();
		await expect(canvas.getByText("3,400,000 rows in")).toBeVisible();
		await expect(canvas.getByRole("progressbar")).toBeVisible();
	},
};

export const Ready: Story = {
	args: {
		state: "output-available",
		input: { op: "load", slug: "hackernews" },
		output: { slug: "hackernews", status: "ready", rows_loaded: 10_000_000 },
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText("10,000,000 rows · ready")).toBeVisible();
	},
};

export const Catalog: Story = {
	args: {
		state: "output-available",
		input: { op: "catalog" },
		output: {
			datasets: [
				{
					slug: "hackernews",
					title: "Hacker News",
					description: "Ten million stories and comments.",
					status: "ready",
					rows_loaded: 10_000_000,
					est_rows: 10_000_000,
				},
				{
					slug: "uk-property-prices",
					title: "UK property prices",
					description: "Every registered sale since 1995.",
					status: "not loaded",
					rows_loaded: 0,
					est_rows: 28_900_000,
				},
			],
		},
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText("2 datasets")).toBeVisible();
		await expect(canvas.getByText("not loaded")).toBeVisible();
	},
};

export const Failed: Story = {
	args: {
		state: "output-error",
		input: { op: "load", slug: "hackernews" },
		errorText: "unknown dataset hackernews-2",
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByText("unknown dataset hackernews-2"),
		).toBeVisible();
	},
};
