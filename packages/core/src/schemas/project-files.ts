import { z } from "zod";
import { IsoDate } from "./common.ts";

export const GlossarySchema = z
  .object({
    productName: z.string(),
    tagline: z.string().nullable().default(null),
    features: z.array(z.object({ term: z.string(), source: z.string().nullable().default(null) })).default([]),
    uiLabels: z.array(z.string()).max(200).default([]).describe("exact casing"),
    entities: z.array(z.string()).default([]).describe("from demo data only"),
    people: z.array(z.string()).default([]).describe("from demo data only"),
    ctaUrl: z.string().nullable().default(null),
    avoid: z.array(z.string()).default([]).describe("words the product does NOT use (user-maintained)"),
  })
  .describe("glossary derived from glossary.md (.demovie/glossary.json)");
export type Glossary = z.infer<typeof GlossarySchema>;

export const RouteSchema = z.object({
  path: z.string(),
  file: z.string().nullable(),
  dynamic: z.boolean().default(false),
  params: z.array(z.string()).optional(),
  needsParams: z.boolean().optional(),
  protected: z.boolean().nullable().default(null),
  protectedReason: z.string().optional(),
  source: z.enum(["fs", "crawl", "config"]),
  router: z.enum(["app", "pages"]).optional(),
  slot: z.string().optional(),
  title: z.string().nullable().optional(),
});
export type Route = z.infer<typeof RouteSchema>;

export const RoutesSchema = z
  .object({
    generatedAt: IsoDate,
    routes: z.array(RouteSchema),
  })
  .describe("route map (.demovie/routes.json)");
export type Routes = z.infer<typeof RoutesSchema>;

export const AssetSchema = z.object({
  file: z.string().describe("path relative to .demovie/assets/"),
  description: z.string().nullable().default(null),
  kind: z.enum(["image", "video", "audio", "script", "font", "other"]),
  licensed: z.boolean().optional(),
  original: z.string().optional(),
  addedAt: IsoDate,
  width: z.number().optional(),
  height: z.number().optional(),
  duration: z.number().optional(),
});
export type Asset = z.infer<typeof AssetSchema>;

export const AssetsSchema = z
  .object({ assets: z.array(AssetSchema).default([]) })
  .describe("user resources (.demovie/assets.json)");
export type Assets = z.infer<typeof AssetsSchema>;
