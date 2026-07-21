"use client";

import { type RefObject, useEffect, useRef } from "react";
import type { Frame } from "@/lib/rendi/canvas";
import { MIN_H, MIN_W, SNAP } from "@/lib/rendi/canvas";
import type { PlaceOp } from "@/lib/rendi/canvas-ops";
import type { CameraStore } from "./camera";
import type { CanvasStore } from "./canvas-store";

// Direct-manipulation physics: a gesture mutates only element styles at
// pointer speed, and exactly one place op commits through the reducer on
// release. The document stays pure while the hand stays at 60fps.

export type ResizeDir = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

type Gesture = { type: "drag" } | { type: "resize"; dir: ResizeDir };

const DRAG_THRESHOLD_PX = 3;

function snapTo(value: number): number {
	return Math.round(value / SNAP) * SNAP;
}

function nextFrame(
	start: Frame,
	gesture: Gesture,
	dxWorld: number,
	dyWorld: number,
): Frame {
	if (gesture.type === "drag") {
		return {
			...start,
			x: snapTo(start.x + dxWorld),
			y: snapTo(start.y + dyWorld),
		};
	}
	const dir = gesture.dir;
	let { x, y, w, h } = start;
	if (dir.includes("e")) w = snapTo(start.w + dxWorld);
	if (dir.includes("s")) h = snapTo(start.h + dyWorld);
	if (dir.includes("w")) {
		const right = start.x + start.w;
		x = snapTo(start.x + dxWorld);
		w = right - x;
	}
	if (dir.includes("n")) {
		const bottom = start.y + start.h;
		y = snapTo(start.y + dyWorld);
		h = bottom - y;
	}
	if (w < MIN_W) {
		if (dir.includes("w")) x = start.x + start.w - MIN_W;
		w = MIN_W;
	}
	if (h < MIN_H) {
		if (dir.includes("n")) y = start.y + start.h - MIN_H;
		h = MIN_H;
	}
	return { ...start, x, y, w, h };
}

function placeOpFor(id: string, start: Frame, end: Frame): PlaceOp | null {
	const op: PlaceOp = { op: "place", id };
	let changed = false;
	for (const key of ["x", "y", "w", "h"] as const) {
		if (end[key] !== start[key]) {
			op[key] = end[key];
			changed = true;
		}
	}
	return changed ? op : null;
}

export function useBlockGestures(
	store: CanvasStore,
	camera: CameraStore,
	id: string,
	frame: Frame,
	host: RefObject<HTMLDivElement | null>,
	disabled = false,
) {
	const live = useRef<{ start: Frame; end: Frame; gesture: Gesture } | null>(
		null,
	);
	const frameRef = useRef(frame);
	frameRef.current = frame;

	useEffect(() => {
		const el = host.current;
		if (!el || disabled) return;

		let origin: { x: number; y: number } | null = null;
		let gesture: Gesture | null = null;
		let moved = false;
		let raf = 0;

		const paint = () => {
			raf = 0;
			const current = live.current;
			if (!current) return;
			el.style.left = `${current.end.x}px`;
			el.style.top = `${current.end.y}px`;
			el.style.width = `${current.end.w}px`;
			el.style.height = `${current.end.h}px`;
		};

		const onPointerMove = (event: PointerEvent) => {
			if (!origin || !gesture) return;
			const dxClient = event.clientX - origin.x;
			const dyClient = event.clientY - origin.y;
			if (!moved && Math.hypot(dxClient, dyClient) < DRAG_THRESHOLD_PX) return;
			if (!moved) {
				moved = true;
				store.setDragging(true);
				el.dataset.gesturing = "true";
			}
			const zoom = camera.get().zoom;
			const start = live.current?.start ?? frameRef.current;
			const end = nextFrame(start, gesture, dxClient / zoom, dyClient / zoom);
			live.current = { start, end, gesture };
			if (!raf) raf = requestAnimationFrame(paint);
		};

		const finish = (commit: boolean) => {
			const current = live.current;
			origin = null;
			gesture = null;
			live.current = null;
			if (raf) cancelAnimationFrame(raf);
			raf = 0;
			delete el.dataset.gesturing;
			store.setDragging(false);
			if (!moved) return;
			moved = false;
			if (commit && current) {
				const op = placeOpFor(id, current.start, current.end);
				if (op) store.dispatch(op, "user");
			} else {
				el.style.left = `${frameRef.current.x}px`;
				el.style.top = `${frameRef.current.y}px`;
				el.style.width = `${frameRef.current.w}px`;
				el.style.height = `${frameRef.current.h}px`;
			}
		};

		const onPointerUp = () => finish(true);
		const onPointerCancel = () => finish(false);

		const onPointerDown = (event: PointerEvent) => {
			if (event.button !== 0) return;
			const target = event.target as HTMLElement;
			const handle = target.closest<HTMLElement>("[data-resize]");
			if (handle) {
				gesture = { type: "resize", dir: handle.dataset.resize as ResizeDir };
			} else {
				if (target.closest("[data-no-drag]")) return;
				gesture = { type: "drag" };
			}
			// preventDefault keeps the browser's mousedown focus steps and text
			// selection out of the gesture; double-press affordances must detect
			// their own double press because this suppresses dblclick synthesis.
			event.preventDefault();
			event.stopPropagation();
			origin = { x: event.clientX, y: event.clientY };
			moved = false;
			el.setPointerCapture(event.pointerId);
		};

		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape" && origin) finish(false);
		};

		el.addEventListener("pointerdown", onPointerDown);
		el.addEventListener("pointermove", onPointerMove);
		el.addEventListener("pointerup", onPointerUp);
		el.addEventListener("pointercancel", onPointerCancel);
		window.addEventListener("keydown", onKeyDown);
		return () => {
			el.removeEventListener("pointerdown", onPointerDown);
			el.removeEventListener("pointermove", onPointerMove);
			el.removeEventListener("pointerup", onPointerUp);
			el.removeEventListener("pointercancel", onPointerCancel);
			window.removeEventListener("keydown", onKeyDown);
		};
	}, [store, camera, id, host, disabled]);
}
