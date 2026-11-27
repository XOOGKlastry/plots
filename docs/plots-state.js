/* Wspólny stan trzech trybów (Mapa, Statystyki, Dashboard): wybrana gmina, wskaźnik, rok, miara.
   PlotsState.set(patch) zapisuje zmiany i wysyła zdarzenie "plots:state" z listą zmienionych pól.
   Tryby słuchają zdarzenia i odświeżają tylko to, co ich dotyczy. Stan nie jest źródłem danych, tylko wyborem użytkownika. */
(function () {
  "use strict";
  const params = new URLSearchParams(location.search);
  const state = {
    tryb: params.get("tryb") === "dash" ? "dashboard" : params.get("stat") ? "statystyki" : "mapa",
    gmina: params.get("gmina") || null,
    wskaznik: params.get("stat") || null,
    rok: Number(params.get("rok")) || null,
    miara: "value"
  };
  const FIELDS = Object.keys(state);
  function set(patch, source = "") {
    const changed = [];
    for (const k of FIELDS) if (k in patch && patch[k] !== state[k]) { state[k] = patch[k] ?? null; changed.push(k); }
    if (!changed.length) return false;
    document.dispatchEvent(new CustomEvent("plots:state", { detail: { changed, source, state: { ...state } } }));
    return true;
  }
  function get(key) { return key ? state[key] : { ...state }; }
  function on(fn) { const h = e => fn(e.detail); document.addEventListener("plots:state", h); return () => document.removeEventListener("plots:state", h); }
  // Gmina wybrana na mapie (karta gminy) jest gminą wszystkich trybów.
  document.addEventListener("plots:gmina", e => set({ gmina: e.detail?.id || null }, "mapa"));
  window.PlotsState = { get, set, on };
})();
