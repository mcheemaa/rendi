import { MARK_DOT, MARK_PATH } from "@/components/brand/paths";
import { ClaudeMark } from "@/components/home/claude-mark";
import { cn } from "@/lib/utils";

const REST = "fill-muted-foreground/50 transition-[fill] duration-300";
const REST_STROKE =
	"fill-none stroke-muted-foreground/50 transition-[stroke] duration-300";

// The built-with row: rendi first, then the stack in the order the work
// flows. Muted at rest; each mark blooms into its owner's true color on
// hover. Geometry is never redrawn: rendi's comes from brand/paths.ts, the
// rest from each company's published SVG (see brand/vendors/README.md).
export function Hallmark({ className }: { className?: string }) {
	return (
		<div
			role="img"
			aria-label="Rendi is built with Claude, ClickHouse, and Trigger.dev"
			className={cn("flex items-center justify-center gap-6", className)}
		>
			<svg
				viewBox="0 0 132 120"
				className="group/rendi h-6 w-[26px] overflow-visible"
				aria-hidden="true"
			>
				<path
					d={MARK_PATH}
					strokeWidth={15}
					strokeLinecap="round"
					strokeLinejoin="round"
					className={cn(REST_STROKE, "group-hover/rendi:stroke-foreground")}
				/>
				<circle
					{...MARK_DOT}
					r={11}
					className={cn(REST, "group-hover/rendi:fill-[#e8a33d]")}
				/>
			</svg>
			<ClaudeMark
				className="group/claude size-[26px]"
				pathClassName={cn(REST, "group-hover/claude:fill-[#d97757]")}
			/>
			<svg
				viewBox="0 0 34 34"
				className="group/ch size-[22px] overflow-visible"
				aria-hidden="true"
			>
				<g
					className={cn(
						REST,
						"group-hover/ch:fill-[#151515] dark:group-hover/ch:fill-[#fcff74]",
					)}
				>
					<rect width="3.78" height="34" rx="0.92" />
					<rect x="7.56" width="3.78" height="34" rx="0.92" />
					<rect x="15.11" width="3.78" height="34" rx="0.92" />
					<rect x="22.66" width="3.78" height="34" rx="0.92" />
					<rect x="30.22" y="13.22" width="3.78" height="7.56" rx="0.92" />
				</g>
			</svg>
			<svg
				viewBox="0 0 321 282"
				className="group/trigger h-[21px] w-6 overflow-visible"
				aria-hidden="true"
			>
				<defs>
					<linearGradient id="hallmark-trigger" x1="1" y1="0" x2="0" y2="0">
						<stop offset="0" stopColor="#41FF54" />
						<stop offset="1" stopColor="#E7FF52" />
					</linearGradient>
				</defs>
				<path
					fillRule="evenodd"
					clipRule="evenodd"
					className={cn(
						REST,
						"group-hover/trigger:fill-[url(#hallmark-trigger)]",
					)}
					d="M96.1017 113.4L160.679 4.57764e-05L320.718 281.045H0.638916L65.2159 167.642L110.896 194.382L92.0035 227.561H229.354L160.679 106.965L141.786 140.144L96.1017 113.4Z"
				/>
			</svg>
		</div>
	);
}
