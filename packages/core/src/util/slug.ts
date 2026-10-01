/** Lowercase, ASCII, dash-separated slug. */
export function slugify(input: string, maxLength = 48): string {
  const slug = input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.slice(0, maxLength).replace(/-+$/g, "") || "item";
}

/** Capture folder slug for a URL path: "/" → "index", "/app/projects" → "app-projects". */
export function routeSlug(urlPath: string): string {
  const clean = urlPath.split(/[?#]/)[0]!.replace(/^\/+|\/+$/g, "");
  if (!clean) return "index";
  return clean
    .split("/")
    .map((seg) => seg.replace(/[^A-Za-z0-9_.-]+/g, "-").replace(/^-+|-+$/g, ""))
    .filter(Boolean)
    .join("-")
    .toLowerCase();
}

/** "harborly" → "Harborly", "my-app" → "My App". */
export function titleCase(input: string): string {
  return input
    .replace(/^@[^/]+\//, "")
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(" ");
}
