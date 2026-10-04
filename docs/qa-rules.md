<!-- Generated from packages/qa/src/rules.ts by scripts/build-docs.ts. Do not edit; run `pnpm docs:build`. -->
# QA rules

`npx demovie qa <slug> [--format f|all] [--strict]` loads the composition exactly as the renderer does, samples it
at 10 fps (calling `seek()` and `inspect()`, and taking screenshots where a rule needs pixels), runs every rule,
writes `qa.json` next to `video.json` and exits 1 on any error. Rules listed in `video.json` `qa.ignore` are
reported as waived; `--strict` turns warnings into errors. `npx demovie preview <slug>` draws the failures over the
frames.

| ID | Severity | Rule | Measurement | Fix |
|---|---|---|---|---|
| DM-T01 | error | Text stays on screen long enough to read | Each distinct non-UI text block is continuously visible for ≥ 0.5 + words/3 s and ≥ 1.2 s | hold the text longer (or cut words): give it at least 0.5 s + 1/3 s per word, and never less than 1.2 s |
| DM-T02 | error | Minimum text size | Font size ≥ 3.0% of the frame's short side (captions ≥ 3.8%), at scale 1 | set the font size to at least 3% of the frame's short side (calc(var(--dm-unit) * 3)); captions need 3.8% |
| DM-T03 | error | No text overflow or clipping | scrollWidth > clientWidth, or the text box extends beyond its container or the stage | shorten the copy, let it wrap (max-width in ch), or enlarge the container so no glyph is cut |
| DM-T04 | error | Contrast | WCAG ratio of text color vs. a sampled background ring: < 4.5 warns, < 3.0 errors | darken/lighten the text or its background (brand fg on bg), or put the text on a solid panel |
| DM-T05 | warn | Too much text at once | More than 2 non-UI text blocks, or more than 18 words, visible at once | show one idea at a time: at most 2 text blocks and 18 words on screen together |
| DM-L01 | error | Safe area | Non-UI text, logos and the CTA stay inside the format's safe area | move it inside the safe area: position with var(--dm-safe-top/right/bottom/left), check with `preview` safe guides |
| DM-L02 | error | Overlaps | Two visible non-UI text boxes intersect by more than 5% of the smaller one, or text covers a highlighted product element | give each text block its own space, and keep text off the element you highlight |
| DM-L03 | warn | Off-stage leftovers | Visible elements sit fully outside the stage for more than 1 s | hide or remove elements once they leave the stage (set opacity 0 or end their shot) |
| DM-P01 | error | Shot pacing | Warn when the average shot length is below the type floor; error when more than 4 consecutive shots are under 0.8 s | merge or lengthen shots: keep the average above the type's floor and never cut more than 4 times in a row under 0.8 s |
| DM-P02 | error | Duration | Within the type's range, and equal to video.json.duration ± 1 frame | set video.json duration inside the type's range, and end the last shot exactly at the duration |
| DM-P03 | warn | End hold | The final logo/CTA shot is visible for ≥ 1.5 s | end on a logo + CTA shot held for at least 1.5 s |
| DM-P04 | error | Shots declared | At least 1 shot, and the shots cover the full duration with no gap over 0.5 s | declare shots with v.shot(id, start, end) covering the whole video |
| DM-P05 | error | Seamless loop (hero-loop only) | First vs. last frame pixel diff < 2% | make the end state equal the start state (camera reset, same text and positions) so the loop is invisible |
| DM-G01 | error | Truthful cursor | Every cursor click lands inside its target element's rect under the current screen transform | move the cursor to the element (cursor.moveTo(screen, id)) so it arrives before the click, and click while the element is on screen |
| DM-G02 | warn | Invented vocabulary | Capitalized terms in non-UI text that aren't in the glossary, the brief or captured UI text | use the product's own words (.demovie/glossary.md), or add the term to the brief/glossary if it is real |
| DM-G03 | error | Product shots use captures | Every kind: "product" shot contains at least one screen() | show product UI only with screen(v, { capture: "<id>", parent: shot.el }) — never draw or mock it |
| DM-G04 | warn | Invented numbers | Numbers in non-UI text that aren't in the brief, the glossary or captured UI text | only show numbers from the brief, seed data or captures; put the source in the brief if it is real |
| DM-G05 | error | Upscaled captures | A screen displayed above 1.0× its native pixel density warns; above 1.5× errors (blurry) | zoom less, show the screen smaller, or capture at a higher deviceScaleFactor |
| DM-A01 | error | Fonts | Declared brand and fallback fonts are loaded; no silent fallback to system fonts | check brand.json font files exist under .demovie/brand/fonts and use var(--dm-font-heading/body/mono) |
| DM-A02 | error | Assets | Any 4xx/5xx response, or a broken image or video | fix the path (composition-relative, /brand/*, /captures/*, /assets/*, /audio/*) or remove the reference |
| DM-A03 | error | Network | Any blocked external request | serve everything locally: copy the file into the composition folder or `npx demovie add` it |
| DM-A04 | error | Audio provenance | An audio file that has no provenance.json entry from a demovie generator, a configured provider, or add --licensed | generate audio with `npx demovie audio music\|voice\|mix`, or import it with `npx demovie add <file> --licensed` |
| DM-R01 | error | Determinism | 5 sampled frames, rendered at full size on two fresh pages in different seek orders (the second time right after the frame before each), look the same: at most 0.01% of pixels differ visibly (pixelmatch threshold 0.1) | derive everything from t: no Date/timers/real randomness, put tweens in v.timeline, make onSeek pure, and avoid will-change on animated elements |
| DM-R02 | warn | Blank frames | Frames that are over 98% one color for more than 0.3 s, outside declared transitions | start content earlier, overlap shots with a transition, or add a background element |
| DM-R03 | error | Stray GSAP tweens | Tweens outside v.timeline | add every tween to v.timeline (v.timeline.to/from/fromTo(..., at)), never gsap.to() directly |
| DM-R04 | warn | Unregistered CSS animations | Running CSS animations not registered via v.css | drive CSS keyframes with v.css(el, keyframes, { start, duration }) so they follow the timeline |
| DM-R05 | error | Timers after ready | setTimeout/setInterval called after ready() | don't use timers for animation: schedule on v.timeline or compute state in v.onSeek(t) |
| DM-S01 | error | Loudness | Integrated loudness outside target ± 2 LU warns; true peak above −1.0 dBTP errors | re-run `npx demovie audio mix <slug>` (two-pass loudnorm), or lower the music/SFX gains |
| DM-S02 | warn | VO overlap | Voice lines overlap each other or run past the end of the video | move VO lines apart in voice.json/storyboard (start times) or shorten them |
| DM-V01 | warn | "AI look" clichés | Non-UI text that matches HUD, timecode, BPM or "frame N" patterns; generic status chips ("Done", "Saved", "Success") not in the glossary; more than 2 typefaces | drop decorative HUD/timecode labels and generic chips; stay with the brand's one or two typefaces |
