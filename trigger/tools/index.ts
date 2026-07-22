import { applyCanvasOps } from "./apply-canvas-ops";
import { generateImage } from "./generate-image";
import { pulseOps } from "./pulse-ops";
import { queryData } from "./query-data";
import { renderInstrument } from "./render-instrument";
import { screenshotCanvas } from "./screenshot-canvas";

// Every tool Rendi could carry. The agent file's `tools` list decides which of
// these are actually wired; an unknown name there fails at boot.
export const toolRegistry = {
	"render-instrument": renderInstrument,
	"query-data": queryData,
	"apply-canvas-ops": applyCanvasOps,
	"screenshot-canvas": screenshotCanvas,
	"generate-image": generateImage,
	"pulse-ops": pulseOps,
};
