import { notFound } from "next/navigation";
import { RenderBoard } from "@/components/canvas/render-board";
import { loadCanvas } from "@/lib/rendi/harness/canvas-db";
import { verifyRenderToken } from "@/lib/rendi/render-token";

export const dynamic = "force-dynamic";

export default async function CanvasRenderPage({
	params,
	searchParams,
}: {
	params: Promise<{ id: string }>;
	searchParams: Promise<{ token?: string; theme?: string }>;
}) {
	const { id } = await params;
	const { token, theme } = await searchParams;
	if (!token || !verifyRenderToken(id, token)) notFound();
	const canvas = await loadCanvas(id);
	if (!canvas) notFound();
	return (
		<RenderBoard
			doc={canvas.doc}
			conversationId={id}
			theme={theme === "dark" ? "dark" : "light"}
		/>
	);
}
