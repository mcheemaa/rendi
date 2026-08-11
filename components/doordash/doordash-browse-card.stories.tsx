import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import {
	itemDetailsFixture,
	searchFixture,
} from "@/lib/rendi/doordash.fixtures";
import { ddItemDetails, ddSearchResult } from "@/lib/rendi/doordash-schemas";
import { DoorDashBrowseCard } from "./doordash-browse-card";

const meta = {
	title: "DoorDash/BrowseCard",
	component: DoorDashBrowseCard,
	parameters: { layout: "padded" },
	decorators: [
		(Story) => (
			<div className="mx-auto max-w-2xl">
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof DoorDashBrowseCard>;

export default meta;
type Story = StoryObj<typeof meta>;

const stores = ddSearchResult.parse(searchFixture);
const details = ddItemDetails.parse(itemDetailsFixture);

export const StorePicks: Story = {
	args: {
		state: "output-available",
		input: { verb: "search", query: "ramen near me" },
		output: stores,
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText("Itani Ramen")).toBeVisible();
		// Meters arrive raw; the card speaks miles.
		await expect(canvas.getByText(/1\.1 mi/)).toBeVisible();
		// The second store has no image and must hold its layout.
		await expect(canvas.getByText("Sobo Ramen")).toBeVisible();
	},
};

export const ItemSpotlight: Story = {
	args: {
		state: "output-available",
		input: { verb: "item-details", storeId: "55382" },
		output: details,
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		// Once in the header summary, once in the spotlight body.
		await expect(canvas.getAllByText("Tonkotsu Ramen")).toHaveLength(2);
		await expect(canvas.getByText("$16.50")).toBeVisible();
		await expect(canvas.getByText(/often: Add Extra Egg/)).toBeVisible();
		// Thumbnails open to a proper look; escape puts it away.
		await userEvent.click(
			canvas.getByRole("button", { name: /View larger: Tonkotsu Ramen/ }),
		);
		const dialog = await waitFor(() => {
			const found = document.querySelector("[role='dialog']");
			expect(found).not.toBeNull();
			return found as HTMLElement;
		});
		await waitFor(() =>
			expect(within(dialog).getByAltText("Tonkotsu Ramen")).toBeVisible(),
		);
		await userEvent.keyboard("{Escape}");
		await waitFor(() =>
			expect(document.querySelector("[role='dialog']")).toBeNull(),
		);
	},
};

export const Reaching: Story = {
	args: {
		state: "input-available",
		input: { verb: "search", query: "sushi" },
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText(/reaching DoorDash/)).toBeVisible();
	},
};

export const Failed: Story = {
	args: {
		state: "output-error",
		input: { verb: "menu", storeId: "1" },
		errorText: "Store is closed",
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText("Store is closed")).toBeVisible();
	},
};
