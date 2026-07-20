"use client";

import { usePathname } from "next/navigation";
import type { ConversationRef } from "@/components/shell/app-shell";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function AppTopbar({
	conversations,
}: {
	conversations: ConversationRef[];
}) {
	const pathname = usePathname() ?? "/";
	const id = pathname.startsWith("/c/") ? pathname.slice(3) : undefined;
	const title = id
		? conversations.find((conversation) => conversation.id === id)?.title
		: undefined;
	return (
		<header className="flex h-13 shrink-0 items-center gap-2 border-b px-4">
			<SidebarTrigger className="-ml-1" />
			<Separator
				orientation="vertical"
				className="mr-1 data-vertical:h-4 data-vertical:self-auto"
			/>
			<Breadcrumb>
				<BreadcrumbList>
					<BreadcrumbItem>
						<BreadcrumbLink href="/">rendi</BreadcrumbLink>
					</BreadcrumbItem>
					{title && (
						<>
							<BreadcrumbSeparator />
							<BreadcrumbItem>
								<BreadcrumbPage>{title}</BreadcrumbPage>
							</BreadcrumbItem>
						</>
					)}
				</BreadcrumbList>
			</Breadcrumb>
		</header>
	);
}
