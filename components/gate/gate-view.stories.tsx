import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { GateView } from "./gate-view";

const accept: Parameters<typeof GateView>[0]["action"] = async () => ({});
const reject: Parameters<typeof GateView>[0]["action"] = async () => ({
	error: "That code does not open the door.",
});

const meta = {
	title: "Gate/GateView",
	component: GateView,
	parameters: { layout: "fullscreen" },
	args: { action: accept },
} satisfies Meta<typeof GateView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Wordmark: Story = {
	args: { hero: "wordmark" },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText("Almost there.")).toBeVisible();
		await expect(canvas.getByLabelText("Access code")).toBeVisible();
	},
};

export const Hallmark: Story = {
	args: { hero: "hallmark" },
};

export const Mark: Story = {
	args: { hero: "mark" },
};

export const WrongCode: Story = {
	args: { hero: "wordmark", action: reject },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.type(canvas.getByLabelText("Access code"), "nope");
		await userEvent.click(canvas.getByRole("button", { name: "Enter" }));
		await expect(
			await canvas.findByText("That code does not open the door."),
		).toBeVisible();
	},
};
