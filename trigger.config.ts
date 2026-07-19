import { readFile } from "node:fs/promises";
import { esbuildPlugin } from "@trigger.dev/core/v3/build";
import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
	project: "proj_mgvwxxgvbdhjiaujezlc",
	runtime: "node",
	logLevel: "log",
	maxDuration: 3600,
	retries: {
		enabledInDev: true,
		default: {
			maxAttempts: 3,
			minTimeoutInMs: 1000,
			maxTimeoutInMs: 10000,
			factor: 2,
			randomize: true,
		},
	},
	dirs: ["./trigger"],
	build: {
		extensions: [
			esbuildPlugin({
				name: "md-as-text",
				setup(build) {
					build.onLoad({ filter: /\.md$/ }, async (args) => ({
						contents: await readFile(args.path, "utf8"),
						loader: "text",
					}));
				},
			}),
		],
	},
});
