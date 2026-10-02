/**
 * Element map collection (SPEC §9.6). Plain-JS page script (DECISIONS D28).
 * Ids: `dm:<data-demovie>`; else `<role>:<slug(accessible name)>`; nameless elements fall back to their test id
 * (`<role>:<data-testid>`) or the bare role. Duplicates get `#2`, `#3`… in document order.
 */
export const ELEMENT_MAP_SCRIPT = String.raw`() => {
  const clean = (t) => (t || "").replace(/\s+/g, " ").trim();
  const slug = (t) => (t || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48).replace(/-+$/g, "");
  const NAME_FROM_CONTENT = new Set(["button","link","heading","tab","menuitem","menuitemcheckbox","menuitemradio","option","checkbox","radio","switch","cell","gridcell","columnheader","rowheader","row","treeitem","tooltip","listitem"]);
  const INTERACTIVE_ROLES = new Set(["button","link","tab","menuitem","checkbox","switch","option","textbox","searchbox","combobox","listbox","slider","spinbutton","radio","menuitemcheckbox","menuitemradio"]);
  const LANDMARKS = "nav, main, aside, header, footer, dialog, [role=navigation], [role=main], [role=complementary], [role=banner], [role=contentinfo], [role=dialog], [role=alertdialog]";
  const INPUT_ROLES = { checkbox: "checkbox", radio: "radio", range: "slider", button: "button", submit: "button", reset: "button", image: "button", search: "searchbox", number: "spinbutton" };
  const roleOf = (el) => {
    const explicit = el.getAttribute("role");
    if (explicit) return explicit.trim().split(/\s+/)[0];
    const tag = el.tagName.toLowerCase();
    if (tag === "a") return el.hasAttribute("href") ? "link" : "generic";
    if (tag === "button" || tag === "summary") return "button";
    if (tag === "input") return INPUT_ROLES[(el.type || "text").toLowerCase()] || "textbox";
    if (tag === "textarea") return "textbox";
    if (tag === "select") return el.multiple ? "listbox" : "combobox";
    if (/^h[1-6]$/.test(tag)) return "heading";
    if (tag === "nav") return "navigation";
    if (tag === "main") return "main";
    if (tag === "aside") return "complementary";
    if (tag === "header") return "banner";
    if (tag === "footer") return "contentinfo";
    if (tag === "dialog") return "dialog";
    if (tag === "img" || tag === "svg") return "img";
    if (tag === "tr") return "row";
    if (tag === "table") return "table";
    if (tag === "form") return "form";
    if (tag === "option") return "option";
    if (tag === "li") return "listitem";
    if (el.isContentEditable) return "textbox";
    return "generic";
  };
  const labelledBy = (el) => {
    const ids = el.getAttribute("aria-labelledby");
    if (!ids) return "";
    return clean(ids.split(/\s+/).map((id) => { const n = document.getElementById(id); return n ? n.innerText || n.textContent : ""; }).join(" "));
  };
  const nameOf = (el, role) => {
    const aria = clean(el.getAttribute("aria-label"));
    if (aria) return aria;
    const lb = labelledBy(el);
    if (lb) return lb;
    const tag = el.tagName.toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") {
      if (el.id) { const l = document.querySelector('label[for="' + CSS.escape(el.id) + '"]'); if (l) return clean(l.innerText || l.textContent); }
      const wrap = el.closest("label");
      if (wrap) return clean(wrap.innerText || wrap.textContent);
      if (["submit","button","reset"].includes((el.type || "").toLowerCase())) return clean(el.value);
      return clean(el.getAttribute("placeholder") || el.getAttribute("title") || "");
    }
    if (tag === "img") return clean(el.getAttribute("alt") || el.getAttribute("title"));
    if (tag === "svg") { const t = el.querySelector("title"); return clean(t ? t.textContent : ""); }
    if (NAME_FROM_CONTENT.has(role)) {
      const text = clean(el.innerText || el.textContent);
      if (text) return text.slice(0, 120);
      const img = el.querySelector("img[alt], svg[aria-label], [aria-label]");
      if (img) return clean(img.getAttribute("alt") || img.getAttribute("aria-label"));
    }
    return clean(el.getAttribute("title"));
  };
  const toHex = (c) => {
    const m = (c || "").match(/rgba?\(([^)]+)\)/);
    if (!m) {
      // Chromium keeps oklch()/lab() in computed styles; resolve through a canvas.
      if (!c || c === "transparent") return null;
      const ctx = toHex.ctx || (toHex.ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true }));
      ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = "#000"; ctx.fillStyle = c; ctx.fillRect(0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      if (d[3] === 0) return null;
      return "#" + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, "0")).join("") + (d[3] < 255 ? d[3].toString(16).padStart(2, "0") : "");
    }
    const parts = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    const a = parts.length > 3 ? parts[3] : 1;
    if (a === 0) return null;
    return "#" + parts.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, "0")).join("") + (a < 1 ? Math.round(a * 255).toString(16).padStart(2, "0") : "");
  };
  const family = (stack) => {
    const first = (stack || "").split(",")[0].trim().replace(/^["']|["']$/g, "");
    const f = first.replace(/^__/, "").replace(/_[0-9a-f]{6}$/i, "").replace(/[ _]Fallback$/i, "");
    if (f === "GeistSans") return "Geist";
    if (f === "GeistMono") return "Geist Mono";
    return f.replace(/_/g, " ");
  };
  const selectorOf = (el) => {
    const dm = el.getAttribute("data-demovie");
    if (dm) return '[data-demovie="' + dm + '"]';
    const tid = el.getAttribute("data-testid");
    if (tid && document.querySelectorAll('[data-testid="' + CSS.escape(tid) + '"]').length === 1) return '[data-testid="' + tid + '"]';
    if (el.id && !/\d{3,}|:r\w*:|radix|headlessui|react-aria/i.test(el.id) && document.querySelectorAll("#" + CSS.escape(el.id)).length === 1) return "#" + CSS.escape(el.id);
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && node !== document.documentElement) {
      const anchorTid = node !== el && node.getAttribute("data-testid");
      const anchorDm = node !== el && node.getAttribute("data-demovie");
      if (anchorDm) { parts.unshift('[data-demovie="' + anchorDm + '"]'); break; }
      if (anchorTid && document.querySelectorAll('[data-testid="' + CSS.escape(anchorTid) + '"]').length === 1) { parts.unshift('[data-testid="' + anchorTid + '"]'); break; }
      const tag = node.tagName.toLowerCase();
      let index = 1;
      let sib = node.previousElementSibling;
      while (sib) { if (sib.tagName === node.tagName) index++; sib = sib.previousElementSibling; }
      parts.unshift(tag + ":nth-of-type(" + index + ")");
      node = node.parentElement;
      if (node === document.body) { parts.unshift("body"); break; }
    }
    return parts.join(" > ");
  };
  const CANDIDATES = [
    "a[href]", "button", "input:not([type=hidden])", "select", "textarea", "summary",
    "[role=button]", "[role=link]", "[role=tab]", "[role=menuitem]", "[role=checkbox]", "[role=switch]", "[role=option]",
    "[contenteditable='']", "[contenteditable=true]", "[tabindex]:not([tabindex^='-'])",
    "h1", "h2", "h3", "h4", "h5", "h6", "[role=heading]",
    LANDMARKS,
    "img[alt]:not([alt=''])", "svg[aria-label]", "[role=img][aria-label]",
    "table tr", "[role=row]",
    "[data-testid]", "[data-demovie]",
  ].join(", ");
  const sx = window.scrollX, sy = window.scrollY, vw = window.innerWidth, vh = window.innerHeight;
  const counts = new Map();
  const elements = [];
  let rows = 0;
  for (const el of document.querySelectorAll(CANDIDATES)) {
    const tag = el.tagName.toLowerCase();
    const isRow = tag === "tr" || el.getAttribute("role") === "row";
    if (isRow) { if (rows >= 50) continue; rows++; }
    const style = getComputedStyle(el);
    if (style.display === "none") continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    if (el.closest("[aria-hidden=true]") && !el.hasAttribute("data-demovie") && !el.hasAttribute("data-testid")) continue;
    const role = roleOf(el);
    const name = nameOf(el, role);
    const dm = el.getAttribute("data-demovie");
    const testId = el.getAttribute("data-testid");
    let base;
    if (dm) base = "dm:" + dm;
    else if (slug(name)) base = role + ":" + slug(name);
    else if (testId) base = role + ":" + slug(testId);
    else base = role;
    const n = (counts.get(base) || 0) + 1;
    counts.set(base, n);
    const id = n === 1 ? base : base + "#" + n;
    const visible = style.visibility !== "hidden" && Number(style.opacity) > 0.01;
    const bbox = { x: Math.round((r.left + sx) * 10) / 10, y: Math.round((r.top + sy) * 10) / 10, width: Math.round(r.width * 10) / 10, height: Math.round(r.height * 10) / 10 };
    const fontSize = parseFloat(style.fontSize);
    const lh = parseFloat(style.lineHeight);
    const landmark = el.parentElement ? el.parentElement.closest(LANDMARKS) : null;
    const entry = {
      id, role, name, tag,
      selector: selectorOf(el),
      bbox,
      visible,
      interactive: INTERACTIVE_ROLES.has(role) || el.tabIndex >= 0 && role !== "generic" && role !== "heading",
      inViewport: r.bottom > 0 && r.right > 0 && r.top < vh && r.left < vw,
      style: {
        fontFamily: family(style.fontFamily),
        fontSize,
        fontWeight: Number(style.fontWeight) || 400,
        color: toHex(style.color) || "#000000",
        background: toHex(style.backgroundColor),
        radius: parseFloat(style.borderTopLeftRadius) || 0,
        lineHeight: Number.isFinite(lh) ? lh : Math.round(fontSize * 1.2 * 10) / 10,
        paddingLeft: parseFloat(style.paddingLeft) || 0,
        paddingTop: parseFloat(style.paddingTop) || 0,
      },
    };
    const text = clean(el.innerText || "");
    if (text && !["navigation","main","banner","contentinfo","complementary","dialog","generic","table","form"].includes(role)) entry.text = text.slice(0, 200);
    if (testId) entry.testId = testId;
    if (dm) entry.demovie = dm;
    if (role === "heading") entry.level = Number((el.getAttribute("aria-level") || tag.slice(1))) || 2;
    if (landmark) entry.landmark = landmark.tagName.toLowerCase() === "dialog" ? "dialog" : (landmark.getAttribute("role") || landmark.tagName.toLowerCase());
    if (tag === "a" && el.getAttribute("href")) entry.href = el.getAttribute("href");
    if ((tag === "input" || tag === "textarea" || tag === "select") && el.type !== "password") entry.value = String(el.value || "");
    if (el.getAttribute("placeholder")) entry.placeholder = el.getAttribute("placeholder");
    elements.push(entry);
  }
  return {
    viewport: { width: vw, height: vh, deviceScaleFactor: window.devicePixelRatio },
    document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
    elements,
  };
}`;

/** Bounding boxes of the main content, compared across two animation frames to detect layout stability. */
export const STABILITY_SCRIPT = `() => new Promise((resolve) => {
  const snap = () => {
    const root = document.querySelector("main") || document.body;
    return [...root.querySelectorAll("*")].slice(0, 600).map((e) => { const r = e.getBoundingClientRect(); return Math.round(r.x) + "," + Math.round(r.y) + "," + Math.round(r.width) + "," + Math.round(r.height); }).join(";");
  };
  const a = snap();
  requestAnimationFrame(() => requestAnimationFrame(() => resolve(a === snap())));
})`;

/** Resolve after fonts are ready and every image has decoded. */
/**
 * Fonts ready and the images on screen decoded, within 10 s. Only images in the viewport: a lazy image below the fold
 * never loads, and its decode() would never settle.
 */
export const DECODE_SCRIPT = `async () => {
  const onScreen = (img) => {
    const r = img.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
  };
  const work = (async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].filter(onScreen).map((img) => (img.complete && img.naturalWidth > 0 ? Promise.resolve() : img.decode().catch(() => {}))));
    return true;
  })();
  return Promise.race([work, new Promise((resolve) => setTimeout(() => resolve(false), 10000))]);
}`;
