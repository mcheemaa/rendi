import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { LOOK_PNG } from "@/components/instrument/story-fixtures";
import { ScreenshotCard } from "./screenshot-card";

const meta = {
	title: "Chat/ScreenshotCard",
	component: ScreenshotCard,
	parameters: { layout: "padded" },
} satisfies Meta<typeof ScreenshotCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Looked: Story = {
	args: {
		state: "output-available",
		output: { theme: "light", width: 112, height: 72, pngBase64: LOOK_PNG },
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText("Looked at the board")).toBeVisible();
		await expect(canvas.getByText("112x72 · light")).toBeVisible();
		// Open by default: the picture is the content.
		await expect(
			canvas.getByAltText("The board exactly as Rendi sees it"),
		).toBeVisible();
	},
};

export const Looking: Story = {
	args: { state: "input-available" },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText("looking at the board")).toBeVisible();
	},
};

export const Failed: Story = {
	args: {
		state: "output-error",
		errorText: "page.goto: net::ERR_CONNECTION_REFUSED",
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText("failed")).toBeVisible();
		await expect(canvas.getByText(/ERR_CONNECTION_REFUSED/)).toBeVisible();
	},
};
