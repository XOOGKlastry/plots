/* Animacje interfejsu: liczby „dobiegają” do wartości, wykresy i paski rysują się przy wejściu na ekran.
   Jeden przełącznik w panelu Warstwy (Wygląd → Animacje) wyłącza wszystko i przywraca zwykły, statyczny widok.
   Szanuje systemowe „ogranicz ruch”. Inne moduły pytają Motion.on() przed uruchomieniem własnych animacji. */
(function () {
  "use strict";
  const KEY = "plots.anim", reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const pref = () => { try { return localStorage.getItem(KEY) !== "0"; } catch { return true; } };
  const on = () => pref() && !reduced.matches;
  const listeners = new Set();
  function set(v) {
    try { localStorage.setItem(KEY, v ? "1" : "0"); } catch { /* optional */ }
    apply(); listeners.forEach(fn => { try { fn(on()); } catch { /* ignore */ } });
  }
  function apply() {
    document.body.classList.toggle("no-anim", !on());
    const box = document.getElementById("lyrAnim"); if (box) box.checked = pref();
  }

  /* Number count-up: the first number in the element's first text node runs from 0 to its value. */
  const NUM = /([+−-]?)(\d{1,3}(?:[\s ]\d{3})+|\d+)(,\d+)?/;
  function countUp(el) {
    const node = [...el.childNodes].find(n => n.nodeType === 3 && NUM.test(n.textContent));
    if (!node) return;
    const text = node.textContent, m = text.match(NUM), digits = m[3] ? m[3].length - 1 : 0;
    const target = Number(m[2].replace(/[\s ]/g, "") + (m[3] ? "." + m[3].slice(1) : ""));
    if (!Number.isFinite(target) || (!digits && !m[1] && target >= 1900 && target <= 2100 && !/\s/.test(m[2]))) return; // years stay as they are
    const pre = text.slice(0, m.index) + m[1], post = text.slice(m.index + m[0].length), t0 = performance.now(), dur = 750;
    const step = now => {
      if (!node.isConnected) return;
      const t = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - t, 3);
      node.textContent = t >= 1 ? text : pre + (target * e).toLocaleString("pl-PL", { minimumFractionDigits: digits, maximumFractionDigits: digits }) + post;
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* What gets animated when it scrolls into view. */
  const CLIP = ".ext-line svg, .pop-area svg, .tl-spark svg, .bud-bar, .ext-fb, .mg-bars";
  const COUNT = ".pop-summary strong, .pyramid:not(.tl) .pyr-big > b, .indicator-value, .ext-big b";
  const PYR = ".pyramid:not(.tl) .pyr-bars";
  let io = null;
  const waiting = new Map(); // observed element -> elements revealed when it shows up
  function reveal(el) {
    el.classList.remove("m-pre");
    if (el.matches?.(COUNT) && !el.dataset.mc) { el.dataset.mc = 1; countUp(el); }
  }
  // A clipped element has no visible area, so the observer would never see it: watch its parent instead.
  function observe(target, el) {
    if (!waiting.has(target)) { waiting.set(target, []); io.observe(target); }
    waiting.get(target).push(el);
  }
  function scan(root) {
    if (!on() || !root) return;
    io = io || new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target); const list = waiting.get(e.target) || []; waiting.delete(e.target);
      requestAnimationFrame(() => list.forEach(reveal));
    }), { threshold: .15 });
    root.querySelectorAll(`${CLIP}, ${PYR}`).forEach(el => {
      if (el.dataset.m) return; el.dataset.m = 1;
      el.classList.add("m-pre", el.matches(PYR) ? "m-pyr" : "m-clip");
      if (el.matches(PYR)) el.querySelectorAll(".pyr-row").forEach((r, i, all) => r.style.setProperty("--d", (all.length - 1 - i) * 22 + "ms"));
      observe(el.parentElement || el, el);
    });
    root.querySelectorAll(COUNT).forEach(el => { if (el.dataset.m) return; el.dataset.m = 1; observe(el, el); });
    // Safety net: anything still hidden after 4 s is shown, so a missed observer never leaves an empty chart.
    setTimeout(() => root.querySelectorAll(".m-pre").forEach(el => { const r = el.getBoundingClientRect(); if (r.bottom > 0 && r.top < innerHeight) reveal(el); }), 4000);
  }
  function watch(root) {
    if (!root || root.dataset.mw) return; root.dataset.mw = 1;
    let t = 0;
    new MutationObserver(() => { clearTimeout(t); t = setTimeout(() => scan(root), 30); }).observe(root, { childList: true, subtree: true });
    scan(root);
  }

  function addSwitch() {
    const panel = document.getElementById("layerPanel"); if (!panel || document.getElementById("lyrAnim")) return;
    const g = document.createElement("div"); g.className = "layer-entry"; g.id = "lookLayers"; g.dataset.keywords = "animacje ruch wygląd efekty";
    g.innerHTML = `<label class="sw"><input type="checkbox" id="lyrAnim"><span></span><div>Animacje<small>Płynne wykresy, liczniki, przelot do gminy i ruch na strzałkach dojazdów. Wyłącz, aby wrócić do statycznego widoku.</small></div></label>`;
    g.querySelector("#lyrAnim").addEventListener("change", e => set(e.target.checked));
    // Goes into "Wygląd i informacje" once the layer panel has grouped its sections (layer-ui.js).
    const place = () => { const s = panel.querySelector(".layer-settings"); if (!s) return false; s.prepend(g); apply(); return true; };
    if (!place()) { const before = document.getElementById("noLayers"); before ? before.before(g) : panel.append(g); const mo = new MutationObserver(() => { if (place()) mo.disconnect(); }); mo.observe(panel, { childList: true, subtree: true }); }
  }
  function init() { addSwitch(); apply(); watch(document.getElementById("gminaDetails")); }
  reduced.addEventListener?.("change", apply);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
  window.Motion = { on, set, onChange: fn => listeners.add(fn), scan, countUp };
})();
