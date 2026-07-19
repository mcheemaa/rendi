import { logger, task, wait } from "@trigger.dev/sdk";

export const helloWorldTask = task({
	id: "hello-world",
	maxDuration: 300,
	run: async (payload: { message: string }) => {
		logger.log("Hello, world!", { payload });

		await wait.for({ seconds: 5 });

		return {
			message: `Hello, ${payload.message}`,
		};
	},
});
