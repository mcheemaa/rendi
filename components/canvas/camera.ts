"use client";

import { useSyncExternalStore } from "react";
import type { CanvasDoc } from "@/lib/rendi/canvas";

// The camera is per-viewer session state: it never enters the document and
// never reads back to the agent. screen = world * zoom + offset.

export type Camera = { x: number; y: number; zoom: number };

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 2.5;

export type Viewport = { w: number; h: number };

export function contentBounds(doc: CanvasDoc) {
	if (doc.blocks.length === 0) return { x: 0, y: 0, w: 1200, h: 800 };
	const frames = doc.blocks.map((block) => block.frame);
	const minX = Math.min(...frames.map((frame) => frame.x));
	const minY = Math.min(...frames.map((frame) => frame.y));
	const maxX = Math.max(...frames.map((frame) => frame.x + frame.w));
	const maxY = Math.max(...frames.map((frame) => frame.y + frame.h));
	return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export type CameraStore = ReturnType<typeof createCameraStore>;

export function createCameraStore() {
	let camera: Camera = { x: 0, y: 0, zoom: 1 };
	const listeners = new Set<() => void>();

	const emit = () => {
		for (const listener of listeners) listener();
	};
	const get = () => camera;
	const set = (next: Camera) => {
		camera = next;
		emit();
	};
	const panBy = (dx: number, dy: number) =>
		set({ ...camera, x: camera.x + dx, y: camera.y + dy });

	// Zoom keeping the world point under the cursor fixed on screen.
	const zoomAt = (clientX: number, clientY: number, factor: number) => {
		const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, camera.zoom * factor));
		if (zoom === camera.zoom) return;
		const worldX = (clientX - camera.x) / camera.zoom;
		const worldY = (clientY - camera.y) / camera.zoom;
		set({ zoom, x: clientX - worldX * zoom, y: clientY - worldY * zoom });
	};

	const setZoom = (zoom: number, viewport: Viewport) =>
		zoomAt(viewport.w / 2, viewport.h / 2, zoom / camera.zoom);

	const fitToContent = (doc: CanvasDoc, viewport: Viewport, padding = 48) => {
		const bounds = contentBounds(doc);
		const zoom = Math.min(
			MAX_ZOOM,
			Math.max(
				MIN_ZOOM,
				Math.min(
					(viewport.w - padding * 2) / bounds.w,
					(viewport.h - padding * 2) / bounds.h,
				),
			),
		);
		set({
			zoom,
			x: (viewport.w - bounds.w * zoom) / 2 - bounds.x * zoom,
			y: (viewport.h - bounds.h * zoom) / 2 - bounds.y * zoom,
		});
	};

	const subscribe = (listener: () => void) => {
		listeners.add(listener);
		return () => listeners.delete(listener);
	};

	return { get, set, panBy, zoomAt, setZoom, fitToContent, subscribe };
}

export function useCamera(store: CameraStore): Camera {
	return useSyncExternalStore(store.subscribe, store.get, store.get);
}
