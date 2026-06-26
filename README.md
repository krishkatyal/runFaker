# RunFaker — generate believable runs you never actually ran

A self-contained, single-page web app that lets you **draw a route on a map and
generate a realistic GPX file** (with synthetic pace, heart-rate and elevation
data) you can download and use anywhere a `.gpx` track is accepted.

This is a clean-room clone of the FakeMyRun workflow built from scratch — no
proprietary code or assets are used.

## Features

- **Draw your route** — search any place (OpenStreetMap / Nominatim) and click
  the map to drop route points.
- **Shapes** — one-click **Heart** and **Circle** generators, or freehand
  **Draw** mode.
- **Snap to roads** — optional routing through the public OSRM server so the
  path follows real streets (falls back to straight lines if offline).
- **Activity type** — Run or Bike (changes GPX `<type>` and default pace).
- **Live stats** — distance, duration, elevation gain and average pace, all
  recomputed as you draw and tweak.
- **Realistic data synthesis**
  - Average pace + **pace inconsistency** (noise amplitude), grade-aware
    (uphill slows you down).
  - **Elevation profile** scaled to hit a target total gain.
  - **Heart-rate profile** with average, variability, upward drift and a
    grade response; re-centred so the realised average matches your target.
- **Data visualization** — pace, elevation and heart-rate profile charts drawn
  on canvas.
- **Run details** — name, date, start time and description, written into the
  GPX metadata.
- **GPX 1.1 export** with Garmin `TrackPointExtension` heart-rate tags, so it
  imports cleanly into Strava, Garmin Connect and similar tools.

## Run it

It's pure static HTML/CSS/JS — no build step. Just serve the folder:

```bash
cd fakemyrun
python3 -m http.server 8000
# then open http://localhost:8000
```

(Opening `index.html` directly via `file://` also works, but a local server is
recommended so the map tiles, search and road-snapping requests behave.)

## File layout

| File | Responsibility |
|------|----------------|
| `index.html` | Layout and controls |
| `css/styles.css` | Dark theme + responsive grid |
| `js/geo.js` | Haversine distance, route resampling, heart/circle shapes |
| `js/profiles.js` | Pace / HR / elevation synthesis + time integration |
| `js/charts.js` | Lightweight canvas line charts |
| `js/gpx.js` | GPX 1.1 builder + file download |
| `js/app.js` | Map, controls, state and rendering glue |

## Notes & limitations

- Search and road-snapping call public OpenStreetMap services; they need
  network access and are rate-limited. Everything else works fully offline once
  the Leaflet assets are cached.
- Generated data is **synthetic**. Use it for testing, demos and route
  planning — not for misrepresenting real athletic performance.
