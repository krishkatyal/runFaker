/* geo.js — geographic math, route resampling, and shape generators */
(function (global) {
  const R = 6371000; // earth radius (m)
  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;

  // Great-circle distance in metres between two [lat, lng] points.
  function haversine(a, b) {
    const dLat = toRad(b[0] - a[0]);
    const dLng = toRad(b[1] - a[1]);
    const lat1 = toRad(a[0]);
    const lat2 = toRad(b[0]);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  // Total length (m) of a polyline of [lat,lng] points.
  function pathLength(pts) {
    let d = 0;
    for (let i = 1; i < pts.length; i++) d += haversine(pts[i - 1], pts[i]);
    return d;
  }

  // Linearly interpolate between two lat/lng points (good enough at run scale).
  function lerp(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  }

  // Resample a polyline into `n` points evenly spaced by arc length.
  // Returns array of {lat, lng, dist} where dist is cumulative metres.
  function resample(pts, n) {
    if (pts.length < 2 || n < 2) {
      return pts.map((p, i) => ({ lat: p[0], lng: p[1], dist: i === 0 ? 0 : pathLength(pts.slice(0, i + 1)) }));
    }
    // cumulative distances
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + haversine(pts[i - 1], pts[i]));
    const total = cum[cum.length - 1];
    const step = total / (n - 1);
    const out = [];
    let seg = 1;
    for (let i = 0; i < n; i++) {
      const target = i * step;
      while (seg < pts.length - 1 && cum[seg] < target) seg++;
      const segStart = cum[seg - 1];
      const segLen = cum[seg] - segStart || 1;
      const t = Math.min(1, Math.max(0, (target - segStart) / segLen));
      const p = lerp(pts[seg - 1], pts[seg], t);
      out.push({ lat: p[0], lng: p[1], dist: target });
    }
    return out;
  }

  // metres -> degrees latitude (approx)
  function mToLat(m) { return toDeg(m / R); }
  function mToLng(m, lat) { return toDeg(m / (R * Math.cos(toRad(lat)))); }

  // Generate a circle of `radius` metres around a centre [lat,lng].
  function circle(center, radiusM, steps = 64) {
    const out = [];
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * 2 * Math.PI;
      const dy = radiusM * Math.cos(a);
      const dx = radiusM * Math.sin(a);
      out.push([center[0] + mToLat(dy), center[1] + mToLng(dx, center[0])]);
    }
    return out;
  }

  // Generate a heart shape centred on [lat,lng], scaled so its width ~= size metres.
  function heart(center, sizeM, steps = 120) {
    const out = [];
    const scale = sizeM / 34; // parametric heart spans ~34 units wide
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * 2 * Math.PI;
      const x = 16 * Math.sin(t) ** 3;
      const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
      out.push([center[0] + mToLat(y * scale), center[1] + mToLng(x * scale, center[0])]);
    }
    return out;
  }

  global.Geo = { haversine, pathLength, resample, circle, heart, mToLat, mToLng };
})(window);
