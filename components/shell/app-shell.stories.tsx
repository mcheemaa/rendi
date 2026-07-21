import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { AppShell, type ConversationRef } from "./app-shell";

const HEAD: ConversationRef[] = [
	{ id: "a", title: "Daily commit rhythm" },
	{ id: "b", title: "Who ships on weekends" },
];

const ARCHIVE: ConversationRef[] = [
	{ id: "c", title: "Taxi fares by borough" },
	{ id: "d", title: "Peak coding hours" },
];

const meta = {
	title: "Shell/AppShell",
	component: AppShell,
	parameters: { layout: "fullscreen" },
	args: {
		conversations: HEAD,
		cursor: { updatedAt: "2026-07-19T00:00:00.000Z", id: "b" },
		// Fixture actions: the second page arrives on load-more, and search
		// reaches past the loaded head into the archive.
		actions: {
			loadPage: async () => ({ items: ARCHIVE, cursor: null }),
			search: async (query: string) =>
				[...HEAD, ...ARCHIVE].filter((row) =>
					row.title.toLowerCase().includes(query.toLowerCase()),
				),
		},
	},
} satisfies Meta<typeof AppShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {
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
		const canvas = within(canvasElement);
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

		// Load more pulls the archive page into the list.
		await userEvent.click(canvas.getByRole("button", { name: /Load more/ }));
		await expect(
			await canvas.findByText("Taxi fares by borough"),
		).toBeVisible();

		// Sidebar search: instant local narrowing, server results settle in,
		// and clearing restores the paged list.
		const search = canvas.getByLabelText("Search conversations");
		await userEvent.type(search, "taxi");
		await waitFor(() =>
			expect(canvas.queryByText("Daily commit rhythm")).not.toBeInTheDocument(),
		);
		await expect(canvas.getByText("Taxi fares by borough")).toBeVisible();
		await userEvent.clear(search);
		await expect(await canvas.findByText("Daily commit rhythm")).toBeVisible();

		// The palette searches the same pool from the keyboard.
		await userEvent.keyboard("{Meta>}k{/Meta}");
		const palette = await within(document.body).findByPlaceholderText(
			"Search conversations, actions…",
		);
		await expect(palette).toBeVisible();
		await userEvent.type(palette, "peak");
		await expect(
			await within(document.body).findByText("Peak coding hours"),
		).toBeVisible();
		await userEvent.keyboard("{Escape}");
		// The axe sweep runs after play; the dialog must be fully gone, not
		// a closing frame holding an empty listbox.
		await waitFor(() =>
			expect(
				within(document.body).queryByPlaceholderText(
					"Search conversations, actions…",
				),
			).not.toBeInTheDocument(),
		);
	},
};
