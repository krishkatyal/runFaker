/* app.js — wires the map, controls, profile rendering and GPX export */
(function () {
  "use strict";

  // ----- state -----
  const state = {
    waypoints: [],      // [[lat,lng], ...] user/route points
    drawnPath: [],      // path actually rendered (after snap/shape)
    shape: "draw",
    activity: "run",
    snap: false,
    showWaypoints: true,
    result: null,
    seed: 1234,
  };

  const $ = (id) => document.getElementById(id);

  // ----- map -----
  const map = L.map("map", { zoomControl: true }).setView([12.9716, 77.5946], 13); // Bengaluru
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);

  let polyline = L.polyline([], { color: "#fc4c02", weight: 4 }).addTo(map);
  let markerLayer = L.layerGroup().addTo(map);

  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove("show"), 2200);
  }

  // ----- route rendering -----
  function renderRoute() {
    state.drawnPath = state.waypoints.slice();
    polyline.setLatLngs(state.drawnPath);
    markerLayer.clearLayers();
    if (state.showWaypoints) {
      state.drawnPath.forEach((p) => {
        L.circleMarker(p, {
          radius: 4, color: "#fff", weight: 2, fillColor: "#fc4c02", fillOpacity: 1,
        }).addTo(markerLayer);
      });
    }
    recompute();
  }

  // ----- snap to roads via OSRM (best-effort, falls back to straight lines) -----
  async function maybeSnap() {
    if (!state.snap || state.waypoints.length < 2) { renderRoute(); return; }
    try {
      const coords = state.waypoints.map((p) => `${p[1]},${p[0]}`).join(";");
      const url = `https://router.project-osrm.org/route/v1/${state.activity === "bike" ? "bike" : "foot"}/${coords}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.routes && data.routes[0]) {
        const line = data.routes[0].geometry.coordinates.map((c) => [c[1], c[0]]);
        state.drawnPath = line;
        polyline.setLatLngs(line);
        markerLayer.clearLayers();
        if (state.showWaypoints) {
          state.waypoints.forEach((p) =>
            L.circleMarker(p, { radius: 4, color: "#fff", weight: 2, fillColor: "#fc4c02", fillOpacity: 1 }).addTo(markerLayer));
        }
        recompute();
        return;
      }
    } catch (e) {
      toast("Road snapping unavailable — using straight lines.");
    }
    renderRoute();
  }

  // ----- map click adds a waypoint (only in draw mode) -----
  map.on("click", (e) => {
    if (state.shape !== "draw") return;
    state.waypoints.push([e.latlng.lat, e.latlng.lng]);
    maybeSnap();
  });

  // ----- shape generation centred on current map view -----
  function generateShape(kind) {
    const c = map.getCenter();
    const center = [c.lat, c.lng];
    // size ~ 40% of the visible span
    const bounds = map.getBounds();
    const spanM = Geo.haversine([bounds.getNorth(), c.lng], [bounds.getSouth(), c.lng]);
    const size = spanM * 0.35;
    if (kind === "circle") state.waypoints = Geo.circle(center, size / 2);
    else if (kind === "heart") state.waypoints = Geo.heart(center, size);
    state.snap = false; $("snapRoad").checked = false;
    renderRoute();
    if (state.drawnPath.length) map.fitBounds(polyline.getBounds().pad(0.2));
  }

  // ===================== CONTROLS =====================
  // shape buttons
  document.querySelectorAll("[data-shape]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-shape]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.shape = btn.dataset.shape;
      if (state.shape === "heart" || state.shape === "circle") {
        generateShape(state.shape);
      } else {
        toast("Click on the map to drop route points.");
      }
    });
  });

  // activity buttons
  document.querySelectorAll("[data-activity]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-activity]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.activity = btn.dataset.activity;
      // sensible default pace per activity
      if (state.activity === "bike" && +$("avgPace").value < 3) $("avgPace").value = 2.5;
      maybeSnap();
    });
  });

  $("snapRoad").addEventListener("change", (e) => { state.snap = e.target.checked; maybeSnap(); });
  $("showWaypoints").addEventListener("change", (e) => { state.showWaypoints = e.target.checked; renderRoute(); });
  $("undoBtn").addEventListener("click", () => { state.waypoints.pop(); maybeSnap(); });
  $("clearBtn").addEventListener("click", () => { state.waypoints = []; renderRoute(); });

  // sliders / live outputs
  function bindRange(id, outId, fmt) {
    const el = $(id), out = $(outId);
    const update = () => { out.textContent = fmt(el.value); recompute(); };
    el.addEventListener("input", update);
    update();
  }
  bindRange("avgPace", "avgPaceOut", (v) => Number(v).toFixed(2));
  bindRange("paceVar", "paceVarOut", (v) => v + "%");
  bindRange("elevGain", "elevGainOut", (v) => v + " m");
  bindRange("avgHR", "avgHROut", (v) => v + " bpm");
  bindRange("hrVar", "hrVarOut", (v) => v + "%");

  $("paceVar").addEventListener("input", (e) => {
    const v = +e.target.value;
    $("paceVarDesc").textContent =
      v < 8 ? "Very steady pace (flat course, metronomic effort)" :
      v < 25 ? "Moderate pace changes (varied terrain or intervals)" :
      v < 40 ? "Large pace swings (hills or hard intervals)" :
      "Extreme variation (fartlek / stop-start effort)";
  });
  $("avgHR").addEventListener("input", (e) => {
    const v = +e.target.value;
    $("hrDesc").textContent =
      v < 115 ? "Low intensity, easy effort" :
      v < 140 ? "Moderate aerobic effort" :
      v < 165 ? "High intensity, vigorous effort" :
      "Very high intensity, near-maximal effort";
  });

  $("includeHR").addEventListener("change", (e) => {
    $("hrFields").style.display = e.target.checked ? "" : "none";
    $("hrChartCard").style.display = e.target.checked ? "" : "none";
    recompute();
  });

  $("paceUnit").addEventListener("change", (e) => {
    document.querySelectorAll(".paceUnitLabel").forEach((n) => (n.textContent = e.target.value));
    $("statPaceUnit").textContent = e.target.value;
    recompute();
  });

  ["runName", "runDate", "runTime", "runDesc"].forEach((id) =>
    $(id).addEventListener("input", () => { state.result = state.result; }));

  // default date = today
  (function initDate() {
    const d = new Date();
    $("runDate").value = d.toISOString().slice(0, 10);
  })();

  // ----- search (Nominatim) -----
  const results = $("searchResults");
  $("searchForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const q = $("searchInput").value.trim();
    if (!q) return;
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=6&q=${encodeURIComponent(q)}`;
      const res = await fetch(url, { headers: { "Accept-Language": "en" } });
      const data = await res.json();
      results.innerHTML = "";
      if (!data.length) { toast("No matches found."); return; }
      data.forEach((r) => {
        const li = document.createElement("li");
        li.textContent = r.display_name;
        li.addEventListener("click", () => {
          map.setView([+r.lat, +r.lon], 15);
          results.classList.remove("open");
          $("searchInput").value = r.display_name.split(",")[0];
        });
        results.appendChild(li);
      });
      results.classList.add("open");
    } catch (err) {
      toast("Search unavailable (network blocked).");
    }
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-box")) results.classList.remove("open");
  });

  // ===================== RECOMPUTE / RENDER =====================
  function paceFactor() { return $("paceUnit").value === "min/mi" ? 1.60934 : 1; }

  function fmtDuration(sec) {
    sec = Math.round(sec);
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  function fmtPace(secPerKm) {
    const secPerUnit = secPerKm * paceFactor();
    const m = Math.floor(secPerUnit / 60);
    const s = Math.round(secPerUnit % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function startEpoch() {
    const date = $("runDate").value || new Date().toISOString().slice(0, 10);
    const time = $("runTime").value || "12:00";
    return new Date(`${date}T${time}:00`).getTime() / 1000;
  }

  function recompute() {
    const path = state.drawnPath;
    if (path.length < 2) {
      $("statDistance").textContent = "0.00 km";
      $("statDuration").textContent = "00:00:00";
      $("statElevation").textContent = "0 m";
      $("statPace").textContent = "0.00";
      $("downloadBtn").disabled = true;
      state.result = null;
      Charts.clear($("paceChart")); Charts.clear($("elevChart")); Charts.clear($("hrChart"));
      return;
    }

    const unit = $("paceUnit").value;
    // avgPace slider is expressed in the chosen unit -> convert to sec/km
    const avgPaceSecPerKm = (parseFloat($("avgPace").value) * 60) / paceFactor();

    const opts = {
      avgPaceSecPerKm,
      paceVarPct: +$("paceVar").value,
      includeHR: $("includeHR").checked,
      avgHR: +$("avgHR").value,
      hrVarPct: +$("hrVar").value,
      elevGain: +$("elevGain").value,
      startEpoch: startEpoch(),
      seed: state.seed,
    };

    const result = Profiles.synthesize(path, opts);
    state.result = result;
    if (!result) return;

    const km = result.totalM / 1000;
    $("statDistance").textContent = km.toFixed(2) + " km";
    $("statDuration").textContent = fmtDuration(result.durationSec);
    $("statElevation").textContent = result.elevGain + " m";
    $("statPace").textContent = fmtPace(result.avgPaceSecPerKm);
    $("statPaceUnit").textContent = unit;
    $("downloadBtn").disabled = false;

    renderCharts(result, unit);
  }

  function renderCharts(result, unit) {
    const s = result.samples;
    const xs = s.map((p) => p.dist);

    // Pace (min per unit) — invert so the chart reads like the real site
    const paceVals = s.map((p) => (p.paceSecPerKm * paceFactor()) / 60);
    const avgPace = (result.avgPaceSecPerKm * paceFactor()) / 60;
    $("paceAvgLabel").textContent = `Average: ${avgPace.toFixed(2)} ${unit}`;
    Charts.draw($("paceChart"), xs, paceVals, {
      color: "#fc4c02", avg: avgPace, yFmt: (v) => v.toFixed(1),
    });

    // Elevation
    const eleVals = s.map((p) => p.ele);
    $("elevTotalLabel").textContent = `Total Gain: ${result.elevGain} m`;
    Charts.draw($("elevChart"), xs, eleVals, {
      color: "#2ea043", yMin: 0, yFmt: (v) => v.toFixed(0),
    });

    // Heart rate
    if ($("includeHR").checked) {
      const hrVals = s.map((p) => p.hr);
      const avgHR = Math.round(hrVals.reduce((a, b) => a + b, 0) / hrVals.length);
      $("hrAvgLabel").textContent = `Average: ${avgHR} bpm`;
      Charts.draw($("hrChart"), xs, hrVals, {
        color: "#f85149", avg: avgHR, yMin: 0, yFmt: (v) => v.toFixed(0),
      });
    }
  }

  // ----- download -----
  $("downloadBtn").addEventListener("click", () => {
    if (!state.result) return;
    const meta = {
      name: $("runName").value.trim() || (state.activity === "bike" ? "Bike Ride" : "Run"),
      desc: $("runDesc").value.trim(),
      activity: state.activity,
      includeHR: $("includeHR").checked,
    };
    const xml = GPX.build(state.result, meta);
    const safe = meta.name.replace(/[^\w-]+/g, "_").toLowerCase();
    GPX.download(xml, `${safe || "route"}.gpx`);
    toast("GPX file downloaded ✓");
  });

  // redraw charts on resize
  let rt;
  window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(recompute, 150); });

  // initial empty render
  recompute();
})();
