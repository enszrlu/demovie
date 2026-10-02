/**
 * Generates packages/skill/demovie/references/runtime-api.md from the runtime's exported symbols and types (SPEC
 * §14.1) with the TypeScript compiler API, plus a hand-written example per symbol. `pnpm skill:build` writes it and
 * `pnpm verify` (skill lint) checks it is current.
 */
import path from "node:path";
import ts from "typescript";
import { repoRoot } from "./repo.ts";

const ENTRY = path.join(repoRoot, "packages/runtime/src/index.ts");

/** Usage examples per exported symbol (kept short; real compositions live in examples/compositions). */
const EXAMPLES: Record<string, string> = {
  createVideo: `const v = await createVideo(); // reads video.json, brand, glossary, beats; sizes the stage
const intro = v.shot("intro", 0, 3.4, { kind: "title" });
// … build the timeline …
v.ready(); // always last`,
  screen: `const app = screen(v, { capture: "routes/app-projects@desktop", parent: shot.el, device: "browser" });
app.focus("link:q3-launch", { at: 4.8, duration: 1.2, scale: 1.4 }); // ids come from elements.json
app.highlight("link:q3-launch", { at: 6.6, duration: 1.6, style: "ring" });
app.swap("flows/create-project@desktop/created", { at: 13.2, transition: "crossfade" });`,
  cursor: `const pointer = cursor(v, { style: "mac" });
pointer.moveTo(app, "button:new-project", { at: 8.9, duration: 0.85 });
pointer.click({ at: 9.85 }); // QA DM-G01 checks the click lands inside the element`,
  typeText: `typeText(app, "textbox:project-name", "Q4 Launch", { at: 11.45, cps: 14 });`,
  text: `text.reveal(h1, { at: 0.3, by: "word", stagger: 0.06, duration: 0.8, ease: "expo.out" });
text.counter(el, { at: 2, from: 0, to: 9, duration: 1.2 }); // numbers must exist in brief/seed/captures`,
  callout: `callout(app, "generic:project-checklist", { label: "Checklist", at: 15.5, duration: 2 });`,
  captions: `captions(v, { style: "karaoke" }); // burns in for formats in video.json captions.burnIn`,
  transition: `transition.crossfade(intro, product, { at: 3.1, duration: 0.5 });
transition.push(product, dashboard, { at: 20.1, duration: 0.6, direction: "left" });`,
  logo: `logo(v, { at: 30.55, variant: "wordmark", parent: card.querySelector(".end-logo") });`,
  inspect: `// QA calls this; agents rarely need it directly
const state = window.__DEMOVIE__.inspect(); // texts, shots, screens, cursor, clicks, fonts…`,
  FORMATS: `const { width, height, safe } = FORMATS["9:16"]; // 1080×1920, safe-area insets in %`,
  RUNTIME_VERSION: `console.info(\`demovie runtime \${RUNTIME_VERSION}\`);`,
  registerVideoElement: `// for <video> assets imported with \`demovie add\`: keep playback a pure function of t
registerVideoElement(videoEl, 4); // the clip's t = 0 is the video's 4 s`,
};

function docOf(checker: ts.TypeChecker, symbol: ts.Symbol): string {
  return ts.displayPartsToString(symbol.getDocumentationComment(checker)).trim();
}

function declarationText(decl: ts.Declaration): string {
  const printer = ts.createPrinter({ removeComments: true });
  if (ts.isFunctionDeclaration(decl)) {
    const signature = ts.factory.updateFunctionDeclaration(
      decl,
      decl.modifiers?.filter((m) => m.kind === ts.SyntaxKind.ExportKeyword),
      decl.asteriskToken,
      decl.name,
      decl.typeParameters,
      decl.parameters,
      decl.type,
      undefined,
    );
    return printer.printNode(ts.EmitHint.Unspecified, signature, decl.getSourceFile()).replace(/;?\s*$/, ";");
  }
  return decl.getText().replace(/^export\s+/, "");
}

export interface RuntimeApiEntry {
  name: string;
  kind: "function" | "const" | "type";
  doc: string;
  code: string;
}

/** Every symbol exported by packages/runtime/src/index.ts, in export order. */
export function runtimeApiEntries(): RuntimeApiEntry[] {
  const program = ts.createProgram([ENTRY], {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    allowImportingTsExtensions: true,
    noEmit: true,
    strict: true,
    skipLibCheck: true,
  });
  const checker = program.getTypeChecker();
  const source = program.getSourceFile(ENTRY)!;
  const module = checker.getSymbolAtLocation(source)!;
  const out: RuntimeApiEntry[] = [];
  for (const exported of checker.getExportsOfModule(module)) {
    const symbol = exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported;
    const decl = symbol.declarations?.[0];
    if (!decl) continue;
    const name = exported.getName();
    if (ts.isFunctionDeclaration(decl)) {
      out.push({ name, kind: "function", doc: docOf(checker, symbol), code: declarationText(decl) });
    } else if (ts.isVariableDeclaration(decl)) {
      const type = checker.getTypeOfSymbolAtLocation(symbol, decl);
      const props = checker.getPropertiesOfType(type);
      const methods = props.map((p) => ({ p, sig: checker.getTypeOfSymbolAtLocation(p, decl).getCallSignatures()[0] }));
      const clean = (t: string) => t.replace(/ \| undefined/g, "");
      const code =
        props.length && methods.every((m) => m.sig)
          ? `const ${name}: {\n${methods
              .map(({ p, sig }) => {
                const doc = docOf(checker, p);
                const line = `  ${p.getName()}${clean(checker.signatureToString(sig!, undefined, ts.TypeFormatFlags.NoTruncation))};`;
                return doc ? `  /** ${doc} */\n${line}` : line;
              })
              .join("\n")}\n};`
          : `const ${name}: ${clean(checker.typeToString(type, undefined, ts.TypeFormatFlags.NoTruncation))};`;
      out.push({ name, kind: "const", doc: docOf(checker, symbol), code });
    } else {
      out.push({ name, kind: "type", doc: docOf(checker, symbol), code: declarationText(decl) });
    }
  }
  return out;
}

export function renderRuntimeApi(entries = runtimeApiEntries()): string {
  const values = entries.filter((e) => e.kind !== "type");
  const types = entries.filter((e) => e.kind === "type");
  const section = (e: RuntimeApiEntry) =>
    [
      `### \`${e.name}\``,
      "",
      ...(e.doc ? [e.doc, ""] : []),
      "```ts",
      e.code,
      "```",
      ...(EXAMPLES[e.name] ? ["", "Example:", "", "```js", EXAMPLES[e.name], "```"] : []),
      "",
    ].join("\n");
  return [
    "<!-- Generated by scripts/lib/runtime-api.ts from packages/runtime/src/index.ts. Do not edit; run `pnpm skill:build`. -->",
    "# Runtime API",
    "",
    'Compositions import the runtime as an ES module served by demovie: `import { createVideo, screen, … } from "/__demovie/runtime.js"`.',
    "`index.html` must load `/__demovie/clock.js` first (the virtual clock) and `/__demovie/runtime.css`.",
    "Everything visible must be a pure function of time: build tweens on `v.timeline` (or with these helpers) and call `v.ready()` last.",
    "",
    "## Functions and values",
    "",
    ...values.map(section),
    "## Types",
    "",
    ...types.map(section),
  ].join("\n");
}
