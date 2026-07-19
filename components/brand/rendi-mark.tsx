import { cn } from "@/lib/utils";
import styles from "./brand.module.css";
import { MARK_DOT, MARK_PATH } from "./paths";

export function RendiMark({
	working = false,
	className,
}: {
	working?: boolean;
	className?: string;
}) {
	return (
		<span
			className={cn(
				"inline-flex",
				styles.wordmark,
				styles.mark,
				working && styles.working,
				className,
			)}
		>
			<svg viewBox="0 0 132 120" role="img" aria-label="rendi">
				<path className={styles.ink} pathLength={1} d={MARK_PATH} />
				<path
					className={styles.sheen}
					pathLength={1}
					d={MARK_PATH}
					aria-hidden
				/>
				<circle className={styles.dot} {...MARK_DOT} />
			</svg>
		</span>
	);
}
