"use client";

import { CalendarIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { InstrumentSpec } from "@/lib/rendi/instrument";

type Param = InstrumentSpec["params"][number];

const TIMERANGE_PRESETS = [
	{ label: "Now", value: "now" },
	{ label: "Last 24 hours", value: "now-24h" },
	{ label: "Last 7 days", value: "now-7d" },
	{ label: "Last 30 days", value: "now-30d" },
	{ label: "Last 90 days", value: "now-90d" },
	{ label: "All time", value: "1970-01-01T00:00:00Z" },
];

export function ParamControls({
	params,
	values,
	onSteer,
	busy = false,
}: {
	params: Param[];
	values: Record<string, string>;
	onSteer: (name: string, value: string) => void;
	busy?: boolean;
}) {
	if (params.length === 0) return null;
	return (
		<div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-2.5">
			{params.map((param) => (
				<span
					key={param.name}
					className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground"
				>
					{param.name}
					<Control
						param={param}
						value={values[param.name] ?? param.defaultValue}
						onSteer={onSteer}
						busy={busy}
					/>
				</span>
			))}
		</div>
	);
}

function Control({
	param,
	value,
	onSteer,
	busy,
}: {
	param: Param;
	value: string;
	onSteer: (name: string, value: string) => void;
	busy: boolean;
}) {
	if (param.control === "timerange") {
		return (
			<TimerangeControl
				param={param}
				value={value}
				onSteer={onSteer}
				busy={busy}
			/>
		);
	}
	if (param.control === "select") {
		return (
			<Select
				value={value}
				onValueChange={(next) => {
					if (typeof next === "string") onSteer(param.name, next);
				}}
				disabled={busy}
			>
				<SelectTrigger
					size="sm"
					className="h-7 gap-1 font-mono text-xs"
					aria-label={param.name}
				>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{(param.options ?? []).map((option) => (
						<SelectItem
							key={option}
							value={option}
							className="font-mono text-xs"
						>
							{option}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		);
	}
	return (
		<CommitInput param={param} value={value} onSteer={onSteer} busy={busy} />
	);
}

// Free inputs commit on Enter or blur, never per keystroke: every commit is
// a live query.
function CommitInput({
	param,
	value,
	onSteer,
	busy,
}: {
	param: Param;
	value: string;
	onSteer: (name: string, value: string) => void;
	busy: boolean;
}) {
	const [draft, setDraft] = useState(value);
	const commit = () => {
		const next = draft.trim();
		if (next && next !== value) onSteer(param.name, next);
		else setDraft(value);
	};
	return (
		<Input
			value={draft}
			onChange={(event) => setDraft(event.target.value)}
			onBlur={commit}
			onKeyDown={(event) => {
				if (event.key === "Enter") {
					event.preventDefault();
					commit();
				}
			}}
			disabled={busy}
			inputMode={param.control === "number" ? "numeric" : "text"}
			aria-label={param.name}
			className={
				param.control === "number"
					? "h-7 w-20 px-2 font-mono text-xs"
					: "h-7 w-36 px-2 font-mono text-xs"
			}
		/>
	);
}

function TimerangeControl({
	param,
	value,
	onSteer,
	busy,
}: {
	param: Param;
	value: string;
	onSteer: (name: string, value: string) => void;
	busy: boolean;
}) {
	const [pickerOpen, setPickerOpen] = useState(false);
	const preset = TIMERANGE_PRESETS.some((option) => option.value === value);
	const custom = !preset ? value : undefined;
	const customDate = custom ? new Date(custom) : undefined;
	// items lets the trigger render "Last 7 days", never the raw token; an
	// agent-authored value outside the presets (a date, a relative token)
	// shows as a picked date or as itself.
	const customLabel =
		customDate && !Number.isNaN(customDate.getTime())
			? `Since ${formatDay(customDate)}`
			: custom;
	const items = custom
		? [...TIMERANGE_PRESETS, { label: customLabel, value: custom }]
		: TIMERANGE_PRESETS;

	return (
		<span className="flex items-center gap-1">
			<Select
				value={value}
				items={items}
				onValueChange={(next) => {
					if (typeof next === "string") onSteer(param.name, next);
				}}
				disabled={busy}
			>
				<SelectTrigger
					size="sm"
					className="h-7 gap-1 font-mono text-xs"
					aria-label={param.name}
				>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{TIMERANGE_PRESETS.map((option) => (
						<SelectItem
							key={option.value}
							value={option.value}
							className="font-mono text-xs"
						>
							{option.label}
						</SelectItem>
					))}
					{custom ? (
						<SelectItem value={custom} className="font-mono text-xs">
							{customLabel}
						</SelectItem>
					) : null}
				</SelectContent>
			</Select>
			<Popover open={pickerOpen} onOpenChange={setPickerOpen}>
				<PopoverTrigger
					render={
						<Button
							variant="ghost"
							size="icon"
							className="size-7 text-muted-foreground"
							disabled={busy}
							aria-label={`Pick a date for ${param.name}`}
						>
							<CalendarIcon className="size-3.5" />
						</Button>
					}
				/>
				<PopoverContent className="w-auto p-0" align="start">
					<Calendar
						mode="single"
						selected={customDate}
						onSelect={(day) => {
							if (!day) return;
							setPickerOpen(false);
							onSteer(param.name, toUtcMidnight(day));
						}}
					/>
				</PopoverContent>
			</Popover>
		</span>
	);
}

// The calendar hands back a local-midnight Date; the instrument binds UTC.
function toUtcMidnight(day: Date): string {
	const utc = new Date(
		Date.UTC(day.getFullYear(), day.getMonth(), day.getDate()),
	);
	return utc.toISOString().replace(".000Z", "Z");
}

// The bound value is UTC midnight; the label must read the same day.
function formatDay(day: Date): string {
	return day.toLocaleDateString("en-US", {
		timeZone: "UTC",
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}
