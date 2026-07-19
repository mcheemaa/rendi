// Placeholder nav data until the conversation and instrument stores land.
export const conversations = [
	{ id: "daily-commit-rhythm", title: "Daily commit rhythm", active: true },
	{ id: "weekend-shippers", title: "Who ships on weekends", active: false },
];

export const instruments = [
	{ id: "daily-commit-rhythm", title: "Daily commit rhythm", kind: "bar" },
	{ id: "star-history", title: "Star history, trigger.dev", kind: "line" },
	{ id: "top-authors", title: "Top authors, 90 days", kind: "bar" },
] as const;
