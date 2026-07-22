import { applyCanvasOps } from "./apply-canvas-ops";
import { createShareLink } from "./create-share-link";
import { generateImage } from "./generate-image";
import { loadDataset } from "./load-dataset";
import { pulseOps } from "./pulse-ops";
import { queryData } from "./query-data";
import { renderInstrument } from "./render-instrument";
import { screenshotCanvas } from "./screenshot-canvas";
import { sendEmail } from "./send-email";

// Every tool Rendi could carry. The agent file's `tools` list decides which of
// these are actually wired; an unknown name there fails at boot.
export const toolRegistry = {
	"render-instrument": renderInstrument,
	"query-data": queryData,
	"apply-canvas-ops": applyCanvasOps,
	"screenshot-canvas": screenshotCanvas,
	"generate-image": generateImage,
	"pulse-ops": pulseOps,
	"load-dataset": loadDataset,
	"create-share-link": createShareLink,
	"send-email": sendEmail,
};
