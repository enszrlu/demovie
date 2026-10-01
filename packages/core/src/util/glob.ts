/** Route globs: `**` matches across `/`, `*` within one segment, `?` one character. */
export function globToRegExp(glob: string): RegExp {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i]!;
    if (ch === "*") {
      if (glob[i + 1] === "*") {
        // "/**" also matches the parent itself: "/app/**" matches "/app".
        if (re.endsWith("\\/") && (glob[i + 2] === undefined || glob[i + 2] === "/")) {
          re = `${re.slice(0, -2)}(?:\\/.*)?`;
          i += glob[i + 2] === "/" ? 2 : 1;
          continue;
        }
        re += ".*";
        i++;
      } else {
        re += "[^/]*";
      }
    } else if (ch === "?") {
      re += "[^/]";
    } else {
      re += ch.replace(/[.+^${}()|[\]\\/]/g, "\\$&");
    }
  }
  return new RegExp(`^${re}$`);
}

export function matchesGlob(value: string, glob: string): boolean {
  return globToRegExp(glob).test(value);
}

export function matchesAny(value: string, globs: readonly string[]): boolean {
  return globs.some((g) => matchesGlob(value, g));
}

/** URL patterns (`*google-analytics.com*`): `*` matches anything, including `/`. */
export function urlPatternToRegExp(pattern: string): RegExp {
  return new RegExp(`^${pattern.replace(/[.+^${}()|[\]\\/?]/g, "\\$&").replace(/\*/g, ".*")}$`, "i");
}

/** Email-style globs for redaction allow lists (`*@harborly.demo`). Case-insensitive. */
export function simpleGlobToRegExp(pattern: string): RegExp {
  return new RegExp(`^${pattern.replace(/[.+^${}()|[\]\\/?]/g, "\\$&").replace(/\*/g, ".*")}$`, "i");
}
