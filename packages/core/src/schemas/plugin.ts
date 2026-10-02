import { z } from "zod";

/** Claude Code plugin manifest (`.claude-plugin/plugin.json`), checked against the plugin docs (DECISIONS). */
export const PluginManifestSchema = z
  .object({
    name: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "kebab-case"),
    version: z.string().optional(),
    description: z.string().optional(),
    author: z.object({ name: z.string(), email: z.string().optional(), url: z.string().optional() }).optional(),
    homepage: z.string().optional(),
    repository: z.string().optional(),
    license: z.string().optional(),
    keywords: z.array(z.string()).optional(),
  })
  .strict()
  .describe("Claude Code plugin manifest (plugins/demovie/.claude-plugin/plugin.json)");
export type PluginManifest = z.infer<typeof PluginManifestSchema>;

/** Plugin marketplace (`.claude-plugin/marketplace.json`); local sources must start with "./". */
export const MarketplaceSchema = z
  .object({
    name: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "kebab-case"),
    owner: z.object({ name: z.string(), email: z.string().optional(), url: z.string().optional() }),
    metadata: z.object({ description: z.string().optional(), version: z.string().optional() }).optional(),
    plugins: z
      .array(
        z.object({
          name: z.string(),
          source: z.string().startsWith("./"),
          description: z.string().optional(),
          version: z.string().optional(),
          license: z.string().optional(),
          keywords: z.array(z.string()).optional(),
        }),
      )
      .min(1),
  })
  .describe("Claude Code plugin marketplace (.claude-plugin/marketplace.json)");
export type Marketplace = z.infer<typeof MarketplaceSchema>;

/** `.mcp.json` of a plugin (and Cursor's `.cursor/mcp.json`). */
export const McpJsonSchema = z
  .object({
    mcpServers: z.record(
      z.string(),
      z.object({
        type: z.literal("stdio").optional(),
        command: z.string(),
        args: z.array(z.string()).default([]),
        env: z.record(z.string(), z.string()).optional(),
      }),
    ),
  })
  .describe("MCP server registration (.mcp.json)");
export type McpJson = z.infer<typeof McpJsonSchema>;

/** Agent Skills frontmatter (agentskills.io specification). */
export const SkillFrontmatterSchema = z
  .object({
    name: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/, "1–64 chars: lowercase letters, digits, dashes"),
    description: z.string().min(1).max(1024),
    license: z.string().optional(),
    compatibility: z.string().optional(),
    metadata: z.record(z.string(), z.string()).optional(),
    "allowed-tools": z.string().optional(),
  })
  .strict()
  .describe("Agent Skill frontmatter (SKILL.md)");
export type SkillFrontmatter = z.infer<typeof SkillFrontmatterSchema>;
