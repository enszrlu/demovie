/**
 * Static analysis of JS/TS source without executing it (SPEC §8.1, §8.3: "never execute the config").
 * esbuild strips types/JSX, acorn produces an ESTree AST, and `literalValue` evaluates literal subtrees only.
 */
import path from "node:path";
import { type Node, parse } from "acorn";
import { transformSync } from "esbuild";

export type AnyNode = Node & Record<string, any>;

const LOADERS: Record<string, "ts" | "tsx" | "js" | "jsx"> = {
  ".ts": "ts",
  ".mts": "ts",
  ".cts": "ts",
  ".tsx": "tsx",
  ".js": "js",
  ".mjs": "js",
  ".cjs": "js",
  ".jsx": "jsx",
};

/** Parse a module into an ESTree AST. Returns null when the file cannot be parsed. */
export function parseModule(code: string, filename: string): AnyNode | null {
  const loader = LOADERS[path.extname(filename)] ?? "tsx";
  try {
    // JSX is compiled to plain calls so acorn can read it; nothing is ever executed.
    const js = transformSync(code, {
      loader,
      jsx: "transform",
      target: "esnext",
      sourcefile: filename,
      // Keep value imports even when unused, so static analysis sees every import as written.
      tsconfigRaw: { compilerOptions: { verbatimModuleSyntax: true } },
    }).code;
    return parse(js, {
      ecmaVersion: "latest",
      sourceType: "module",
      allowHashBang: true,
      allowAwaitOutsideFunction: true,
      allowReturnOutsideFunction: true,
      allowImportExportEverywhere: true,
    }) as unknown as AnyNode;
  } catch {
    return null;
  }
}

/** Depth-first walk over every node. */
export function walk(node: AnyNode | null | undefined, visit: (node: AnyNode, parent: AnyNode | null) => void): void {
  const stack: [AnyNode, AnyNode | null][] = node ? [[node, null]] : [];
  while (stack.length > 0) {
    const [current, parent] = stack.pop()!;
    visit(current, parent);
    for (const key of Object.keys(current)) {
      if (key === "loc" || key === "range") continue;
      const value = (current as Record<string, unknown>)[key];
      if (Array.isArray(value)) {
        for (let i = value.length - 1; i >= 0; i--) {
          const child = value[i];
          if (child && typeof child === "object" && typeof (child as AnyNode).type === "string")
            stack.push([child as AnyNode, current]);
        }
      } else if (value && typeof value === "object" && typeof (value as AnyNode).type === "string") {
        stack.push([value as AnyNode, current]);
      }
    }
  }
}

export const UNKNOWN = Symbol("unknown");

/**
 * Evaluate a literal subtree (objects, arrays, strings, numbers, booleans, null, simple templates).
 * Anything else becomes `UNKNOWN` so callers can skip it.
 */
export function literalValue(node: AnyNode | null | undefined, scope?: Map<string, AnyNode>): unknown {
  if (!node) return UNKNOWN;
  switch (node.type) {
    case "Literal":
      return node.value;
    case "TemplateLiteral":
      if (node.expressions.length === 0) return node.quasis.map((q: AnyNode) => q.value.cooked).join("");
      return UNKNOWN;
    case "ArrayExpression":
      return node.elements.map((el: AnyNode | null) => (el ? literalValue(el, scope) : null));
    case "ObjectExpression": {
      const out: Record<string, unknown> = {};
      for (const prop of node.properties as AnyNode[]) {
        if (prop.type !== "Property" || prop.computed) continue;
        const key = prop.key.type === "Identifier" ? prop.key.name : String(prop.key.value);
        out[key] = literalValue(prop.value, scope);
      }
      return out;
    }
    case "UnaryExpression":
      if (node.operator === "-" && node.argument.type === "Literal") return -node.argument.value;
      return UNKNOWN;
    case "Identifier":
      if (node.name === "undefined") return undefined;
      if (scope?.has(node.name)) return literalValue(scope.get(node.name)!, undefined);
      return UNKNOWN;
    case "TSAsExpression":
    case "TSSatisfiesExpression":
    case "ParenthesizedExpression":
      return literalValue(node.expression, scope);
    case "CallExpression":
      // `defineConfig({...})`, `satisfies` helpers, etc.: look through single-argument wrappers.
      if (node.arguments.length === 1) return literalValue(node.arguments[0], scope);
      return UNKNOWN;
    case "NewExpression":
      // `new URL("https://…")`
      if (node.callee.type === "Identifier" && node.callee.name === "URL" && node.arguments[0]?.type === "Literal") {
        return String(node.arguments[0].value);
      }
      return UNKNOWN;
    default:
      return UNKNOWN;
  }
}

/** Top-level `const x = …` declarations by name. */
export function topLevelConsts(ast: AnyNode): Map<string, AnyNode> {
  const map = new Map<string, AnyNode>();
  for (const stmt of ast.body as AnyNode[]) {
    const decl = stmt.type === "ExportNamedDeclaration" ? stmt.declaration : stmt;
    if (decl?.type === "VariableDeclaration") {
      for (const d of decl.declarations as AnyNode[]) {
        if (d.id.type === "Identifier" && d.init) map.set(d.id.name, d.init);
      }
    }
  }
  return map;
}

/** The initializer of `export const <name> = …`. */
export function exportedConst(ast: AnyNode, name: string): AnyNode | null {
  for (const stmt of ast.body as AnyNode[]) {
    if (stmt.type !== "ExportNamedDeclaration" || stmt.declaration?.type !== "VariableDeclaration") continue;
    for (const d of stmt.declaration.declarations as AnyNode[]) {
      if (d.id.type === "Identifier" && d.id.name === name) return d.init ?? null;
    }
  }
  return null;
}

/** The value a config module exports: `export default {…}`, `module.exports = {…}`, or a named const. */
export function defaultExportValue(ast: AnyNode): unknown {
  const scope = topLevelConsts(ast);
  for (const stmt of ast.body as AnyNode[]) {
    if (stmt.type === "ExportDefaultDeclaration") return literalValue(stmt.declaration, scope);
    if (
      stmt.type === "ExpressionStatement" &&
      stmt.expression.type === "AssignmentExpression" &&
      stmt.expression.left.type === "MemberExpression" &&
      stmt.expression.left.object?.name === "module" &&
      stmt.expression.left.property?.name === "exports"
    ) {
      return literalValue(stmt.expression.right, scope);
    }
  }
  return UNKNOWN;
}

export interface ImportInfo {
  source: string;
  specifiers: { imported: string; local: string }[];
  /** `import "./x.css"` */
  sideEffect: boolean;
  dynamic?: boolean;
}

/** Static imports, re-exports and literal dynamic imports/requires. */
export function moduleImports(ast: AnyNode): ImportInfo[] {
  const out: ImportInfo[] = [];
  walk(ast, (node) => {
    if (node.type === "ImportDeclaration") {
      out.push({
        source: String(node.source.value),
        sideEffect: node.specifiers.length === 0,
        specifiers: (node.specifiers as AnyNode[]).map((s) => ({
          imported:
            s.type === "ImportDefaultSpecifier"
              ? "default"
              : s.type === "ImportNamespaceSpecifier"
                ? "*"
                : s.imported.type === "Identifier"
                  ? s.imported.name
                  : String(s.imported.value),
          local: s.local.name,
        })),
      });
    } else if ((node.type === "ExportNamedDeclaration" || node.type === "ExportAllDeclaration") && node.source) {
      out.push({ source: String(node.source.value), specifiers: [], sideEffect: false });
    } else if (node.type === "ImportExpression" && node.source.type === "Literal") {
      out.push({ source: String(node.source.value), specifiers: [], sideEffect: false, dynamic: true });
    } else if (
      node.type === "CallExpression" &&
      node.callee.type === "Identifier" &&
      node.callee.name === "require" &&
      node.arguments[0]?.type === "Literal"
    ) {
      out.push({ source: String(node.arguments[0].value), specifiers: [], sideEffect: false, dynamic: true });
    }
  });
  return out;
}

/** Calls to a function bound to `localName` (e.g. `Inter({...})`, `localFont({...})`). */
export function callsTo(ast: AnyNode, localName: string): AnyNode[] {
  const calls: AnyNode[] = [];
  walk(ast, (node) => {
    if (node.type === "CallExpression" && node.callee.type === "Identifier" && node.callee.name === localName)
      calls.push(node);
  });
  return calls;
}

/** All string literals in the module (used for seed files). */
export function stringLiterals(ast: AnyNode): string[] {
  const out: string[] = [];
  walk(ast, (node) => {
    if (node.type === "Literal" && typeof node.value === "string") out.push(node.value);
  });
  return out;
}
