import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { CommitSyncCard } from "./commit-sync-card";

const meta = {
	title: "Chat/CommitSyncCard",
	component: CommitSyncCard,
	parameters: { layout: "padded" },
} satisfies Meta<typeof CommitSyncCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Started: Story = {
	args: {
		state: "output-available",
		input: { repos: ["clickhouse", "trigger.dev"] },
		output: { started: true, repos: ["clickhouse", "trigger.dev"] },
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText("clickhouse, trigger.dev")).toBeVisible();
		await expect(canvas.getByText(/counts arrive with the wake/)).toBeVisible();
	},
};

export const Working: Story = {
	args: { state: "input-streaming" },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText("reaching github")).toBeVisible();
	},
};

export const Failed: Story = {
	args: {
		state: "output-error",
		input: { repos: ["clickhouse"] },
		errorText: "unknown repo clickhoose",
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText("unknown repo clickhoose")).toBeVisible();
	},
};
