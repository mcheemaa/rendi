const RELATIVE_PATTERN = /^now(?:-(\d+)([mhdw]))?$/;

const UNIT_MS = {
	m: 60_000,
	h: 3_600_000,
	d: 86_400_000,
	w: 604_800_000,
} as const;

export function resolveTimeValue(value: string, now = new Date()): Date {
	const relative = value.match(RELATIVE_PATTERN);
	if (relative) {
		const [, amount, unit] = relative;
		const offset = amount
			? Number(amount) * UNIT_MS[unit as keyof typeof UNIT_MS]
			: 0;
		return new Date(now.getTime() - offset);
	}
	const absolute = new Date(value);
	if (!Number.isNaN(absolute.getTime())) {
		return absolute;
	}
	throw new Error(
		`Cannot resolve "${value}" as a time: expected ISO 8601 or a relative token like now-30d`,
	);
}
