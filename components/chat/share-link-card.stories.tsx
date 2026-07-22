import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { ShareLinkCard } from "./share-link-card";

const meta = {
	title: "Chat/ShareLinkCard",
	component: ShareLinkCard,
	parameters: { layout: "padded" },
} satisfies Meta<typeof ShareLinkCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Created: Story = {
	args: {
		state: "output-available",
		output: {
			url: "http://localhost:3000/s/c9da9c66-2680-4465-b0dc-093900500f6d?t=1784718977221.abc123",
			expires_at: "2026-07-29T17:16:17.221Z",
		},
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText("lasts 7 days")).toBeVisible();
		await expect(canvas.getByRole("link")).toHaveAttribute(
			"href",
			expect.stringContaining("/s/c9da9c66"),
		);
	},
};

export const Failed: Story = {
	args: {
		state: "output-error",
		errorText: "create-share-link outside a turn",
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByText("create-share-link outside a turn"),
		).toBeVisible();
	},
};
