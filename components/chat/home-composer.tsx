"use client";

import { useRouter } from "next/navigation";
import { Composer } from "@/components/chat/composer";

export function HomeComposer() {
	const router = useRouter();
	return (
		<Composer
			status="ready"
			autoFocus
			onStop={() => {}}
			onSend={(text) => {
				const chatId = crypto.randomUUID();
				sessionStorage.setItem(`rendi:draft:${chatId}`, text);
				router.push(`/c/${chatId}`);
			}}
		/>
	);
}
