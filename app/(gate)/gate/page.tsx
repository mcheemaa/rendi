import { enterAccessCode } from "@/app/actions";
import { GateView } from "@/components/gate/gate-view";

export default async function GatePage({
	searchParams,
}: {
	searchParams: Promise<{ from?: string }>;
}) {
	const { from } = await searchParams;
	return (
		<GateView
			from={typeof from === "string" ? from : undefined}
			action={enterAccessCode}
		/>
	);
}
