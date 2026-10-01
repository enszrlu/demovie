import { z } from "zod";
import { HexColor } from "./common.ts";

const Color = HexColor.nullable();

export const ColorSetSchema = z.object({
  background: Color,
  foreground: Color,
  primary: Color,
  primaryForeground: Color,
  secondary: Color,
  accent: Color,
  muted: Color,
  mutedForeground: Color,
  border: Color,
  ring: Color,
  chart: z.array(HexColor).default([]),
});
export type ColorSet = z.infer<typeof ColorSetSchema>;

export const FontSpecSchema = z.object({
  family: z.string(),
  weights: z.array(z.number().int()).default([]),
  files: z.array(z.string()).default([]).describe("paths relative to .demovie/"),
});
export type FontSpec = z.infer<typeof FontSpecSchema>;

export const BrandSchema = z
  .object({
    name: z.string(),
    tagline: z.string().nullable().default(null),
    url: z.string().nullable().default(null),
    colors: z.object({
      light: ColorSetSchema,
      dark: ColorSetSchema.nullable().default(null),
    }),
    fonts: z.object({
      heading: FontSpecSchema.nullable().default(null),
      body: FontSpecSchema.nullable().default(null),
      mono: FontSpecSchema.nullable().default(null),
    }),
    radius: z
      .object({
        sm: z.string().nullable().default(null),
        md: z.string().nullable().default(null),
        lg: z.string().nullable().default(null),
      })
      .prefault({}),
    shadows: z.array(z.string()).default([]),
    logo: z
      .object({
        mark: z.string().nullable().default(null),
        wordmark: z.string().nullable().default(null),
        onDark: z.string().nullable().default(null),
      })
      .prefault({}),
    og: z
      .object({
        image: z.string().nullable().default(null),
        title: z.string().nullable().default(null),
        description: z.string().nullable().default(null),
      })
      .prefault({}),
    provenance: z.record(z.string(), z.string()).default({}),
    warnings: z.array(z.string()).default([]),
  })
  .describe("brand tokens (.demovie/brand/brand.json)");

export type Brand = z.infer<typeof BrandSchema>;
