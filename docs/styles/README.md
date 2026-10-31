# Basemap styles

`map-light.json` (Positron) and `map-dark.json` (Dark) were retrieved from OpenFreeMap on 2026-10-31:

- https://tiles.openfreemap.org/styles/positron
- https://tiles.openfreemap.org/styles/dark
- Integration and attribution: https://openfreemap.org/quick_start/

The style JSON is stored locally for predictable updates. Its vector/raster tiles, glyphs and sprite remain hosted by OpenFreeMap. Source attribution is retained in the style; MapLibre renders the OpenFreeMap, OpenMapTiles and OpenStreetMap credits. Geoportal ortho/topo retain their GUGiK attribution. The raster Esri map is a fallback if the local standard style cannot be loaded.

Basemap changes preserve parcel/address/hillshade sources, active visibility, opacity and selection. They do not replace application data or change coordinate systems in the API.
