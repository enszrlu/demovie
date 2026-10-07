// demovie website: landing page and gallery interactions.
(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const readJson = (id) => {
    const el = document.getElementById(id);
    return el ? JSON.parse(el.textContent) : undefined;
  };
  const esc = (s) =>
    String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const onVisible = (el, cb, options = { threshold: 0.35 }) => {
    if (!("IntersectionObserver" in window)) {
      cb(true);
      return;
    }
    new IntersectionObserver((entries) => {
      for (const e of entries) cb(e.isIntersecting, e);
    }, options).observe(el);
  };
  const box = (b, vw, vh) =>
    `left:${(b.x / vw) * 100}%;top:${(b.y / vh) * 100}%;width:${(b.width / vw) * 100}%;height:${(b.height / vh) * 100}%`;

  // ── lazy, in-view autoplay for decorative videos ────────────────────────────────────────────────────────────────
  function loadVideo(video) {
    if (video.dataset.src && !video.getAttribute("src")) {
      video.src = video.dataset.src;
      video.load();
    }
  }
  const autoplayVideos = [
    ...$$("video[data-autoplay]"),
    ...$$("[data-autoplay-group] video"),
    ...$$(".showcase video"),
  ];
  for (const video of autoplayVideos) {
    if (reduceMotion) {
      video.controls = true;
      video.preload = "none";
      onVisible(video, (v) => v && loadVideo(video), { rootMargin: "200px" });
      continue;
    }
    // a pause the viewer made (a click or key on the video just before it) sticks; any other pause doesn't
    let gestureAt = 0;
    const gesture = () => {
      gestureAt = performance.now();
    };
    video.addEventListener("pointerdown", gesture);
    video.addEventListener("keydown", gesture);
    onVisible(video, (visible) => {
      if (visible) {
        loadVideo(video);
        if (!video.dataset.userPaused) video.play().catch(() => {});
      } else if (!video.paused) {
        video.pause();
      }
    });
    video.addEventListener("pause", () => {
      if (performance.now() - gestureAt < 1500) video.dataset.userPaused = "1";
    });
    video.addEventListener("play", () => {
      delete video.dataset.userPaused;
    });
  }

  // ── hero: the imagined-vs-real wipe player ───────────────────────────────────────────────────────────────────────
  function wipePlayer(el) {
    const video = $("[data-wipe-video]", el);
    const canvas = $("[data-wipe-canvas]", el);
    const stage = $("[data-wipe-stage]", el);
    const handle = $("[data-wipe-handle]", el);
    const left = $(".wipe-label.left", el);
    const right = $(".wipe-label.right", el);
    const playBtn = $("[data-play]", el);
    const muteBtn = $("[data-mute]", el);
    const scrub = $("[data-scrub]", el);
    const timeEl = $("[data-time]", el);
    const ctx = canvas.getContext("2d");
    const posters = $$(".wipe-fallback img", el);
    const W = 1280;
    const H = 720;
    let pos = 0.5;
    let mode = "wipe";
    let visible = false;
    let touched = false;
    let userPaused = false;
    let ready = false;

    const resize = () => {
      const r = stage.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(2, Math.round(r.width * dpr));
      canvas.height = Math.max(2, Math.round(r.height * dpr));
      draw();
    };
    new ResizeObserver(resize).observe(stage);

    // the video stacks the imagined version (top) on the real one (bottom); posters stand in until it has frames
    const source = (which) =>
      video.readyState >= 2
        ? [video, 0, which === "top" ? 0 : H, W, H]
        : posters[which === "top" ? 0 : 1]?.complete
          ? [posters[which === "top" ? 0 : 1], 0, 0, W, H]
          : undefined;

    function draw() {
      const top = source("top");
      const bottom = source("bottom");
      if (!top || !bottom) return;
      const cw = canvas.width;
      const ch = canvas.height;
      if (mode === "wipe") {
        ctx.drawImage(top[0], top[1], top[2], top[3], top[4], 0, 0, cw, ch);
        const x = Math.round(pos * cw);
        const sx = (x / cw) * W;
        if (cw - x > 0) ctx.drawImage(bottom[0], bottom[1] + sx, bottom[2], W - sx, H, x, 0, cw - x, ch);
      } else {
        ctx.fillStyle = "#050506";
        ctx.fillRect(0, 0, cw, ch);
        if (ch > cw * 0.7) {
          // narrow screens stack the two versions
          const gap = Math.round(ch * 0.012);
          const h = (ch - gap) / 2;
          const w = Math.min(cw, (h * 16) / 9);
          const x = (cw - w) / 2;
          ctx.drawImage(top[0], top[1], top[2], top[3], top[4], x, 0, w, h);
          ctx.drawImage(bottom[0], bottom[1], bottom[2], bottom[3], bottom[4], x, h + gap, w, h);
        } else {
          const gap = Math.round(cw * 0.012);
          const w = (cw - gap) / 2;
          const h = (w * 9) / 16;
          const y = (ch - h) / 2;
          ctx.drawImage(top[0], top[1], top[2], top[3], top[4], 0, y, w, h);
          ctx.drawImage(bottom[0], bottom[1], bottom[2], bottom[3], bottom[4], w + gap, y, w, h);
        }
      }
      if (!ready) {
        ready = true;
        el.classList.add("is-ready");
      }
    }

    function setPos(p) {
      pos = clamp(p, 0, 1);
      el.style.setProperty("--pos", `${pos * 100}%`);
      handle.setAttribute("aria-valuenow", String(Math.round(pos * 100)));
      left.style.opacity = mode === "side" || pos > 0.18 ? "1" : "0";
      right.style.opacity = mode === "side" || pos < 0.82 ? "1" : "0";
      draw();
    }
    setPos(0.5);
    for (const img of posters) img.addEventListener("load", draw);

    function loop() {
      if (!visible) return;
      draw();
      if (video.duration) {
        scrub.style.setProperty("--progress", `${(video.currentTime / video.duration) * 100}%`);
        scrub.setAttribute("aria-valuenow", String(Math.round(video.currentTime)));
        timeEl.textContent = `${fmtTime(video.currentTime)} / ${fmtTime(video.duration)}`;
      }
      requestAnimationFrame(loop);
    }

    // drag anywhere on the stage
    let dragging = false;
    const fromEvent = (e) => {
      const r = stage.getBoundingClientRect();
      setPos((e.clientX - r.left) / r.width);
    };
    stage.addEventListener("pointerdown", (e) => {
      if (mode !== "wipe") return;
      dragging = true;
      touched = true;
      stage.setPointerCapture(e.pointerId);
      fromEvent(e);
    });
    stage.addEventListener("pointermove", (e) => dragging && fromEvent(e));
    stage.addEventListener("pointerup", () => {
      dragging = false;
    });
    stage.addEventListener("pointercancel", () => {
      dragging = false;
    });
    handle.addEventListener("keydown", (e) => {
      const step = e.shiftKey ? 0.1 : 0.04;
      const keys = { ArrowLeft: pos - step, ArrowRight: pos + step, Home: 0, End: 1 };
      if (e.key in keys) {
        e.preventDefault();
        touched = true;
        setPos(keys[e.key]);
      }
    });

    // controls
    const syncPlay = () => {
      playBtn.classList.toggle("is-on", !video.paused);
      playBtn.setAttribute("aria-label", video.paused ? "Play" : "Pause");
    };
    video.addEventListener("play", syncPlay);
    video.addEventListener("pause", syncPlay);
    video.addEventListener("loadeddata", draw);
    video.addEventListener("seeked", draw);
    playBtn.addEventListener("click", () => {
      if (video.paused) {
        userPaused = false;
        video.play().catch(() => {});
      } else {
        userPaused = true;
        video.pause();
      }
    });
    muteBtn.addEventListener("click", () => {
      video.muted = !video.muted;
      muteBtn.classList.toggle("is-on", !video.muted);
      muteBtn.setAttribute("aria-label", video.muted ? "Turn sound on" : "Turn sound off");
      if (video.paused) video.play().catch(() => {});
    });
    const seekTo = (e) => {
      if (!video.duration) return;
      const r = scrub.getBoundingClientRect();
      video.currentTime = clamp((e.clientX - r.left) / r.width, 0, 0.999) * video.duration;
      draw();
    };
    let seeking = false;
    scrub.addEventListener("pointerdown", (e) => {
      seeking = true;
      scrub.setPointerCapture(e.pointerId);
      seekTo(e);
    });
    scrub.addEventListener("pointermove", (e) => seeking && seekTo(e));
    scrub.addEventListener("pointerup", () => {
      seeking = false;
    });
    scrub.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") video.currentTime = Math.min(video.duration, video.currentTime + 2);
      else if (e.key === "ArrowLeft") video.currentTime = Math.max(0, video.currentTime - 2);
    });
    for (const b of $$("[data-mode-btn]", el)) {
      b.addEventListener("click", () => {
        mode = b.dataset.modeBtn;
        el.dataset.mode = mode;
        for (const o of $$("[data-mode-btn]", el)) o.setAttribute("aria-pressed", String(o === b));
        setPos(pos);
      });
    }

    async function sweep() {
      if (reduceMotion || touched) return;
      const keyframes = [0.5, 0.8, 0.22, 0.5];
      for (let i = 1; i < keyframes.length; i++) {
        const from = keyframes[i - 1];
        const to = keyframes[i];
        const start = performance.now();
        const dur = 900;
        await new Promise((resolve) => {
          const tick = (now) => {
            if (touched) return resolve();
            const t = clamp((now - start) / dur, 0, 1);
            const eased = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
            setPos(from + (to - from) * eased);
            if (t < 1) requestAnimationFrame(tick);
            else resolve();
          };
          requestAnimationFrame(tick);
        });
      }
    }

    let swept = false;
    onVisible(
      el,
      (isVisible) => {
        visible = isVisible;
        if (isVisible) {
          if (!reduceMotion && !userPaused) video.play().catch(syncPlay);
          requestAnimationFrame(loop);
          if (!swept) {
            swept = true;
            setTimeout(sweep, 900);
          }
        } else {
          video.pause();
        }
      },
      { threshold: 0.2 },
    );
    if (reduceMotion) syncPlay();
  }
  const wipe = $("[data-wipe]");
  if (wipe) wipePlayer(wipe);

  // ── how it works: the step in the middle of the viewport drives the sticky panel ──────────────────────────────
  const how = $("[data-how]");
  if (how) {
    const steps = $$(".how-step", how);
    const panels = $$(".how-panel", how);
    const activate = (i) => {
      steps.forEach((s, j) => {
        s.classList.toggle("is-active", i === j);
      });
      panels.forEach((p, j) => {
        const was = p.classList.contains("is-active");
        p.classList.toggle("is-active", i === j);
        if (i === j && !was) {
          const boxes = $(".boxes", p);
          if (boxes) boxes.replaceWith(boxes.cloneNode(true));
        }
      });
    };
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) if (e.isIntersecting) activate(steps.indexOf(e.target));
        },
        { rootMargin: "-45% 0px -50% 0px" },
      );
      for (const s of steps) io.observe(s);
    }
    steps.forEach((s, i) => {
      s.addEventListener("click", () => activate(i));
    });
  }

  // ── element map explorer ─────────────────────────────────────────────────────────────────────────────────────────
  function explorer(el) {
    const data = readJson("element-map");
    if (!data) return;
    const { width: vw, height: vh } = data.viewport;
    const view = $("[data-view]", el);
    const layer = $("[data-layer]", el);
    const tip = $("[data-tip]", el);
    const cursorEl = $("[data-cursor]", el);
    const list = $("[data-ids]", el);
    const find = $("[data-find]", el);
    const codeEl = $("[data-code]", el);
    const toggle = $("[data-map-toggle]", el);
    let auto = true;
    const elements = [...data.elements].sort((a, b) => b.bbox.width * b.bbox.height - a.bbox.width * a.bbox.height);
    const byId = new Map(elements.map((e) => [e.id, e]));
    const boxes = new Map();

    for (const e of elements) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `el-box${e.interactive ? " is-interactive" : ""}`;
      b.style.cssText = box(e.bbox, vw, vh);
      b.setAttribute("aria-label", `${e.id} (${e.role})`);
      // keyboard users get the id list instead of 56 tab stops
      b.tabIndex = -1;
      b.dataset.id = e.id;
      layer.append(b);
      boxes.set(e.id, b);
    }

    function showTip(e) {
      const b = e.bbox;
      tip.innerHTML = `<b>${esc(e.id)}</b>${esc(e.role)}${e.name ? ` · “${esc(e.name)}”` : ""}<br><span>x ${Math.round(b.x)} · y ${Math.round(b.y)} · ${Math.round(b.width)}×${Math.round(b.height)}</span>`;
      const r = view.getBoundingClientRect();
      const sx = r.width / vw;
      const below = (b.y + b.height) * sx + 8;
      const top = below + 70 > r.height ? Math.max(4, b.y * sx - 64) : below;
      tip.style.left = `${clamp(b.x * sx, 4, r.width - 284)}px`;
      tip.style.top = `${top}px`;
      tip.classList.add("is-on");
    }
    const hideTip = () => tip.classList.remove("is-on");
    function hot(id) {
      for (const [k, b] of boxes) b.classList.toggle("is-hot", k === id);
      for (const li of $$("button", list)) li.classList.toggle("is-hot", li.dataset.id === id);
    }

    function code(e) {
      const q = (s) => `<span class="s">"${esc(s)}"</span>`;
      codeEl.innerHTML = e.interactive
        ? `pointer.<span class="f">moveTo</span>(app, ${q(e.id)}, { at, duration: <span class="s">0.8</span> });\npointer.<span class="f">click</span>({ at: at + <span class="s">0.9</span> });`
        : `app.<span class="f">focus</span>(${q(e.id)}, { at, scale: <span class="s">1.4</span> });\napp.<span class="f">highlight</span>(${q(e.id)}, { at, style: <span class="s">"ring"</span> });`;
    }

    async function point(e, { click = true } = {}) {
      const r = view.getBoundingClientRect();
      const sx = r.width / vw;
      const cx = (e.bbox.x + e.bbox.width / 2) * sx;
      const cy = (e.bbox.y + e.bbox.height / 2) * sx;
      cursorEl.classList.add("is-on");
      cursorEl.style.transform = `translate(${cx - 5}px, ${cy - 2.5}px)`;
      hot(e.id);
      showTip(e);
      code(e);
      await sleep(reduceMotion ? 0 : 950);
      if (click && e.interactive) {
        const ripple = document.createElement("span");
        ripple.className = "ripple";
        ripple.style.left = `${cx}px`;
        ripple.style.top = `${cy}px`;
        view.append(ripple);
        setTimeout(() => ripple.remove(), 800);
      }
    }

    layer.addEventListener("pointerover", (ev) => {
      const id = ev.target instanceof HTMLElement ? ev.target.dataset.id : undefined;
      if (!id) return;
      auto = false;
      hot(id);
      showTip(byId.get(id));
    });
    layer.addEventListener("pointerleave", () => {
      hot(null);
      hideTip();
    });
    layer.addEventListener("click", (ev) => {
      const id = ev.target instanceof HTMLElement ? ev.target.dataset.id : undefined;
      if (!id) return;
      auto = false;
      point(byId.get(id));
    });
    layer.addEventListener("focusin", (ev) => {
      const id = ev.target instanceof HTMLElement ? ev.target.dataset.id : undefined;
      if (id) {
        hot(id);
        showTip(byId.get(id));
      }
    });

    const ordered = [...data.elements].sort((a, b) => Number(b.interactive) - Number(a.interactive));
    function renderList() {
      const q = find.value.trim().toLowerCase();
      const items = ordered.filter((e) => !q || e.id.includes(q) || e.name.toLowerCase().includes(q));
      list.innerHTML = items
        .map(
          (e) =>
            `<li><button type="button" data-id="${esc(e.id)}"><span>${esc(e.id)}</span><small>${e.interactive ? "interactive" : esc(e.role)}</small></button></li>`,
        )
        .join("");
    }
    renderList();
    find.addEventListener("input", () => {
      auto = false;
      renderList();
    });
    list.addEventListener("pointerover", (ev) => {
      const b = ev.target instanceof Element ? ev.target.closest("button") : null;
      if (!b) return;
      hot(b.dataset.id);
      showTip(byId.get(b.dataset.id));
    });
    list.addEventListener("click", (ev) => {
      const b = ev.target instanceof Element ? ev.target.closest("button") : null;
      if (!b) return;
      auto = false;
      point(byId.get(b.dataset.id));
    });
    toggle.addEventListener("change", () => view.classList.toggle("show-map", toggle.checked));

    // a short tour the first time it scrolls into view
    let toured = false;
    onVisible(
      el,
      async (isVisible) => {
        if (!isVisible || toured || reduceMotion) return;
        toured = true;
        await sleep(600);
        for (const id of [
          "link:new-project",
          "link:q3-launch",
          "dm:health-prj_android-app-v2",
          "searchbox:search-projects",
        ]) {
          if (!auto) return;
          const e = byId.get(id);
          if (e) await point(e);
          await sleep(1300);
        }
      },
      { threshold: 0.5 },
    );
  }
  const exp = $("[data-explorer]");
  if (exp) explorer(exp);

  // ── flow replay ──────────────────────────────────────────────────────────────────────────────────────────────────
  function flowReplay(el) {
    const data = readJson("flow-data");
    if (!data) return;
    const { width: vw, height: vh } = data.viewport;
    const view = $("[data-flow-view]", el);
    const images = $$("img.state", el);
    const target = $("[data-flow-target]", el);
    const label = $("span", target);
    const cursorEl = $("[data-flow-cursor]", el);
    const urlEl = $("[data-flow-url]", el);
    const caption = $("[data-flow-caption]", el);
    const chips = $$("[data-goto]", el);
    const lines = $$(".yaml li", el);
    const playBtn = $("[data-flow-play]", el);
    const text = lines.map((l) => l.textContent.trim());
    const actionLines = text.map((t, i) => (/^- (click|fill|hover):/.test(t) ? i : -1)).filter((i) => i >= 0);
    const gotoLine = text.findIndex((t) => t.startsWith("- goto:"));

    // one beat per captured state, plus one per action between states
    const beats = [];
    data.states.forEach((s, i) => {
      beats.push({ kind: "state", state: i, line: text.indexOf(`- capture: ${s.id}`) });
      const stepIndex = data.steps.findIndex((st) => st.from === s.id);
      if (stepIndex >= 0)
        beats.push({ kind: "action", state: i, step: data.steps[stepIndex], line: actionLines[stepIndex] });
      else if (i < data.states.length - 1) beats.push({ kind: "goto", state: i, line: gotoLine });
    });

    let current = -1;
    let playing = false;
    let token = 0;

    const setLine = (n) => {
      lines.forEach((l, i) => {
        l.classList.toggle("is-active", i === n);
      });
      const active = lines[n];
      const list = active?.parentElement;
      if (active && list && list.scrollHeight > list.clientHeight)
        list.scrollTo({ top: active.offsetTop - list.clientHeight / 2, behavior: reduceMotion ? "auto" : "smooth" });
    };
    const setState = (i) => {
      images.forEach((img, j) => {
        img.classList.toggle("is-on", j === i);
      });
      chips.forEach((c, j) => {
        c.classList.toggle("is-on", j === i);
        c.classList.toggle("is-done", j < i);
        c.setAttribute("aria-selected", String(j === i));
      });
      urlEl.textContent = `harborly.example${data.states[i].path}`;
    };

    async function show(b, my) {
      const beat = beats[b];
      current = b;
      setLine(beat.line);
      setState(beat.state);
      const state = data.states[beat.state];
      if (beat.kind === "state") {
        target.classList.remove("is-on");
        caption.innerHTML = `<code>capture: ${esc(state.id)}</code> saves <code>${esc(state.captureId)}</code>: a screenshot and its element map.`;
        return;
      }
      if (beat.kind === "goto") {
        target.classList.remove("is-on");
        cursorEl.classList.remove("is-on");
        caption.innerHTML = "<code>goto: /app/projects</code>, then wait for the new project to appear on the board.";
        return;
      }
      const st = beat.step;
      const r = view.getBoundingClientRect();
      const sx = r.width / vw;
      target.style.cssText = box(st.bbox, vw, vh);
      label.textContent = st.elementId;
      target.classList.toggle("below", st.bbox.y < 60);
      target.classList.add("is-on");
      cursorEl.classList.add("is-on");
      cursorEl.style.transform = `translate(${(st.bbox.x + st.bbox.width / 2) * sx - 5}px, ${(st.bbox.y + st.bbox.height / 2) * sx - 2.5}px)`;
      const verb =
        st.action === "fill"
          ? `fill <code>${esc(st.elementId)}</code> with “${esc(st.value ?? "")}”`
          : `${st.action} <code>${esc(st.elementId)}</code>`;
      caption.innerHTML = `${verb}: resolved from <code>${esc(st.description.replace(/^\w+ /, ""))}</code> at x ${Math.round(st.bbox.x)}, y ${Math.round(st.bbox.y)}.`;
      if (st.action !== "hover") {
        await sleep(reduceMotion ? 0 : 900);
        if (my !== token) return;
        const ripple = document.createElement("span");
        ripple.className = "ripple";
        ripple.style.left = `${(st.bbox.x + st.bbox.width / 2) * sx}px`;
        ripple.style.top = `${(st.bbox.y + st.bbox.height / 2) * sx}px`;
        view.append(ripple);
        setTimeout(() => ripple.remove(), 800);
      }
    }

    async function play() {
      playing = true;
      playBtn.classList.add("is-on");
      playBtn.setAttribute("aria-label", "Pause the flow");
      const my = ++token;
      while (playing && my === token) {
        const next = (current + 1) % beats.length;
        if (next === 0) cursorEl.classList.remove("is-on");
        await show(next, my);
        await sleep(beats[next].kind === "action" ? 1500 : 1900);
      }
    }
    function stop() {
      playing = false;
      token++;
      playBtn.classList.remove("is-on");
      playBtn.setAttribute("aria-label", "Play the flow");
    }
    playBtn.addEventListener("click", () => (playing ? stop() : play()));
    chips.forEach((c, i) => {
      c.addEventListener("click", () => {
        stop();
        cursorEl.classList.remove("is-on");
        show(
          beats.findIndex((b) => b.kind === "state" && b.state === i),
          token,
        );
      });
    });
    show(0, token);
    let started = false;
    onVisible(
      el,
      (isVisible) => {
        if (isVisible && !started && !reduceMotion) {
          started = true;
          setTimeout(play, 500);
        } else if (!isVisible && playing) {
          stop();
          started = false;
        }
      },
      { threshold: 0.45 },
    );
  }
  const flow = $("[data-flow]");
  if (flow) flowReplay(flow);

  // ── QA inspector ─────────────────────────────────────────────────────────────────────────────────────────────────
  function qaInspector(el) {
    const cases = readJson("qa-cases");
    if (!cases) return;
    const still = $("[data-qa-still]", el);
    const img = $("[data-qa-img]", el);
    const boxesEl = $("[data-qa-boxes]", el);
    const stamp = $("[data-qa-stamp]", el);
    const note = $("[data-qa-note]", el);
    const list = $("[data-qa-findings]", el);
    const tabs = $$("[data-case]", el);

    function show(i) {
      const c = cases[i];
      tabs.forEach((t, j) => {
        t.setAttribute("aria-selected", String(i === j));
      });
      img.src = c.image;
      img.alt = `A frame of the broken example ${c.slug}`;
      const { width: sw, height: sh } = c.stage;
      let n = 0;
      const numbered = c.findings.map((f) => (f.boxes.length ? ++n : 0));
      // several rules often flag the same text: one box, all their numbers
      const groups = new Map();
      c.findings.forEach((f, fi) => {
        for (const b of f.boxes) {
          const x = clamp(b.x, 0, sw - 24);
          const w = clamp(b.x + b.width, x + 24, sw) - x;
          const key = [x, b.y, w, b.height].map(Math.round).join(",");
          const g = groups.get(key) ?? { rect: { x, y: b.y, width: w, height: b.height }, findings: [] };
          if (!g.findings.includes(fi)) g.findings.push(fi);
          groups.set(key, g);
        }
      });
      boxesEl.innerHTML = [...groups.values()]
        .map(
          (g) =>
            `<div class="qa-box" data-f=" ${g.findings.join(" ")} " data-n="${g.findings.map((fi) => numbered[fi]).join(" · ")}" style="${box(g.rect, sw, sh)}"></div>`,
        )
        .join("");
      const { errors, warnings } = c.summary;
      stamp.innerHTML = `${c.findings.length} findings · <b>${errors} error${errors === 1 ? "" : "s"}</b> · ${warnings} warning${warnings === 1 ? "" : "s"}`;
      note.innerHTML = `Frame at ${c.at} s of <code>examples/compositions/${esc(c.slug)}</code>, rendered with <code>demovie stills</code>. Findings at other moments are listed without a box. <code>qa</code> exits 1 on any error; <code>--strict</code> turns warnings into errors.`;
      list.innerHTML = c.findings
        .map(
          (f, fi) => `<li class="finding" data-f="${fi}" tabindex="0">
            <div class="finding-head"><span class="n${numbered[fi] ? "" : " none"}">${numbered[fi] || "·"}</span><span class="rule-id">${esc(f.id)}</span><span class="sev ${f.severity}">${f.severity}</span>${f.t ? `<span class="fine">at ${f.t} s</span>` : ""}</div>
            <h4 style="margin-top:6px">${esc(f.title)}</h4>
            <p class="msg">${esc(f.message)}</p>
            <p class="fix"><b>fix:</b> ${esc(f.fix)}</p>
          </li>`,
        )
        .join("");
    }
    const hotFinding = (fi) => {
      still.classList.toggle("has-hot", fi !== null);
      for (const b of $$(".qa-box", boxesEl))
        b.classList.toggle("is-hot", fi !== null && b.dataset.f.includes(` ${fi} `));
    };
    list.addEventListener("pointerover", (e) => {
      const li = e.target instanceof Element ? e.target.closest(".finding") : null;
      hotFinding(li ? li.dataset.f : null);
    });
    list.addEventListener("pointerleave", () => hotFinding(null));
    list.addEventListener("focusin", (e) => {
      const li = e.target instanceof Element ? e.target.closest(".finding") : null;
      if (li) hotFinding(li.dataset.f);
    });
    list.addEventListener("focusout", () => hotFinding(null));
    tabs.forEach((t, i) => {
      t.addEventListener("click", () => show(i));
    });
    show(0);
  }
  const qa = $("[data-qa]");
  if (qa) qaInspector(qa);

  const rules = $("[data-rules]");
  if (rules) {
    const buttons = $$("[data-filter]", rules);
    for (const b of buttons) {
      b.addEventListener("click", () => {
        for (const o of buttons) o.setAttribute("aria-pressed", String(o === b));
        for (const r of $$(".rule", rules)) r.hidden = b.dataset.filter !== "all" && r.dataset.cat !== b.dataset.filter;
      });
    }
  }

  // ── gallery: tabs, hover previews and the lightbox ──────────────────────────────────────────────────────────────
  for (const b of $$("[data-gtab]")) {
    b.addEventListener("click", () => {
      for (const o of $$("[data-gtab]")) o.setAttribute("aria-pressed", String(o === b));
      for (const p of $$("[data-gpanel]")) p.hidden = p.dataset.gpanel !== b.dataset.gtab;
    });
  }
  const canHover = window.matchMedia("(hover: hover)").matches;
  for (const card of $$(".vcard")) {
    const video = $("video", card);
    if (canHover && !reduceMotion) {
      card.addEventListener("pointerenter", () => {
        loadVideo(video);
        video.currentTime = 0;
        video
          .play()
          .then(() => video.classList.add("is-playing"))
          .catch(() => {});
      });
      card.addEventListener("pointerleave", () => {
        video.pause();
        video.classList.remove("is-playing");
      });
    }
  }

  const videos = readJson("videos") ?? [];
  const lb = $("[data-lightbox]");
  if (lb) {
    const lbVideo = $("[data-lb-video]", lb);
    const setFormat = (v, f) => {
      lbVideo.poster = v.posters[f];
      lbVideo.src = v.sources[f];
      lbVideo.play().catch(() => {});
      for (const b of $$("[data-lb-formats] button", lb)) b.setAttribute("aria-pressed", String(b.dataset.f === f));
    };
    const open = (id) => {
      const v = videos.find((x) => x.id === id);
      if (!v) return;
      $("[data-lb-title]", lb).textContent = v.title;
      $("[data-lb-blurb]", lb).textContent = v.blurb;
      $("[data-lb-made]", lb).textContent = v.made;
      $("[data-lb-source]", lb).href = v.source;
      $("[data-lb-facts]", lb).innerHTML =
        `<dt>Type</dt><dd>${esc(v.type)}</dd><dt>Style</dt><dd>${esc(v.style)}</dd><dt>Length</dt><dd>${v.duration} s</dd><dt>QA</dt><dd class="pass">0 errors</dd>`;
      const formats = $("[data-lb-formats]", lb);
      formats.innerHTML = v.formats.map((f) => `<button type="button" data-f="${f}">${f}</button>`).join("");
      formats.hidden = v.formats.length < 2;
      for (const b of $$("button", formats)) b.addEventListener("click", () => setFormat(v, b.dataset.f));
      lbVideo.muted = false;
      lb.showModal();
      setFormat(v, v.formats.includes("16:9") ? "16:9" : v.formats[0]);
    };
    for (const card of $$(".vcard")) card.addEventListener("click", () => open(card.dataset.video));
    const close = () => {
      lbVideo.pause();
      lbVideo.removeAttribute("src");
      lbVideo.load();
      if (lb.open) lb.close();
    };
    $("[data-lb-close]", lb).addEventListener("click", close);
    lb.addEventListener("click", (e) => {
      if (e.target === lb) close();
    });
    lb.addEventListener("close", () => {
      lbVideo.pause();
    });
  }

  // gallery page: switch formats in place
  for (const player of $$("[data-showcase]")) {
    const video = $("video", player);
    for (const b of $$("[data-format-src]", player)) {
      b.addEventListener("click", () => {
        for (const o of $$("[data-format-src]", player)) o.setAttribute("aria-pressed", String(o === b));
        video.poster = b.dataset.formatPoster;
        video.dataset.src = b.dataset.formatSrc;
        video.src = b.dataset.formatSrc;
        video.play().catch(() => {});
      });
    }
  }

  // ── agent tabs ───────────────────────────────────────────────────────────────────────────────────────────────────
  for (const tabsEl of $$("[data-tabs]")) {
    const tabs = $$("[data-tab]", tabsEl);
    const select = (t) => {
      for (const o of tabs) o.setAttribute("aria-selected", String(o === t));
      for (const p of $$("[data-tabpanel]", tabsEl)) p.hidden = p.dataset.tabpanel !== t.dataset.tab;
    };
    tabs.forEach((t, i) => {
      t.addEventListener("click", () => select(t));
      t.addEventListener("keydown", (e) => {
        const d =
          e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        const next = tabs[(i + d + tabs.length) % tabs.length];
        next.focus();
        select(next);
      });
    });
  }

  // ── typed terminal ───────────────────────────────────────────────────────────────────────────────────────────────
  const typed = $("[data-typed]");
  if (typed) {
    const lines = $$(".tl", typed);
    if (reduceMotion) {
      for (const l of lines) l.classList.add("is-shown");
    } else {
      let done = false;
      onVisible(
        typed,
        async (isVisible) => {
          if (!isVisible || done) return;
          done = true;
          for (const line of lines) {
            const html = line.innerHTML;
            const textContent = line.textContent;
            line.classList.add("is-shown");
            if (textContent.startsWith("$ ")) {
              const cmdEnd = textContent.includes("  #") ? textContent.indexOf("  #") : textContent.length;
              for (let i = 2; i <= cmdEnd; i++) {
                line.textContent = textContent.slice(0, i);
                await sleep(28 + Math.random() * 30);
              }
              line.innerHTML = html;
              await sleep(380);
            } else {
              await sleep(220);
            }
          }
        },
        { threshold: 0.5 },
      );
    }
  }
})();
