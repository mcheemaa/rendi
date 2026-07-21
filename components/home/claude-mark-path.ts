// Vertex morph for the official Claude sunburst. The path is parsed once
// into absolute commands with per-point polar coordinates; each frame every
// coordinate (curve control points included) is displaced along a smooth
// polar field and the path is rebuilt. The field is continuous in angle and
// pinned at the center, so the artwork flexes like soft tissue and can
// never tear. At zero amplitude the geometry is the official art exactly.

const CENTER = 124;

type PolarPoint = { r: number; a: number; w: number };
type PathCommand = { op: "M" | "L" | "C" | "Z"; polar: PolarPoint[] };

export type MorphAmplitudes = {
	inOut: number;
	turn: number;
	breathe: number;
};

function toPolar(x: number, y: number): PolarPoint {
	const dx = x - CENTER;
	const dy = y - CENTER;
	const r = Math.hypot(dx, dy);
	const raw = Math.min(1, Math.max(0, (r - 34) / 78));
	return { r, a: Math.atan2(dy, dx), w: raw * raw * (3 - 2 * raw) };
}

export function parseClaudePath(d: string): PathCommand[] | null {
	const chunks = d.match(/([MLHVCZ])([^MLHVCZ]*)/gi);
	if (!chunks) return null;
	const commands: PathCommand[] = [];
	let x = 0;
	let y = 0;
	for (const chunk of chunks) {
		const op = chunk[0];
		const nums = (chunk.slice(1).match(/-?\d*\.?\d+(?:e-?\d+)?/gi) ?? []).map(
			Number,
		);
		if (op === "M" || op === "L") {
			for (let i = 0; i + 1 < nums.length; i += 2) {
				x = nums[i];
				y = nums[i + 1];
				commands.push({ op: i === 0 ? op : "L", polar: [toPolar(x, y)] });
			}
		} else if (op === "H") {
			for (const n of nums) {
				x = n;
				commands.push({ op: "L", polar: [toPolar(x, y)] });
			}
		} else if (op === "V") {
			for (const n of nums) {
				y = n;
				commands.push({ op: "L", polar: [toPolar(x, y)] });
			}
		} else if (op === "C") {
			for (let i = 0; i + 5 < nums.length; i += 6) {
				const polar = [
					toPolar(nums[i], nums[i + 1]),
					toPolar(nums[i + 2], nums[i + 3]),
					toPolar(nums[i + 4], nums[i + 5]),
				];
				x = nums[i + 4];
				y = nums[i + 5];
				commands.push({ op: "C", polar });
			}
		} else if (op === "Z" || op === "z") {
			commands.push({ op: "Z", polar: [] });
		} else {
			return null;
		}
	}
	return commands;
}

export function morphClaudePath(
	commands: PathCommand[],
	t: number,
	k: MorphAmplitudes,
): string {
	const parts: string[] = [];
	for (const cmd of commands) {
		if (cmd.op === "Z") {
			parts.push("Z");
			continue;
		}
		const coords: string[] = [];
		for (const p of cmd.polar) {
			const reach =
				1 +
				k.inOut *
					p.w *
					(Math.sin(2 * p.a + t * 0.5) +
						0.7 * Math.sin(3 * p.a - t * 0.36 + 1.3)) +
				k.breathe * Math.sin(t * 1.5);
			const turn =
				k.turn *
				p.w *
				(Math.sin(p.a + t * 0.42 + 0.7) + 0.6 * Math.sin(2 * p.a - t * 0.31));
			const r = p.r * reach;
			const a = p.a + turn;
			coords.push(
				(CENTER + r * Math.cos(a)).toFixed(2),
				(CENTER + r * Math.sin(a)).toFixed(2),
			);
		}
		parts.push(cmd.op + coords.join(" "));
	}
	return parts.join("");
}
