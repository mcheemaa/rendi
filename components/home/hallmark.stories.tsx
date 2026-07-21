import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { Hallmark } from "./hallmark";

const meta = {
	title: "Home/Hallmark",
	component: Hallmark,
	parameters: { layout: "centered" },
} satisfies Meta<typeof Hallmark>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Row: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByRole("img", {
				name: "Rendi is built with Claude, ClickHouse, and Trigger.dev",
			}),
		).toBeVisible();
	},
};
