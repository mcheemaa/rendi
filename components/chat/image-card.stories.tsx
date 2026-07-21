import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { LOOK_PNG } from "@/components/instrument/story-fixtures";
import { ImageCard } from "./image-card";

const meta = {
	title: "Chat/ImageCard",
	component: ImageCard,
	parameters: { layout: "padded" },
} satisfies Meta<typeof ImageCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Made: Story = {
	args: {
		state: "output-available",
		input: { prompt: "A warm watercolor ember on cream paper, minimal" },
		output: {
			image_id: "img-1",
			url: `data:image/png;base64,${LOOK_PNG}`,
			width: 112,
			height: 72,
		},
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText("Made an image")).toBeVisible();
		await expect(canvas.getByText("112x72")).toBeVisible();
		// Open by default: the picture is the content, captioned by its prompt.
		await expect(
			canvas.getByAltText("A warm watercolor ember on cream paper, minimal"),
		).toBeVisible();
	},
};

export const Making: Story = {
	args: { state: "input-available", input: { prompt: "A hero image" } },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText("making an image")).toBeVisible();
	},
};

export const Refining: Story = {
	args: {
		state: "input-available",
		input: { prompt: "Warmer palette", source_image_id: "img-1" },
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText("Refined an image")).toBeVisible();
		await expect(canvas.getByText("refining the image")).toBeVisible();
	},
};

export const Failed: Story = {
	args: {
		state: "output-error",
		input: { prompt: "A hero image" },
		errorText: "image generation 429: quota exceeded",
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByText("image generation 429: quota exceeded"),
		).toBeVisible();
	},
};
