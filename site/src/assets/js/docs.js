// demovie website: docs (sidebar toggle on small screens, "on this page" highlighting).
(() => {
  const side = document.querySelector("[data-docs-side]");
  const toggle = document.querySelector("[data-docs-toggle]");
  toggle?.addEventListener("click", () => {
    const open = !side.classList.contains("is-open");
    side.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
  });

  const links = [...document.querySelectorAll(".docs-toc a")];
  if (!links.length || !("IntersectionObserver" in window)) return;
  const targets = links.map((a) => document.getElementById(decodeURIComponent(a.hash.slice(1)))).filter(Boolean);
  const visible = new Set();
  const update = () => {
    const first = targets.find((t) => visible.has(t));
    if (!first) return;
    for (const a of links) a.classList.toggle("is-active", a.hash.slice(1) === first.id);
  };
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) visible.add(e.target);
        else visible.delete(e.target);
      }
      update();
    },
    { rootMargin: "-64px 0px -60% 0px" },
  );
  for (const t of targets) io.observe(t);
})();
