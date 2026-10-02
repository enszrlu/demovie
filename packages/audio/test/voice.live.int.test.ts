/**
 * Live, paid provider calls (SPEC §13.3). They run only when you export your own key; otherwise vitest reports them
 * as skipped with the reason in the test name. Each call synthesizes one short line (a fraction of a cent).
 */
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { elevenLabs, openAi } from "../src/index.ts";

const ELEVEN = process.env.ELEVENLABS_API_KEY;
const OPENAI = process.env.OPENAI_API_KEY;
const outDir = () => mkdtempSync(path.join(os.tmpdir(), "demovie-live-"));

describe("live TTS providers (paid; your own keys)", () => {
  it.skipIf(!ELEVEN)(
    "ElevenLabs live: one line with word timings — skipped unless ELEVENLABS_API_KEY is set",
    async () => {
      const [r] = await elevenLabs.synthesize([{ id: "live", text: "Plan every launch.", start: 0 }], {
        voice: process.env.ELEVENLABS_VOICE_ID ?? elevenLabs.defaultVoice,
        model: elevenLabs.defaultModel,
        apiKey: ELEVEN!,
        outDir: outDir(),
      });
      expect(r!.duration).toBeGreaterThan(0.3);
      expect(r!.words.map((w) => w.text)).toEqual(["Plan", "every", "launch."]);
    },
  );

  it.skipIf(!OPENAI)(
    "OpenAI live: one line with estimated word timings — skipped unless OPENAI_API_KEY is set",
    async () => {
      const [r] = await openAi.synthesize([{ id: "live", text: "Plan every launch.", start: 0 }], {
        voice: openAi.defaultVoice,
        model: openAi.defaultModel,
        apiKey: OPENAI!,
        outDir: outDir(),
      });
      expect(r!.duration).toBeGreaterThan(0.3);
      expect(r!.estimated).toBe(true);
      expect(r!.words).toHaveLength(3);
    },
  );
});
