/* ───────────────────────────────────────────────
   Lenis smooth scroll + HUD progress + reveals
─────────────────────────────────────────────── */
(function () {
  // ─── Lenis ───
  const lenis = new Lenis({
    lerp: 0.08,
    smoothWheel: true,
    anchors: { offset: -60 },
  });

  // global scroll progress (0..1) consumed by gpu.js
  window.__scroll = 0;
  // intro-driven explode (0..1) — GPU uses max(scroll-explode, introExplode)
  window.__introExplode = 0;

  // ─── INTRO / BOOT SEQUENCE ───
  (function boot() {
    const intro = document.getElementById("intro");
    if (!intro) return;

    const fill = document.getElementById("introFill");
    const pctEl = document.getElementById("introPct");
    const statusEl = document.getElementById("introStatus");
    const enterBtn = document.getElementById("introEnter");
    const shock = document.getElementById("introShock");
    const flash = document.getElementById("introFlash");

    // Lock scroll until sequence finishes
    lenis.stop();
    document.documentElement.style.overflow = "hidden";

    const steps = [
      "WARMING SILICON",
      "LOADING TENSOR CORES",
      "CALIBRATING RT",
      "SYNCING COOLING LOOP",
      "UNLOCKING POWER",
      "READY TO DETONATE",
    ];

    let p = 0;
    const tick = setInterval(() => {
      p += 1.4 + Math.random() * 1.6;
      if (p > 100) p = 100;
      const rounded = Math.round(p);
      if (fill)  fill.style.width = rounded + "%";
      if (pctEl) pctEl.textContent = String(rounded).padStart(2, "0") + "%";
      const idx = Math.min(steps.length - 1, Math.floor(p / (100 / steps.length)));
      if (statusEl) statusEl.textContent = steps[idx];

      if (p >= 100) {
        clearInterval(tick);
        if (enterBtn) {
          enterBtn.disabled = false;
          enterBtn.classList.add("is-ready");
        }
      }
    }, 55);

    function detonate() {
      if (enterBtn) enterBtn.disabled = true;

      // 1. Shockwave ring + flash
      shock?.classList.add("is-boom");
      flash?.classList.add("is-boom");

      // 2. Burst the GPU parts outward (drive __introExplode 0→1)
      const burstStart = performance.now();
      const burstDur = 700;
      function burst(now) {
        const t = Math.min(1, (now - burstStart) / burstDur);
        // ease-out quart
        window.__introExplode = 1 - Math.pow(1 - t, 4);
        if (t < 1) requestAnimationFrame(burst);
      }
      requestAnimationFrame(burst);

      // 3. After flash peaks, start fading overlay
      setTimeout(() => intro.classList.add("is-gone"), 520);

      // 4. Release scroll + smoothly collapse the intro explosion
      setTimeout(() => {
        lenis.start();
        document.documentElement.style.overflow = "";
        const collapseStart = performance.now();
        const collapseDur = 900;
        function collapse(now) {
          const t = Math.min(1, (now - collapseStart) / collapseDur);
          window.__introExplode = 1 - t;
          if (t < 1) requestAnimationFrame(collapse);
          else window.__introExplode = 0;
        }
        requestAnimationFrame(collapse);
        try { intro.parentNode.removeChild(intro); } catch (e) {}
      }, 1300);
    }

    enterBtn?.addEventListener("click", detonate);
    // Allow Enter / Space to launch once ready
    document.addEventListener("keydown", (ev) => {
      if (enterBtn?.classList.contains("is-ready") && (ev.key === "Enter" || ev.key === " ")) {
        ev.preventDefault();
        detonate();
      }
    });
  })();

  // XP / HUD bar refs
  const xpFill = document.querySelector(".xpbar__fill");
  const xpValue = document.querySelector(".xpbar__value");
  const xpBar = document.querySelector(".xpbar");

  function onScroll() {
    const doc = document.documentElement;
    const max = doc.scrollHeight - window.innerHeight;
    const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    window.__scroll = p;

    const pct = Math.round(p * 100);
    if (xpFill) xpFill.style.width = (pct) + "%";
    if (xpValue) xpValue.textContent = String(pct).padStart(2, "0") + "%";
    if (xpBar) xpBar.setAttribute("aria-valuenow", String(pct));
  }

  lenis.on("scroll", () => {
    onScroll();
    if (window.ScrollTrigger) ScrollTrigger.update();
  });

  // Standard fallback in case Lenis scroll event misses an early paint
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", () => {
    onScroll();
    if (window.__gpuResize) window.__gpuResize();
  });

  // GSAP + ScrollTrigger bridge
  if (window.gsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  } else {
    function raf(time) { lenis.raf(time); requestAnimationFrame(raf); }
    requestAnimationFrame(raf);
  }

  onScroll();

  // ─── Reveal on view ───
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        e.target.classList.add("in");
        io.unobserve(e.target);
      }
    }
  }, { threshold: 0.15 });

  document.querySelectorAll(
    ".hero__tag, .hero__title, .hero__sub, .hero__cta, .hero__spec, " +
    ".feature__meta, .feature__body, .perf__head, .stat, " +
    ".cine__art, .cine__copy, .buy__card"
  ).forEach(el => { el.classList.add("reveal"); io.observe(el); });

  // ─── Stat counters + bar fills ───
  const statsIO = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const el = e.target;
      statsIO.unobserve(el);

      el.querySelectorAll(".count").forEach(c => {
        const to = parseFloat(c.dataset.to || "0");
        const dur = 1600;
        const start = performance.now();
        const fmt = new Intl.NumberFormat("en-US");
        function tick(now) {
          const t = Math.min(1, (now - start) / dur);
          const eased = 1 - Math.pow(1 - t, 3);
          c.textContent = fmt.format(Math.round(to * eased));
          if (t < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      });

      el.querySelectorAll(".bar__fill").forEach(b => {
        const pct = b.dataset.fill || "0";
        requestAnimationFrame(() => { b.style.width = pct + "%"; });
      });
    }
  }, { threshold: 0.3 });

  document.querySelectorAll(".stat").forEach(s => statsIO.observe(s));

  // ─── Buy button micro-interaction ───
  document.querySelectorAll(".btn--primary").forEach(b => {
    b.addEventListener("click", (ev) => {
      const r = document.createElement("span");
      r.style.cssText = "position:absolute;inset:auto;width:10px;height:10px;border-radius:50%;background:#fff;pointer-events:none;transform:translate(-50%,-50%);mix-blend-mode:screen;";
      const rect = b.getBoundingClientRect();
      r.style.left = (ev.clientX - rect.left) + "px";
      r.style.top  = (ev.clientY - rect.top)  + "px";
      b.appendChild(r);
      r.animate(
        [{ transform: "translate(-50%,-50%) scale(1)", opacity: .9 },
         { transform: "translate(-50%,-50%) scale(30)", opacity: 0 }],
        { duration: 700, easing: "cubic-bezier(.2,.7,.2,1)" }
      ).onfinish = () => r.remove();
    });
  });

  // ─── Dock active-section tracking ───
  const dockBtns = Array.from(document.querySelectorAll(".dock__btn"));
  const dockTargets = dockBtns.map(btn => {
    const id = btn.dataset.id;
    return { btn, el: id === "top" ? document.querySelector(".hero") : document.getElementById(id) };
  }).filter(t => t.el);

  const dockIO = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        const t = dockTargets.find(t => t.el === e.target);
        if (!t) return;
        dockTargets.forEach(o => o.btn.classList.toggle("is-active", o === t));
      }
    });
  }, { rootMargin: "-45% 0px -45% 0px", threshold: 0 });
  dockTargets.forEach(t => dockIO.observe(t.el));

  // Smooth scroll on dock/command clicks (Lenis handles anchors, but explicit for non-anchor)
  dockBtns.forEach(b => {
    b.addEventListener("click", (ev) => {
      const href = b.getAttribute("href");
      if (!href || !href.startsWith("#")) return;
      ev.preventDefault();
      const id = href.slice(1);
      const el = id === "top" ? document.body : document.getElementById(id);
      if (el) lenis.scrollTo(el, { offset: -40, duration: 1.4 });
    });
  });

  // ─── Command bar ───
  const btnTop = document.getElementById("cmd-top");
  const btnNext = document.getElementById("cmd-next");
  const btnBuy = document.getElementById("cmd-buy");
  const btnFx = document.getElementById("cmd-fx");

  btnTop?.addEventListener("click", () => lenis.scrollTo("top", { duration: 1.6 }));
  btnBuy?.addEventListener("click", () => lenis.scrollTo("#buy", { offset: -40, duration: 1.6 }));
  btnNext?.addEventListener("click", () => {
    const order = ["top", "architecture", "performance", "cinematic", "buy"];
    const activeIdx = dockTargets.findIndex(t => t.btn.classList.contains("is-active"));
    const next = dockTargets[Math.min(dockTargets.length - 1, Math.max(0, activeIdx + 1))];
    if (next) lenis.scrollTo(next.el, { offset: -40, duration: 1.4 });
  });

  btnFx?.addEventListener("click", () => {
    const off = btnFx.classList.toggle("is-off");
    document.body.classList.toggle("fx-off", off);
    window.__fxOff = off;
  });

  // ─── Theme toggle ───
  const btnTheme = document.getElementById("cmd-theme");
  const savedTheme = (() => { try { return localStorage.getItem("rtx-theme"); } catch(e) { return null; } })();
  if (savedTheme === "light") document.body.classList.add("theme-light");

  btnTheme?.addEventListener("click", () => {
    const isLight = document.body.classList.toggle("theme-light");
    try { localStorage.setItem("rtx-theme", isLight ? "light" : "dark"); } catch(e) {}
    window.__themeLight = isLight;
    if (typeof window.__gpuTheme === "function") window.__gpuTheme(isLight);
  });
  window.__themeLight = document.body.classList.contains("theme-light");

  // ─── HUD clock ───
  const clk = document.getElementById("clk");
  function tick() {
    if (!clk) return;
    const d = new Date();
    clk.textContent = String(d.getHours()).padStart(2,"0") + ":" + String(d.getMinutes()).padStart(2,"0");
  }
  tick(); setInterval(tick, 20_000);

  // ─── subtle parallax on ambient glows ───
  const glowA = document.querySelector(".ambient__glow--a");
  const glowB = document.querySelector(".ambient__glow--b");
  function parallax() {
    if (!glowA || !glowB) return;
    const p = window.__scroll;
    glowA.style.transform = `translate(${p * 40}px, ${p * -60}px)`;
    glowB.style.transform = `translate(${p * -40}px, ${p * 60}px)`;
    requestAnimationFrame(parallax);
  }
  requestAnimationFrame(parallax);
})();
