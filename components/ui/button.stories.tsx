import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ArrowRight, Plus } from "lucide-react";
import { expect, fn, userEvent } from "storybook/test";

import { Button } from "./button";

const meta = {
	title: "UI/Button",
	component: Button,
	tags: ["autodocs"],
	args: { children: "Ask Rendi" },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Variants: Story = {
	render: () => (
		<div className="flex flex-wrap items-center gap-3">
			<Button>Default</Button>
			<Button variant="outline">Outline</Button>
			<Button variant="secondary">Secondary</Button>
			<Button variant="ghost">Ghost</Button>
			<Button variant="destructive">Destructive</Button>
			<Button variant="link">Link</Button>
		</div>
	),
};

export const Sizes: Story = {
	render: () => (
		<div className="flex flex-wrap items-center gap-3">
			<Button size="xs">Extra small</Button>
			<Button size="sm">Small</Button>
			<Button size="default">Default</Button>
			<Button size="lg">
				Large <ArrowRight data-icon="inline-end" />
			</Button>
			<Button size="icon" aria-label="Add instrument">
				<Plus />
			</Button>
		</div>
	),
};

export const Disabled: Story = {
	args: { disabled: true, children: "Unavailable" },
};

export const Clickable: Story = {
	args: { onClick: fn(), children: "Run query" },
	play: async ({ args, canvas }) => {
		await userEvent.click(canvas.getByRole("button", { name: "Run query" }));
		await expect(args.onClick).toHaveBeenCalledOnce();
	},
};
