import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Vignette } from "./vignette";

const meta = {
	title: "Home/Vignette",
	component: Vignette,
	parameters: { layout: "centered" },
} satisfies Meta<typeof Vignette>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Rest: Story = {
	args: {
		phase: "rest",
		text: "busiest hours by weekday?",
		animate: false,
	},
};

export const Typing: Story = {
	args: {
		phase: "typing",
		text: "busiest hou",
		animate: true,
	},
};
