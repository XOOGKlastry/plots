window.PLOTS_CONFIG = {
  // Publiczny HTTPS (Cloudflare Tunnel z OptimusPrime). Nadpisz: ?tiles=https://...
  // Lokalnie bez tunelu: ?tiles=http://127.0.0.1:5001
  TILES_URL: "https://bedrooms-matches-louisville-manuals.trycloudflare.com",
  // Stare mapy (PMTiles) w Cloudflare R2, np. "https://pub-xxxx.r2.dev". Puste = kafle z data/stare. Nadpisz: ?stare=https://...
  STARE_URL: "https://pub-313f6b9b64f641ec9ef1bdc42305f2d8.r2.dev/stare",
  MIN_ZOOM: 13,
  ADR_MIN_ZOOM: 16
};
