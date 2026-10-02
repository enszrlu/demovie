import { VERSION } from "@demovie/core";
import type { CommandContext } from "../context.ts";
import type { CommandResult } from "../output.ts";

/** `demovie mcp` (SPEC §14.3): MCP server on stdio. Logs go to stderr; stdout carries only the protocol. */
export async function run(ctx: CommandContext): Promise<CommandResult> {
  const { serveStdio } = await import("@demovie/mcp");
  const { mcpHandlers } = await import("../mcp-handlers.ts");
  ctx.logger.configure({ color: false });
  await serveStdio(mcpHandlers(ctx.cwd), { version: VERSION });
  // the session is over; print nothing on stdout
  return { data: {}, human: [] };
}
