import { type NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE, verifyAccessToken } from "@/lib/rendi/access";

// The deployed instance is a private demo behind one door: a valid
// access code becomes a signed thirty-day cookie. Share pages, the
// screenshot renderer, and the endpoints they need stay open; each
// carries its own scoped token or serves only unguessable ids. With no
// ACCESS_TOKEN_SECRET configured (local dev), the gate does not exist.
export async function middleware(request: NextRequest) {
	const secret = process.env.ACCESS_TOKEN_SECRET;
	if (!secret) return NextResponse.next();
	const token = request.cookies.get(ACCESS_COOKIE)?.value;
	if (token && (await verifyAccessToken(secret, token))) {
		return NextResponse.next();
	}
	const gate = new URL("/gate", request.url);
	const { pathname } = request.nextUrl;
	if (pathname !== "/") gate.searchParams.set("from", pathname);
	return NextResponse.redirect(gate);
}

export const config = {
	matcher: [
		"/((?!gate|s/|internal/|api/images|api/canvas|api/instruments|vendor/|_next/|.*\\.).*)",
	],
};
