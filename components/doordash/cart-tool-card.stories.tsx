import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { CartToolCard } from "./cart-tool-card";

const meta = {
	title: "DoorDash/CartToolCard",
	component: CartToolCard,
	parameters: { layout: "padded" },
	args: { state: "output-available" },
	decorators: [
		(Story) => (
			<div className="mx-auto max-w-2xl">
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof CartToolCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ExistingCart: Story = {
	args: {
		output: {
			existingCart: {
				cartUuid: "cccccccc-1111-2222-3333-444444444444",
				storeName: "Toomie's Thai",
				itemsCount: 2,
			},
		},
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByText(/an open cart already exists at Toomie's Thai/),
		).toBeVisible();
		await expect(canvas.getByText(/with 2 items/)).toBeVisible();
	},
};

export const NeedsChoices: Story = {
	args: {
		output: {
			needsChoices: true,
			itemErrors: [
				{
					item_name: "Pad See Ew",
					required_options: [
						{
							name: "Protein",
							options: [{ name: "Tofu" }, { name: "Chicken" }],
						},
					],
				},
			],
		},
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText("Pad See Ew")).toBeVisible();
		await expect(canvas.getByText("Protein: Tofu / Chicken")).toBeVisible();
		await expect(
			canvas.getByText("tell rendi which, and it will add the item"),
		).toBeVisible();
	},
};

export const Deleted: Story = {
	args: { output: { deleted: true } },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByText("nothing left to order from that cart"),
		).toBeVisible();
	},
};

export const TipSet: Story = {
	args: {
		output: {
			cartUuid: "cccccccc-1111-2222-3333-444444444444",
			tipCents: 880,
		},
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText("dasher tip is now $8.80")).toBeVisible();
	},
};

export const Failed: Story = {
	args: {
		output: undefined,
		errorText: "the order is being placed; the cart is sealed",
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByText("the order is being placed; the cart is sealed"),
		).toBeVisible();
	},
};
