import type { Preview } from "@storybook/nextjs-vite";
import "../app/globals.css";

const preview: Preview = {
	parameters: {
		nextjs: { appDirectory: true },
		controls: {
			matchers: {
				color: /(background|color)$/i,
				date: /Date$/i,
			},
		},

		a11y: {
			// Accessibility is a release gate: violations fail the run.
			test: "error",
		},
	},
};

export default preview;
