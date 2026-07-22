import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, waitFor } from "storybook/test";
import { HtmlBlockBody } from "./html-block";

// The frame's opaque origin blocks the parent from reading its DOM, which
// is the sandbox working as designed; the page reports its own result via
// postMessage instead, so this story proves the whole chain end to end:
// base URL resolution, CSP allowing the vendored script, D3 executing.
const spikeMessages: { type?: string; version?: string; circles?: number }[] =
	[];
if (typeof window !== "undefined") {
	window.addEventListener("message", (event) => {
		if (event.data?.type === "d3-spike") spikeMessages.push(event.data);
	});
}

const SPIKE_HTML = `
<div id="stage"></div>
<script src="/vendor/d3.v7.min.js"></script>
<script>
const svg = d3.select("#stage").append("svg").attr("width", 360).attr("height", 240);
const angle = d3.scaleLinear().domain([0, 59]).range([0, 6 * Math.PI]);
const radius = d3.scaleSqrt().domain([0, 59]).range([4, 110]);
svg.selectAll("circle")
  .data(d3.range(60))
  .join("circle")
  .attr("cx", (i) => 180 + Math.cos(angle(i)) * radius(i))
  .attr("cy", (i) => 120 + Math.sin(angle(i)) * radius(i))
  .attr("r", 3)
  .attr("fill", "currentColor");
parent.postMessage({ type: "d3-spike", version: d3.version, circles: svg.selectAll("circle").size() }, "*");
</script>`;

const meta = {
	title: "Canvas/HtmlBlock",
	component: HtmlBlockBody,
	parameters: { layout: "padded" },
} satisfies Meta<typeof HtmlBlockBody>;

export default meta;
type Story = StoryObj<typeof meta>;

export const VendoredD3: Story = {
	args: {
		block: {
			id: "spike-d3",
			kind: "html",
			title: "D3 spiral",
			html: SPIKE_HTML,
			frame: { x: 0, y: 0, w: 440, h: 340, z: 1 },
		},
		selected: true,
	},
	play: async () => {
		await waitFor(
			() => {
				const report = spikeMessages.at(-1);
				expect(report?.version).toBe("7.9.0");
				expect(report?.circles).toBe(60);
			},
			{ timeout: 10_000 },
		);
	},
};
