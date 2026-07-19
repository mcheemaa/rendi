import { renderInstrument } from "./render-instrument";

// Every tool Rendi could carry. The agent file's `tools` list decides which of
// these are actually wired; an unknown name there fails at boot.
export const toolRegistry = {
	"render-instrument": renderInstrument,
};
