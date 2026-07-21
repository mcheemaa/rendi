"use client";

import { createContext, useContext } from "react";
import type { CameraStore } from "./camera";
import type { CanvasStore } from "./canvas-store";

export type CanvasContextValue = {
	store: CanvasStore;
	camera: CameraStore;
	conversationId: string;
};

const CanvasContext = createContext<CanvasContextValue | null>(null);

export const CanvasProvider = CanvasContext.Provider;

export function useCanvas(): CanvasContextValue {
	const value = useContext(CanvasContext);
	if (!value) throw new Error("useCanvas outside a CanvasProvider");
	return value;
}
