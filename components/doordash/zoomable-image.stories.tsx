import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { ZoomableImage } from "./zoomable-image";

const SWATCH =
	"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'><rect width='80' height='80' fill='%23c2410c'/></svg>";

const meta = {
	title: "DoorDash/ZoomableImage",
	component: ZoomableImage,
	parameters: { layout: "centered" },
	args: {
		src: SWATCH,
		name: "Tonkotsu Ramen",
		className: "size-16",
	},
} satisfies Meta<typeof ZoomableImage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OpensToAProperLook: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			canvas.getByRole("button", { name: "View larger: Tonkotsu Ramen" }),
		);
		// The dialog mounts in a portal outside the story canvas.
		const body = within(document.body);
		await waitFor(async () => {
			await expect(
				body.getByRole("img", { name: "Tonkotsu Ramen" }),
			).toBeVisible();
		});
		await userEvent.keyboard("{Escape}");
	},
};
