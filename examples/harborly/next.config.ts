import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Without this, `next dev` writes AGENTS.md/CLAUDE.md into the fixture whenever an AI agent runs it.
  agentRules: false,
};

export default nextConfig;
