import { readFile } from "node:fs/promises";
import type { BuildExtension } from "@trigger.dev/build";
import { playwright } from "@trigger.dev/build/extensions/playwright";
import { esbuildPlugin } from "@trigger.dev/core/v3/build";
import { defineConfig } from "@trigger.dev/sdk";

const DD_CLI_VERSION = "v0.2.2";
const DD_CLI_SHA256 =
	"1be803988e41a3f4f093df80e0ea5065940dda8343c565284e26b1d5a8fd289c";

// Bakes the official DoorDash CLI into deployed worker images, pinned and
// checksum-verified against the published release. Dev machines use their
// own login-authenticated install; deployed workers authenticate through
// DD_CLI_ACCESS_TOKEN.
function ddCli(): BuildExtension {
	const asset = `dd-cli-${DD_CLI_VERSION}-linux-amd64`;
	return {
		name: "dd-cli",
		onBuildComplete(context) {
			if (context.target === "dev") return;
			context.addLayer({
				id: "dd-cli",
				image: {
					instructions: [
						`RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
        && apt-get clean && rm -rf /var/lib/apt/lists/*`,
						`RUN curl -fsSL https://github.com/doordash-oss/doordash-cli/releases/download/${DD_CLI_VERSION}/${asset}.tar.gz -o /tmp/dd-cli.tar.gz \
        && echo "${DD_CLI_SHA256}  /tmp/dd-cli.tar.gz" | sha256sum -c - \
        && tar -xzf /tmp/dd-cli.tar.gz -C /tmp \
        && mv /tmp/${asset}/${asset} /usr/local/bin/dd-cli \
        && chmod +x /usr/local/bin/dd-cli \
        && rm -rf /tmp/dd-cli.tar.gz /tmp/${asset}`,
					],
				},
			});
		},
	};
}

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
		// Playwright resolves at runtime from node_modules: its optional
		// chromium-bidi requires break the bundler, and the browser binary
		// could never live in a bundle anyway. The extension bakes chromium
		// into deployed worker images and leaves dev untouched.
		external: ["playwright", "playwright-core", "chromium-bidi"],
		extensions: [
			playwright(),
			ddCli(),
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
