import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import {
	Geist_Mono,
	Instrument_Sans,
	Instrument_Serif,
} from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const instrumentSans = Instrument_Sans({
	variable: "--font-instrument-sans",
	subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
	variable: "--font-instrument-serif",
	weight: "400",
	style: ["normal", "italic"],
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "Rendi",
	description: "Questions become instruments.",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html
			lang="en"
			suppressHydrationWarning
			className={`${instrumentSans.variable} ${instrumentSerif.variable} ${geistMono.variable} h-full antialiased`}
		>
			{/* suppressHydrationWarning: browser extensions (ColorZilla etc.) inject
			    body attributes pre-hydration; children are still validated. */}
			<body
				suppressHydrationWarning
				className="flex h-full flex-col overflow-hidden overscroll-none"
			>
				<Providers>{children}</Providers>
				<Analytics />
			</body>
		</html>
	);
}
