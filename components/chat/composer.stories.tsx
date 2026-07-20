import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { Composer } from "./composer";

const meta = {
	title: "Chat/Composer",
	component: Composer,
	parameters: { layout: "fullscreen" },
	args: { onSend: fn(), onStop: fn() },
	decorators: [
		(Story) => (
			<div className="flex h-svh flex-col justify-end bg-background">
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof Composer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {
	args: { status: "ready" },
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		const textarea = canvas.getByLabelText<HTMLTextAreaElement>("Ask rendi");
		await userEvent.type(textarea, "monthly commits");
		await userEvent.keyboard("{Shift>}{Enter}{/Shift}");
		await expect(args.onSend).not.toHaveBeenCalled();
		await expect(textarea.value).toContain("\n");
		await userEvent.type(textarea, "by author");
		await userEvent.keyboard("{Enter}");
		await expect(args.onSend).toHaveBeenCalledWith(
			"monthly commits\nby author",
		);
	},
};

export const Streaming: Story = {
	args: { status: "streaming" },
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByLabelText("Ask rendi")).toBeDisabled();
		await userEvent.click(canvas.getByRole("button", { name: "Stop" }));
		await expect(args.onStop).toHaveBeenCalled();
		await expect(args.onSend).not.toHaveBeenCalled();
	},
};
