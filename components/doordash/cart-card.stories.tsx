import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { cartShowFixture, previewFixture } from "@/lib/rendi/doordash.fixtures";
import { normalizeCartLines, normalizeQuote } from "@/lib/rendi/doordash-cart";
import { ddCartEnvelope, ddPreviewResult } from "@/lib/rendi/doordash-schemas";
import { CartCard, type CartCardData, type DurableCart } from "./cart-card";

const lines = normalizeCartLines(ddCartEnvelope.parse(cartShowFixture).cart);
const quote = normalizeQuote(ddPreviewResult.parse(previewFixture));

const building: CartCardData = {
	cartUuid: "cccccccc-1111-2222-3333-444444444444",
	storeName: "Toomie's Thai",
	storeImageUrl: "https://img.example/toomies.jpg",
	items: lines,
	quote,
	tipCents: 440,
	fulfillment: "delivery",
};

const meta = {
	title: "DoorDash/CartCard",
	component: CartCard,
	parameters: { layout: "padded" },
	args: {
		data: building,
		exec: fn(async () => ({ ok: true, cart: null })),
		hydrate: fn(async (): Promise<DurableCart | null> => null),
	},
	decorators: [
		(Story) => (
			<div className="mx-auto max-w-2xl">
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof CartCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Building: Story = {
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText("Pad See Ew")).toBeVisible();
		// Line total: 3 x $18.50.
		await expect(canvas.getByText("$55.50")).toBeVisible();
		// The ladder shows the struck-through original beside the free fee.
		await expect(canvas.getByText("$0.99")).toBeVisible();
		// Total = total_before_tip + tip: $28.77 + $4.40.
		await expect(canvas.getByText("$33.17")).toBeVisible();
		// A stepper touch calls the exec seam with the target quantity.
		await userEvent.click(
			canvas.getByRole("button", { name: "One more Pad See Ew" }),
		);
		await waitFor(() =>
			expect(args.exec).toHaveBeenCalledWith(
				building.cartUuid,
				expect.objectContaining({ kind: "set-quantity", quantity: 4 }),
			),
		);
	},
};

export const ClosedStore: Story = {
	args: {
		data: {
			...building,
			quote: quote ? { ...quote, asapAvailable: false } : null,
		},
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText("closed right now")).toBeVisible();
	},
};

export const TipSelection: Story = {
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		// 10% of the $43.98 subtotal, selected by default at birth.
		const ten = canvas.getByRole("button", { name: "10%" });
		await expect(ten).toHaveAttribute("aria-pressed", "true");
		await userEvent.click(canvas.getByRole("button", { name: "20%" }));
		await waitFor(() =>
			expect(args.exec).toHaveBeenCalledWith(
				building.cartUuid,
				expect.objectContaining({ kind: "set-tip", tipCents: 880 }),
			),
		);
	},
};

export const Empty: Story = {
	args: { data: { ...building, items: [], quote: null } },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText("The cart is empty.")).toBeVisible();
	},
};

export const Sealed: Story = {
	args: {
		hydrate: fn(async () => ({ status: "placing" })),
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		// The durable snapshot says the order is being placed: every
		// control freezes and the header says why.
		await expect(await canvas.findByText("placing the order")).toBeVisible();
		await waitFor(() =>
			expect(
				canvas.getByRole("button", { name: "One more Pad See Ew" }),
			).toBeDisabled(),
		);
		await expect(canvas.getByRole("button", { name: "10%" })).toBeDisabled();
	},
};

export const HydratesFromDurableTruth: Story = {
	args: {
		hydrate: fn(async () => ({ status: "open", tipCents: 880 })),
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		// The transcript froze a 10 percent tip; the durable cart moved on
		// to 20 percent, and the card adopts the truth on mount.
		await waitFor(async () =>
			expect(canvas.getByRole("button", { name: "20%" })).toHaveAttribute(
				"aria-pressed",
				"true",
			),
		);
	},
};
