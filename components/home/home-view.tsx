"use client";

import { useRouter } from "next/navigation";
import { Composer } from "@/components/chat/composer";
import { AmbientWave } from "@/components/home/ambient-wave";
import { HomeEmptyState } from "@/components/home/home-empty-state";

export function HomeView() {
	const router = useRouter();
	const start = (text: string) => {
		const chatId = crypto.randomUUID();
		sessionStorage.setItem(`rendi:draft:${chatId}`, text);
		router.push(`/c/${chatId}`);
	};

	return (
		<div className="relative flex min-h-0 flex-1 flex-col">
			<AmbientWave />
			<div className="relative z-[1] min-h-0 flex-1 overflow-hidden">
				<HomeEmptyState onPick={start} />
			</div>
			<div className="relative z-[1]">
				<Composer status="ready" autoFocus onStop={() => {}} onSend={start} />
			</div>
		</div>
	);
}
