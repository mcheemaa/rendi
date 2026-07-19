import { cn } from "@/lib/utils";
import styles from "./brand.module.css";
import { WORD_DOT, WORD_PATH } from "./paths";

export function RendiWordmark({
	working = false,
	entrance = true,
	className,
}: {
	working?: boolean;
	entrance?: boolean;
	className?: string;
}) {
	return (
		<span
			className={cn(
				"inline-flex",
				styles.wordmark,
				entrance && styles.entrance,
				working && styles.working,
				className,
			)}
		>
			<svg viewBox="0 0 430 220" role="img" aria-label="rendi">
				<path className={styles.ink} pathLength={1} d={WORD_PATH} />
				<path
					className={styles.sheen}
					pathLength={1}
					d={WORD_PATH}
					aria-hidden
				/>
				<circle className={styles.dot} {...WORD_DOT} />
			</svg>
		</span>
	);
}
