import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { EmailCard } from "./email-card";

const meta = {
	title: "Chat/EmailCard",
	component: EmailCard,
	parameters: { layout: "padded" },
} satisfies Meta<typeof EmailCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Sent: Story = {
	args: {
		state: "output-available",
		input: { to: "delivered@resend.dev", subject: "The Pulse of Hacker News" },
		output: {
			sent: true,
			to: "delivered@resend.dev",
			subject: "The Pulse of Hacker News",
		},
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText("The Pulse of Hacker News")).toBeVisible();
		await expect(canvas.getByText("to delivered@resend.dev")).toBeVisible();
	},
};

export const Writing: Story = {
	args: {
		state: "input-streaming",
		input: { to: "delivered@resend.dev" },
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText("writing the email")).toBeVisible();
	},
};

export const Failed: Story = {
	args: {
		state: "output-error",
		input: { to: "delivered@resend.dev", subject: "Update" },
		errorText: "daily email cap reached (50 per conversation)",
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText(/daily email cap reached/)).toBeVisible();
	},
};
