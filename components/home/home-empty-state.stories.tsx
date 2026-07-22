import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { HomeEmptyState } from "./home-empty-state";

const meta = {
	title: "Home/HomeEmptyState",
	component: HomeEmptyState,
	parameters: { layout: "fullscreen" },
	args: { onPick: fn() },
	decorators: [
		(Story) => (
			<div className="flex h-[780px] flex-col bg-background">
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof HomeEmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Home: Story = {
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText("What do you want to see?")).toBeVisible();
		// The vignette types its seed question within the first beat.
		await canvas.findByText("busiest hours by weekday?", undefined, {
			timeout: 3000,
		});
		await userEvent.click(
			canvas.getByRole("button", {
				name: "Chart seventeen years of ClickHouse",
			}),
		);
		await expect(args.onPick).toHaveBeenCalledWith(
			expect.stringContaining("seventeen years of ClickHouse development"),
		);
	},
};
