import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { PulseCard } from "./pulse-card";

const meta = {
	title: "Chat/PulseCard",
	component: PulseCard,
	parameters: { layout: "padded" },
} satisfies Meta<typeof PulseCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SetPulse: Story = {
	args: {
		state: "output-available",
		input: {
			op: "set",
			instruction: "Refresh the board and note anything unusual.",
			cron: "0 9 * * *",
		},
		output: {
			id: "p1",
			cron: "0 9 * * *",
			timezone: "UTC",
			next_run: "2026-07-22T09:00:00.000Z",
			updated: false,
		},
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText("Set a pulse")).toBeVisible();
		// Open by default: the standing instruction is the content.
		await expect(
			canvas.getByText("Refresh the board and note anything unusual."),
		).toBeVisible();
		await expect(canvas.getByText(/0 9 \* \* \*.*next/)).toBeVisible();
	},
};

export const List: Story = {
	args: {
		state: "output-available",
		input: { op: "list" },
		output: {
			pulses: [
				{
					id: "p1",
					instruction: "Refresh the board every morning.",
					cron: "0 9 * * *",
					beats: 12,
					last_beat_at: "2026-07-21T09:00:00.000Z",
				},
			],
		},
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText("1 pulse")).toBeVisible();
	},
};

export const Removed: Story = {
	args: {
		state: "output-available",
		input: { op: "remove" },
		output: { removed: "p1" },
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText("Removed a pulse")).toBeVisible();
		await expect(canvas.getByText("stopped")).toBeVisible();
	},
};

export const Scheduling: Story = {
	args: {
		state: "input-available",
		input: { op: "set", instruction: "x", cron: "0 9 * * *" },
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText("talking to the scheduler")).toBeVisible();
	},
};

export const Failed: Story = {
	args: {
		state: "output-error",
		input: { op: "set", instruction: "x", cron: "not-a-cron" },
		errorText: "Invalid cron expression",
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText("Invalid cron expression")).toBeVisible();
	},
};
