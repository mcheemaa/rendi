"use client";

import { useSyncExternalStore } from "react";
import type { CanvasDoc } from "@/lib/rendi/canvas";
import { type Actor, applyOps, type OpEntry } from "@/lib/rendi/canvas-ops";

// The client half of the single-writer story: every mutation flows through
// dispatch, which applies the shared reducer and hands the entry to the
// sink (the ops route, wired in C3). The board renders this store only.

export type CanvasEvent = {
	seq: number;
	at: string;
	actor: Actor;
	entry: OpEntry;
};

export type CanvasState = {
	doc: CanvasDoc;
	log: CanvasEvent[];
	selectedId: string | null;
	dragging: boolean;
};

export type CanvasStore = ReturnType<typeof createCanvasStore>;

export function createCanvasStore(
	initial: CanvasDoc,
	sink?: (event: CanvasEvent) => void,
) {
	let state: CanvasState = {
		doc: initial,
		log: [],
		selectedId: null,
		dragging: false,
	};
	const listeners = new Set<() => void>();

	const emit = () => {
		for (const listener of listeners) listener();
	};

	const dispatch = (entry: OpEntry, actor: Actor) => {
		const event: CanvasEvent = {
			seq: state.log.length + 1,
			at: new Date().toISOString(),
			actor,
			entry,
		};
		state = {
			...state,
			doc: applyOps(state.doc, entry),
			log: [...state.log, event],
		};
		emit();
		sink?.(event);
	};

	const select = (id: string | null) => {
		if (state.selectedId === id) return;
		state = { ...state, selectedId: id };
		emit();
	};

	const setDragging = (dragging: boolean) => {
		if (state.dragging === dragging) return;
		state = { ...state, dragging };
		emit();
	};

	// Server truth arriving from outside a local dispatch (load, another
	// tab, a rebase) replaces the document without touching the log.
	const adopt = (doc: CanvasDoc) => {
		state = { ...state, doc };
		emit();
	};

	const getState = () => state;
	const subscribe = (listener: () => void) => {
		listeners.add(listener);
		return () => listeners.delete(listener);
	};

	return { dispatch, select, setDragging, adopt, getState, subscribe };
}

export function useCanvasStore<T>(
	store: CanvasStore,
	selector: (state: CanvasState) => T,
): T {
	return useSyncExternalStore(
		store.subscribe,
		() => selector(store.getState()),
		() => selector(store.getState()),
	);
}
