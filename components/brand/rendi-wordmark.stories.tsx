import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { RendiWordmark } from "./rendi-wordmark";

const meta = {
	title: "Brand/RendiWordmark",
	component: RendiWordmark,
	parameters: { layout: "centered" },
} satisfies Meta<typeof RendiWordmark>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Idle: Story = {
	args: { entrance: false, className: "h-13" },
};

export const Entrance: Story = {
	args: { entrance: true, className: "h-13" },
};

export const Working: Story = {
	args: { entrance: false, working: true, className: "h-13" },
};
