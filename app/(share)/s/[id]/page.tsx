import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShareBoard } from "@/components/canvas/share-board";
import { getDb } from "@/lib/db";
import { conversations } from "@/lib/db/schema";
import { loadCanvas } from "@/lib/rendi/harness/canvas-db";
import { verifyRenderToken } from "@/lib/rendi/render-token";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Shared board · Rendi" };

type Props = {
	params: Promise<{ id: string }>;
	searchParams: Promise<{ t?: string }>;
};

export default async function SharePage({ params, searchParams }: Props) {
	const { id } = await params;
	const { t } = await searchParams;
	if (!t || !verifyRenderToken(id, t, "share")) notFound();
	const canvas = await loadCanvas(id);
	if (!canvas) notFound();
	const [conversation] = await getDb()
		.select({ title: conversations.title })
		.from(conversations)
		.where(eq(conversations.id, id))
		.limit(1);

	return (
		<div className="flex h-dvh flex-col bg-background text-foreground">
			<header className="flex shrink-0 items-center gap-3 border-b px-4 py-2">
				<span className="font-display text-lg leading-none">rendi</span>
				<span className="truncate text-sm text-muted-foreground">
					{conversation?.title ?? "Shared board"}
				</span>
				<span className="ml-auto font-mono text-[10.5px] tracking-[0.14em] text-muted-foreground uppercase">
					live board · steer freely
				</span>
			</header>
			<main className="min-h-0 flex-1">
				<ShareBoard conversationId={id} initialDoc={canvas.doc} />
			</main>
		</div>
	);
}
