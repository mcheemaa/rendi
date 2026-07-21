import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { type ReactNode, useEffect, useMemo } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { installExecMock } from "@/components/instrument/story-fixtures";
import { type CanvasDoc, SNAP } from "@/lib/rendi/canvas";
import { Board } from "./board";
import { createCameraStore } from "./camera";
import { CanvasProvider } from "./canvas-context";
import { createCanvasStore } from "./canvas-store";

const DAWN =
	"data:image/svg+xml," +
	encodeURIComponent(
		'<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e8a33d"/><stop offset="1" stop-color="#1e2226"/></linearGradient></defs><rect width="320" height="200" fill="url(#g)"/><circle cx="160" cy="130" r="34" fill="#f8f5ef" opacity="0.85"/></svg>',
	);

const AGENT_HTML = `
<style>
 .wrap { padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; }
 .eyebrow { font-family: var(--font-mono); font-size: 9.5px; letter-spacing: .14em; text-transform: uppercase; color: var(--accent-text); }
 h1 { margin: 0; font-family: var(--font-display); font-weight: 400; font-size: 20px; }
 p { margin: 0; color: var(--muted-foreground); font-size: 12.5px; }
 b { color: var(--foreground); }
</style>
<div class="wrap">
 <span class="eyebrow">rendi wrote this block</span>
 <h1>Deploy freeze, lifted</h1>
 <p>Error rate settled under <b>0.3%</b> after the rollback. Commit volume recovered within the hour.</p>
</div>`;

function fixtureDoc(): CanvasDoc {
	return {
		id: "story-canvas",
		title: "Canvas",
		snap: SNAP,
		version: 0,
		blocks: [
			{
				id: "b_authors",
				kind: "instrument",
				frame: { x: 48, y: 48, w: 560, h: 336, z: 1 },
				instrument: {
					title: "Top authors by commit count",
					sql: "SELECT author, count() AS commits FROM git.commits GROUP BY author ORDER BY commits DESC LIMIT {top_n:UInt32}",
					params: [
						{
							name: "top_n",
							type: "UInt32",
							control: "number",
							defaultValue: "3",
						},
					],
					present: {
						kind: "chart",
						type: "bar",
						xField: "author",
						yField: "commits",
					},
				},
				paramState: { top_n: "3" },
			},
			{
				id: "b_note",
				kind: "text",
				frame: { x: 640, y: 48, w: 320, h: 200, z: 1 },
				markdown:
					"**What moved this week.** Volume dipped the week of the 10th, then recovered fully by Friday.",
			},
			{
				id: "b_dawn",
				kind: "image",
				frame: { x: 640, y: 280, w: 320, h: 220, z: 1 },
				prompt: "a soft amber dawn over a city skyline",
				assetUrl: DAWN,
			},
			{
				id: "b_report",
				kind: "html",
				frame: { x: 992, y: 48, w: 320, h: 260, z: 2 },
				title: "Ship report",
				html: AGENT_HTML,
			},
		],
	};
}

function StoryCanvas({ children }: { children: ReactNode }) {
	installExecMock();
	const value = useMemo(
		() => ({
			store: createCanvasStore(fixtureDoc()),
			camera: createCameraStore(),
			conversationId: "storybook",
		}),
		[],
	);
	return (
		<div className="h-[720px] w-full overflow-hidden rounded-lg border">
			<CanvasProvider value={value}>{children}</CanvasProvider>
		</div>
	);
}

function DarkRoot({ children }: { children: ReactNode }) {
	// Chart tokens read the document root, so the dark story must flip the
	// real root class, not a wrapper.
	useEffect(() => {
		document.documentElement.classList.add("dark");
		return () => document.documentElement.classList.remove("dark");
	}, []);
	return <>{children}</>;
}

const meta = {
	title: "Canvas/Board",
	component: Board,
	parameters: { layout: "padded" },
	decorators: [
		(Story) => (
			<StoryCanvas>
				<Story />
			</StoryCanvas>
		),
	],
} satisfies Meta<typeof Board>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Light: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(await canvas.findAllByRole("application")).toHaveLength(4);
		const chartBlock = canvasElement.querySelector(
			'[data-block-id="b_authors"]',
		) as HTMLElement;
		await waitFor(() => expect(chartBlock.querySelector("svg")).toBeTruthy(), {
			timeout: 5000,
		});

		// Selecting a block grows its eight resize handles; a nudge moves it
		// one lattice step through the reducer.
		const note = canvasElement.querySelector(
			'[data-block-id="b_note"]',
		) as HTMLElement;
		const before = note.style.left;
		await userEvent.click(within(note).getByText(/What moved this week/));
		await waitFor(() =>
			expect(canvasElement.querySelectorAll("[data-resize]")).toHaveLength(8),
		);
		await userEvent.keyboard("{ArrowRight}");
		await waitFor(() =>
			expect(Number.parseInt(note.style.left, 10)).toBe(
				Number.parseInt(before, 10) + SNAP,
			),
		);
	},
};

export const Dark: Story = {
	decorators: [
		(Story) => (
			<DarkRoot>
				<Story />
			</DarkRoot>
		),
	],
	play: async ({ canvasElement }) => {
		const chartBlock = canvasElement.querySelector(
			'[data-block-id="b_authors"]',
		) as HTMLElement;
		await waitFor(() => expect(chartBlock.querySelector("svg")).toBeTruthy(), {
			timeout: 5000,
		});
	},
};
