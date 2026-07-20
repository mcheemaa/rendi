import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { QueryDataCard } from "./query-data-card";

const meta = {
	title: "Chat/QueryDataCard",
	component: QueryDataCard,
	parameters: {
		layout: "padded",
		a11y: {
			config: {
				// Shiki's stock token palette misses AA on some hues; the Ember
				// shiki theme lands with M3's instrument SQL pass. Base ink and
				// every non-token surface stay under the full gate.
				rules: [{ id: "color-contrast", selector: "*:not(pre span)" }],
			},
		},
	},
} satisfies Meta<typeof QueryDataCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Completed: Story = {
	args: {
		sql: "SELECT author, count() AS commits FROM git.commits GROUP BY author ORDER BY commits DESC LIMIT 3",
		state: "output-available",
		output: {
			rows: [
				{ author: "Matt Aitken", commits: 2479 },
				{ author: "Eric Allam", commits: 2279 },
				{ author: "James Ritchie", commits: 1160 },
			],
			rowCount: 3,
			truncated: false,
			stats: { elapsedMs: 231, readRows: 7641 },
		},
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByRole("button"));
		await expect(await canvas.findByText("Matt Aitken")).toBeVisible();
		await waitFor(() =>
			expect(canvasElement.querySelector("code")?.textContent ?? "").toContain(
				"GROUP BY author",
			),
		);
		await expect(canvas.getByText(/3 rows · 231ms/)).toBeVisible();
	},
};

export const SingleRow: Story = {
	args: {
		sql: "SELECT count() AS commits FROM git.commits",
		state: "output-available",
		output: {
			rows: [{ commits: 7641 }],
			rowCount: 1,
			truncated: false,
			stats: { elapsedMs: 12 },
		},
	},
	play: async ({ canvasElement }) => {
		await expect(within(canvasElement).getByText(/1 row · 12ms/)).toBeVisible();
	},
};

export const Truncated: Story = {
	args: {
		sql: "SELECT * FROM git.commits",
		state: "output-available",
		output: {
			rows: Array.from({ length: 8 }, (_, i) => ({
				sha: `c0ffee${i}`,
				author: "Matt Aitken",
			})),
			rowCount: 500,
			truncated: true,
			stats: { elapsedMs: 215, readRows: 7641 },
		},
	},
	play: async ({ canvasElement }) => {
		await expect(
			within(canvasElement).getByText(/500 rows · truncated · 215ms/),
		).toBeVisible();
	},
};

export const Failed: Story = {
	args: {
		sql: "SELECT * FROM nope.nope",
		state: "output-error",
		errorText: "Database nope does not exist.",
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText("failed")).toBeVisible();
		await userEvent.click(canvas.getByRole("button"));
		await expect(
			await canvas.findByText(/Database nope does not exist/),
		).toBeVisible();
	},
};

export const Running: Story = {
	args: {
		sql: "SELECT toDate(ts) AS day, count() FROM git.commits GROUP BY day",
		state: "input-available",
	},
	play: async ({ canvasElement }) => {
		await expect(within(canvasElement).getByText("running")).toBeVisible();
	},
};
