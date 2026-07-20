import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	// Sibling lockfiles above the repo confuse workspace-root inference.
	turbopack: { root: path.join(__dirname) },
};

export default nextConfig;
