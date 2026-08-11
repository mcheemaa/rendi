import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { ApprovalCard } from "./approval-card";

const awaiting = {
	approvalId: 41,
	expiresAt: new Date(Date.now() + 14 * 60 * 1000).toISOString(),
	totalCents: 3317,
	tipCents: 440,
	storeName: "Toomie's Thai",
	itemsCount: 2,
	awaiting: "a one-time code is in the owner's inbox",
};

const meta = {
	title: "DoorDash/ApprovalCard",
	component: ApprovalCard,
	parameters: { layout: "padded" },
	args: {
		state: "output-available",
		output: awaiting,
		verify: fn(async (_id: number, _code: string) => ({ ok: true })),
		cancel: fn(async (_id: number) => {}),
		fetchStatus: fn(async (_id: number) => "waiting"),
	},
	decorators: [
		(Story) => (
			<div className="mx-auto max-w-2xl">
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof ApprovalCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CodeEntry: Story = {
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		const input = canvas.getByRole("textbox", { name: "Approval code" });
		const approve = canvas.getByRole("button", { name: "Approve" });
		await expect(approve).toBeDisabled();
		await userEvent.type(input, "482913");
		await userEvent.click(approve);
		await waitFor(() => expect(args.verify).toHaveBeenCalledWith(41, "482913"));
		await expect(
			canvas.getByText("approved; rendi is placing the order"),
		).toBeVisible();
	},
};

export const WrongCode: Story = {
	args: {
		verify: fn(async (_id: number, _code: string) => ({
			ok: false,
			reason: "wrong",
			attemptsLeft: 4,
		})),
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const input = canvas.getByRole("textbox", { name: "Approval code" });
		await userEvent.type(input, "000000");
		await userEvent.click(canvas.getByRole("button", { name: "Approve" }));
		await expect(
			await canvas.findByText("wrong code, 4 tries left"),
		).toBeVisible();
		// A spent guess never lingers in the field.
		await expect(input).toHaveValue("");
	},
};

export const Cancelled: Story = {
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByRole("button", { name: "Cancel" }));
		await waitFor(() => expect(args.cancel).toHaveBeenCalledWith(41));
		await expect(
			canvas.getByText("approval cancelled; the cart is open again"),
		).toBeVisible();
	},
};

export const AlreadyApproved: Story = {
	args: { fetchStatus: fn(async (_id: number) => "consumed") },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		// A reload after the code was entered never re-offers the input.
		await expect(
			await canvas.findByText("approved; rendi is placing the order"),
		).toBeVisible();
		await expect(
			canvas.queryByRole("textbox", { name: "Approval code" }),
		).not.toBeInTheDocument();
	},
};

export const Denied: Story = {
	args: {
		output: {
			denied: "the order cap is $100 and this cart totals $184.90",
		},
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByText("the order cap is $100 and this cart totals $184.90"),
		).toBeVisible();
	},
};
