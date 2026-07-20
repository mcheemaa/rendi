import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { AppShell } from "./app-shell";

const meta = {
	title: "Shell/AppShell",
	component: AppShell,
	parameters: { layout: "fullscreen" },
} satisfies Meta<typeof AppShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {
		conversations: [
			{ id: "a", title: "Daily commit rhythm" },
			{ id: "b", title: "Who ships on weekends" },
		],
		children: (
			<div className="flex flex-1 flex-col items-center justify-center gap-3 px-8">
				<h1 className="font-display text-4xl">What should the data become?</h1>
				<p className="text-muted-foreground">
					Ask a question; the answer arrives as a live instrument.
				</p>
			</div>
		),
	},
	play: async ({ canvasElement }) => {
		const trigger = canvasElement.querySelector<HTMLButtonElement>(
			'[data-slot="sidebar-trigger"]',
		);
		if (!trigger) throw new Error("sidebar trigger not rendered");
		await userEvent.click(trigger);
		await waitFor(() => {
			const sidebar = canvasElement.querySelector('[data-slot="sidebar"]');
			expect(sidebar).toHaveAttribute("data-state", "collapsed");
		});
		await userEvent.click(trigger);
		await waitFor(() => {
			const sidebar = canvasElement.querySelector('[data-slot="sidebar"]');
			expect(sidebar).toHaveAttribute("data-state", "expanded");
		});

		await userEvent.keyboard("{Meta>}k{/Meta}");
		const palette = await within(document.body).findByPlaceholderText(
			/search conversations/i,
		);
		await expect(palette).toBeVisible();
		await userEvent.keyboard("{Escape}");
	},
};
