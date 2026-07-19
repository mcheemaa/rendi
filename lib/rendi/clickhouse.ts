import { createClient } from "@clickhouse/client";

function required(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(`${name} is not set`);
	}
	return value;
}

// Seeding and migrations only. Everything that serves a user query goes
// through clickhouseReader: SELECT-only grants plus a readonly setting.
export function clickhouseAdmin() {
	return createClient({
		url: required("CLICKHOUSE_URL"),
		username: process.env.CLICKHOUSE_USER ?? "default",
		password: required("CLICKHOUSE_PASSWORD"),
	});
}

export function clickhouseReader() {
	return createClient({
		url: required("CLICKHOUSE_URL"),
		username: "rendi_reader",
		password: required("CLICKHOUSE_READER_PASSWORD"),
	});
}
