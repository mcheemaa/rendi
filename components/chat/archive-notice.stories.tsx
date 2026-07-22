import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { ArchiveNotice } from "./archive-notice";

const meta = {
	title: "Chat/ArchiveNotice",
	component: ArchiveNotice,
	parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ArchiveNotice>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByText(/archived conversation from Rendi/),
		).toBeVisible();
		await expect(
			canvas.getByRole("link", { name: "New conversation" }),
		).toHaveAttribute("href", "/");
	},
};

// The chat pane squeezes when the canvas opens; the notice must wrap
// like the composer does, never overflow its card.
export const Narrow: Story = {
	decorators: [
		(StoryComponent) => (
			<div className="max-w-96">
				<StoryComponent />
			</div>
		),
	],
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const card = canvasElement.querySelector(
			"[class*='rounded-xl']",
		) as HTMLElement;
		const link = canvas.getByRole("link", { name: "New conversation" });
		const cardBox = card.getBoundingClientRect();
		const linkBox = link.getBoundingClientRect();
		await expect(linkBox.right).toBeLessThanOrEqual(cardBox.right + 1);
	},
};
