import { claude } from "./claude.ts";
import { codex } from "./codex.ts";
import { cursor } from "./cursor.ts";
import type { AgentAdapter } from "./types.ts";

export { CLAUDE_ALLOWED_TOOLS, claudeDeniedTools } from "./claude.ts";
export { customAdapter, splitCommand } from "./custom.ts";
export * from "./types.ts";

export const ADAPTERS: Record<"claude" | "codex" | "cursor", AgentAdapter> = { claude, codex, cursor };
