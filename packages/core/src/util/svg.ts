/** SVG attribute names that JSX spells in camelCase; browsers ignore the camelCase forms in an .svg file. */
const JSX_ATTRIBUTES: Record<string, string> = {
  className: "class",
  clipPath: "clip-path",
  clipRule: "clip-rule",
  colorInterpolationFilters: "color-interpolation-filters",
  dominantBaseline: "dominant-baseline",
  fillOpacity: "fill-opacity",
  fillRule: "fill-rule",
  floodColor: "flood-color",
  floodOpacity: "flood-opacity",
  fontFamily: "font-family",
  fontSize: "font-size",
  fontWeight: "font-weight",
  stopColor: "stop-color",
  stopOpacity: "stop-opacity",
  strokeDasharray: "stroke-dasharray",
  strokeDashoffset: "stroke-dashoffset",
  strokeLinecap: "stroke-linecap",
  strokeLinejoin: "stroke-linejoin",
  strokeMiterlimit: "stroke-miterlimit",
  strokeOpacity: "stroke-opacity",
  strokeWidth: "stroke-width",
  textAnchor: "text-anchor",
  xlinkHref: "href",
};

/**
 * Make an SVG logo scale like an image: add the namespace, a `viewBox` from `width`/`height` when it has none (without
 * one, CSS sizing leaves the drawing at its intrinsic size), and the SVG spelling of attributes copied from JSX.
 */
export function normalizeSvg(svg: string): string {
  let out = svg.replace(/\s([a-zA-Z]+)=/g, (m, name: string) =>
    JSX_ATTRIBUTES[name] ? ` ${JSX_ATTRIBUTES[name]}=` : m,
  );
  const open = out.match(/<svg\b[^>]*>/);
  if (!open) return out;
  let tag = open[0];
  if (!/\sxmlns=/.test(tag)) tag = tag.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  if (!/\sviewBox=/.test(tag)) {
    const width = tag.match(/\swidth="([\d.]+)(?:px)?"/)?.[1];
    const height = tag.match(/\sheight="([\d.]+)(?:px)?"/)?.[1];
    if (width && height) tag = tag.replace("<svg", `<svg viewBox="0 0 ${width} ${height}"`);
  }
  out = out.replace(open[0], tag);
  return out;
}
