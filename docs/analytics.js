/* Visitor analytics (PostHog, EU servers). No cookies or local storage: each visit is an anonymous, separate person.
   KEY is the PostHog project API key (phc_…), public by design. Empty KEY = nothing is loaded.
   ?notrack=1 turns tracking off in this browser (for our own visits), ?notrack=0 turns it back on. */
(function () {
  const KEY = "";
  const HOST = "https://eu.i.posthog.com";
  const REPLAY = false; // session recordings: off without a consent banner

  const queue = [];
  window.Track = (event, props) => { queue.length < 200 && queue.push([event, props]); };
  let off = false;
  try {
    const q = new URLSearchParams(location.search).get("notrack");
    if (q === "1") localStorage.setItem("plots-notrack", "1");
    if (q === "0") localStorage.removeItem("plots-notrack");
    off = localStorage.getItem("plots-notrack") === "1";
  } catch (e) { /* storage blocked: track normally */ }
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) && !/[?&]track=1/.test(location.search);
  if (!KEY || off || local || navigator.webdriver) { window.Track = () => {}; return; }

  const s = document.createElement("script");
  s.src = "https://eu-assets.i.posthog.com/static/array.full.js";
  s.async = true; s.crossOrigin = "anonymous";
  s.onload = () => {
    const ph = window.posthog; if (!ph?.init) { window.Track = () => {}; return; }
    ph.init(KEY, {
      api_host: HOST,
      persistence: "memory",
      person_profiles: "identified_only",
      autocapture: true,
      capture_pageview: true,
      capture_pageleave: true,
      disable_session_recording: !REPLAY,
      session_recording: { maskAllInputs: true },
      mask_all_element_attributes: false,
      ip: false
    });
    ph.register({ urzadzenie: matchMedia("(max-width: 767px)").matches ? "telefon" : "komputer", tryb: matchMedia("(display-mode: standalone)").matches ? "aplikacja" : "przeglądarka" });
    window.Track = (event, props) => { try { ph.capture(event, props); } catch (e) { /* never break the app */ } };
    queue.splice(0).forEach(([e, p]) => window.Track(e, p));
  };
  s.onerror = () => { window.Track = () => {}; };
  document.head.appendChild(s);
})();
