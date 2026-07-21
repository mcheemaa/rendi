import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { UIMessage } from "ai";
import { expect, userEvent, within } from "storybook/test";
import { installExecMock } from "@/components/instrument/story-fixtures";
import { Transcript } from "./transcript";

// Trimmed from a real persisted exchange (chat rendi-caps-1784519945).
const realExchange: UIMessage[] = [
	{
		id: "msg-1784519974793-mfhmc7",
		role: "user",
		parts: [
			{
				type: "text",
				text: "What time span does git.commits cover, and who are the top 3 authors by commit count?",
			},
		],
	},
	{
		id: "OYRoye8TcQIJ3s0o",
		role: "assistant",
		parts: [
			{ type: "step-start" },
			{
				type: "tool-query-data",
				toolCallId: "toolu_011H1Qk3kKzATerqztSpJerF",
				state: "output-available",
				input: {
					sql: "SELECT author, count() AS commits FROM git.commits GROUP BY author ORDER BY commits DESC LIMIT 3",
				},
				output: {
					rows: [
						{ author: "Matt Aitken", commits: 2479 },
						{ author: "Eric Allam", commits: 2279 },
						{ author: "James Ritchie", commits: 1160 },
					],
					rowCount: 3,
					truncated: false,
				},
			},
			{
				type: "data-instrument",
				id: "d8a071da-65cc-4ffa-ada2-eccde826b4cd",
				data: {
					id: "d8a071da-65cc-4ffa-ada2-eccde826b4cd",
					version: 1,
					title: "Top authors by commit count",
					sql: "SELECT author, count() AS commits\nFROM git.commits\nGROUP BY author\nORDER BY commits DESC\nLIMIT {top_n:UInt32}",
					params: [
						{
							name: "top_n",
							type: "UInt32",
							control: "number",
							defaultValue: "3",
						},
					],
					chart: { type: "bar", xField: "author", yField: "commits" },
				},
			},
			{
				type: "text",
				text: "git.commits spans 2022-11-30 to 2026-07-19 (1,327 days). Top 3: Matt Aitken (2,479), Eric Allam (2,279), James Ritchie (1,160).",
			},
		],
	} as UIMessage,
];

const meta = {
	title: "Chat/Transcript",
	component: Transcript,
	parameters: {
		layout: "fullscreen",
		a11y: {
			config: {
				// Same shiki token-palette scoping as QueryDataCard; the Ember
				// shiki theme is an M3 item.
				rules: [{ id: "color-contrast", selector: "*:not(pre span)" }],
			},
		},
	},
	decorators: [
		(Story) => {
			installExecMock();
			return (
				<div className="flex h-svh flex-col bg-background">
					<Story />
				</div>
			);
		},
	],
} satisfies Meta<typeof Transcript>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Pending: Story = {
	args: {
		messages: [realExchange[0]],
		conversationId: "storybook",
		pending: true,
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByTitle("Loader")).toBeInTheDocument();
	},
};

export const RealExchange: Story = {
	args: { messages: realExchange, conversationId: "storybook" },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByText(/What time span does git.commits/),
		).toBeVisible();
		await expect(canvas.getByText("Top authors by commit count")).toBeVisible();
		await userEvent.click(canvas.getByText("Looked at the data"));
		// The name also paints into the live chart's axis, so match all.
		await expect((await canvas.findAllByText("Matt Aitken"))[0]).toBeVisible();
		await expect(
			canvas.getByText(/spans 2022-11-30 to 2026-07-19/),
		).toBeVisible();
	},
};
