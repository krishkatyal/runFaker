/* gpx.js — build a Garmin/Strava-compatible GPX 1.1 track from samples */
(function (global) {
  function iso(epochSec) {
    return new Date(epochSec * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");
  }
  function esc(s) {
    return String(s).replace(/[<>&'"]/g, (c) =>
      ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]));
  }

  // result: output of Profiles.synthesize; meta: {name, desc, activity, includeHR}
  function build(result, meta) {
    const { samples } = result;
    const type = meta.activity === "bike" ? "cycling" : "running";
    const lines = [];
    lines.push('<?xml version="1.0" encoding="UTF-8"?>');
    lines.push(
      '<gpx version="1.1" creator="RunFaker" ' +
      'xmlns="http://www.topografix.com/GPX/1/1" ' +
      'xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1" ' +
      'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ' +
      'xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">'
    );
    lines.push("  <metadata>");
    lines.push("    <name>" + esc(meta.name || "Untitled Route") + "</name>");
    if (meta.desc) lines.push("    <desc>" + esc(meta.desc) + "</desc>");
    lines.push("    <time>" + iso(samples[0].time) + "</time>");
    lines.push("  </metadata>");
    lines.push("  <trk>");
    lines.push("    <name>" + esc(meta.name || "Untitled Route") + "</name>");
    lines.push("    <type>" + type + "</type>");
    lines.push("    <trkseg>");

    for (const s of samples) {
      lines.push('      <trkpt lat="' + s.lat.toFixed(6) + '" lon="' + s.lng.toFixed(6) + '">');
      lines.push("        <ele>" + s.ele.toFixed(1) + "</ele>");
      lines.push("        <time>" + iso(s.time) + "</time>");
      if (meta.includeHR && s.hr != null) {
        lines.push("        <extensions><gpxtpx:TrackPointExtension>" +
          "<gpxtpx:hr>" + s.hr + "</gpxtpx:hr>" +
          "</gpxtpx:TrackPointExtension></extensions>");
      }
      lines.push("      </trkpt>");
    }

    lines.push("    </trkseg>");
    lines.push("  </trk>");
    lines.push("</gpx>");
    return lines.join("\n");
  }

  function download(xml, filename) {
    const blob = new Blob([xml], { type: "application/gpx+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  global.GPX = { build, download };
})(window);
