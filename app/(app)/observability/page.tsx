import type { Metadata } from "next";
import { ObservabilityView } from "@/components/observability/observability-view";

export const metadata: Metadata = { title: "Observability · Rendi" };

export default function ObservabilityPage() {
	return <ObservabilityView />;
}
