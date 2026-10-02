# demovie SFX

Twelve sound effects synthesized by `scripts/generate-sfx.ts` with deterministic DSP (no recordings, no downloads).
They are dedicated to the public domain under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).
`provenance.json` lists each file with its generator and sha256.

Use them by name in `video.json`:

```json
"sfx": [{ "name": "whoosh-short", "at": 4.0, "gain": -10 }]
```

`npx demovie audio sfx --list` prints the set with durations.
