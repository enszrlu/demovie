// demovie website: shared behavior (header, theme, menu, copy buttons, reveal on scroll, docs search).
(() => {
  const root = document.documentElement.dataset.root ?? "";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // header gets a background once the page scrolls
  const header = document.querySelector("[data-header]");
  const onScroll = () => header?.classList.toggle("is-scrolled", window.scrollY > 8);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  // theme: system by default; the toggle stores an explicit choice
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)");
  const effectiveTheme = () => document.documentElement.dataset.theme ?? (systemDark.matches ? "dark" : "light");
  for (const button of document.querySelectorAll("[data-theme-toggle]")) {
    button.addEventListener("click", () => {
      const next = effectiveTheme() === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      try {
        localStorage.setItem("demovie-theme", next);
      } catch {}
    });
  }

  // mobile menu
  const menuButton = document.querySelector("[data-menu]");
  const mobileNav = document.getElementById("mobile-nav");
  const setMenu = (open) => {
    mobileNav?.classList.toggle("is-open", open);
    menuButton?.setAttribute("aria-expanded", String(open));
  };
  menuButton?.addEventListener("click", () => setMenu(!mobileNav?.classList.contains("is-open")));
  mobileNav?.addEventListener("click", (e) => {
    if (e.target instanceof HTMLAnchorElement) setMenu(false);
  });

  // copy buttons: the data-copy value, else the code block or command next to the button
  document.addEventListener("click", async (e) => {
    const button = e.target instanceof Element ? e.target.closest("[data-copy]") : null;
    if (!button) return;
    let text = button.getAttribute("data-copy");
    if (!text) {
      const code = button.closest(".code")?.querySelector("pre");
      const cmd = button.closest(".cmd")?.querySelector("span:not(.prompt)");
      text = (code ?? cmd)?.textContent ?? "";
    }
    try {
      await navigator.clipboard.writeText(text.trim());
      button.classList.add("is-copied");
      setTimeout(() => button.classList.remove("is-copied"), 1600);
    } catch {}
  });

  // reveal on scroll
  const reveals = document.querySelectorAll(".reveal");
  if (reduceMotion || !("IntersectionObserver" in window)) {
    for (const el of reveals) el.classList.add("is-in");
  } else {
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    for (const el of reveals) io.observe(el);
  }

  // ── search ────────────────────────────────────────────────────────────────────────────────────────────────────
  const dialog = document.querySelector("[data-search]");
  const input = document.querySelector("[data-search-input]");
  const results = document.querySelector("[data-search-results]");
  let index;
  let selected = 0;
  let items = [];

  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const tokenize = (s) =>
    s
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter(Boolean);

  async function loadIndex() {
    if (index) return index;
    const res = await fetch(`${root}search-index.json`);
    const raw = await res.json();
    index = raw.map((e) => ({ ...e, hay: `${e.heading} ${e.page}`.toLowerCase(), body: e.text.toLowerCase() }));
    return index;
  }

  function highlight(text, terms) {
    let html = esc(text);
    for (const t of terms) {
      if (t.length < 2) continue;
      html = html.replace(new RegExp(`(${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"), "<mark>$1</mark>");
    }
    return html;
  }

  function snippet(text, terms) {
    const lower = text.toLowerCase();
    const at = Math.max(0, Math.min(...terms.map((t) => lower.indexOf(t)).filter((i) => i >= 0), text.length));
    let start = Math.max(0, at - 40);
    const space = text.lastIndexOf(" ", start);
    if (start > 0 && space >= 0 && start - space < 24) start = space + 1;
    return (start > 0 ? "…" : "") + text.slice(start, start + 160);
  }

  function search(query) {
    const terms = tokenize(query);
    if (!terms.length) return [];
    const scored = [];
    for (const e of index) {
      let score = 0;
      for (const t of terms) {
        if (e.hay.includes(t)) score += e.heading.toLowerCase().startsWith(t) ? 12 : 8;
        else if (e.body.includes(t)) score += 2;
        else {
          score = 0;
          break;
        }
      }
      if (score) scored.push({ e, score: score + (e.url.includes("#") ? 0 : 1) });
    }
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
      .map((s) => s.e);
  }

  function render() {
    const query = input.value.trim();
    const terms = tokenize(query);
    items = query ? search(query) : index.filter((e) => !e.url.includes("#")).slice(0, 8);
    selected = 0;
    if (!items.length) {
      results.innerHTML = `<li class="search-empty">No results for “${esc(query)}”.</li>`;
      return;
    }
    results.innerHTML = items
      .map(
        (e, i) =>
          `<li><a href="${root}${e.url}" role="option" aria-selected="${i === 0}"><span class="r-title">${highlight(e.heading, terms)} <span class="r-page">· ${esc(e.page)}</span></span>${query ? `<span class="r-text">${highlight(snippet(e.text, terms), terms)}</span>` : ""}</a></li>`,
      )
      .join("");
  }

  function move(delta) {
    const links = results.querySelectorAll("a");
    if (!links.length) return;
    selected = (selected + delta + links.length) % links.length;
    links.forEach((a, i) => {
      a.setAttribute("aria-selected", String(i === selected));
    });
    links[selected].scrollIntoView({ block: "nearest" });
  }

  async function openSearch() {
    if (!dialog || dialog.open) return;
    setMenu(false);
    dialog.showModal();
    input.value = "";
    await loadIndex();
    render();
    input.focus();
  }

  for (const b of document.querySelectorAll("[data-search-open]")) b.addEventListener("click", openSearch);
  input?.addEventListener("input", render);
  input?.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      move(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      move(-1);
    } else if (e.key === "Enter") {
      const link = results.querySelectorAll("a")[selected];
      if (link) {
        e.preventDefault();
        window.location.href = link.href;
        dialog.close();
      }
    }
  });
  dialog?.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.close();
  });
  results?.addEventListener("click", (e) => {
    if (e.target instanceof Element && e.target.closest("a")) dialog.close();
  });
  document.addEventListener("keydown", (e) => {
    const typing = e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
    if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
      e.preventDefault();
      openSearch();
    }
  });
})();
