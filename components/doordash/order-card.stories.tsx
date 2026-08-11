import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { OrderCard } from "./order-card";

const meta = {
	title: "DoorDash/OrderCard",
	component: OrderCard,
	parameters: { layout: "padded" },
	args: { state: "output-available" },
	decorators: [
		(Story) => (
			<div className="mx-auto max-w-2xl">
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof OrderCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Placed: Story = {
	args: {
		output: {
			outcome: "successful",
			orderUuid: "abcdef12-3456-7890-abcd-ef1234567890",
			totalCents: 3317,
			storeName: "Toomie's Thai",
		},
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByText("the order is in at Toomie's Thai for $33.17"),
		).toBeVisible();
		await expect(canvas.getByText("order 34567890")).toBeVisible();
	},
};

export const Failed: Story = {
	args: {
		output: {
			outcome: "failed",
			error: "payment method declined",
			note: "never resubmit; the app or browser checkout finishes this",
		},
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText("payment method declined")).toBeVisible();
		await expect(
			canvas.getByText(
				"never resubmit; the app or browser checkout finishes this",
			),
		).toBeVisible();
	},
};

export const ActionRequired: Story = {
	args: {
		output: {
			outcome: "action_required",
			orderUuid: "abcdef12-3456-7890-abcd-ef1234567890",
			totalCents: 3317,
			storeName: "Toomie's Thai",
			note: "never resubmit; the app or browser checkout finishes this",
		},
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByText("DoorDash wants something only the app can answer"),
		).toBeVisible();
	},
};

export const Held: Story = {
	args: {
		output: { refused: "the code was never entered" },
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText("the code was never entered")).toBeVisible();
	},
};

export const Unconfirmed: Story = {
	args: {
		output: {
			outcome: "unknown",
			storeName: "Toomie's Thai",
			note: "the submission may or may not have reached DoorDash; never resubmit and never check out elsewhere until order history answers. Check the order history in a minute and reconcile honestly.",
		},
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText("The order is unconfirmed")).toBeVisible();
	},
};

export const NotFound: Story = {
	args: {
		output: {
			outcome: "not_found",
			orderUuid: "abcdef12-3456-7890-abcd-ef1234567890",
			storeName: "Toomie's Thai",
		},
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByText(
				"DoorDash cannot find this order; check the app before doing anything else",
			),
		).toBeVisible();
	},
};

export const Voided: Story = {
	args: {
		output: {
			voided:
				"the cart changed after the code was sent; request a fresh approval",
		},
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByText(
				"the cart changed after the code was sent; request a fresh approval",
			),
		).toBeVisible();
	},
};
