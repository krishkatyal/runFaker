/* profiles.js — synthesize realistic pace / heart-rate / elevation profiles
   along a resampled route, and integrate time from pace. */
(function (global) {
  // Deterministic pseudo-random generator (mulberry32) so a given route +
  // settings always produces the same file until inputs change.
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Smooth multi-octave noise in [-1, 1] over normalised position p in [0,1].
  function smoothNoise(p, rand, octaves = 4) {
    let v = 0, amp = 1, freq = 1, norm = 0;
    for (let o = 0; o < octaves; o++) {
      const phase = rand() * Math.PI * 2;
      v += amp * Math.sin(p * Math.PI * 2 * freq + phase);
      norm += amp;
      amp *= 0.55; freq *= 2.1;
    }
    return v / norm;
  }

  // Build an elevation series (metres) that achieves ~targetGain of cumulative
  // positive ascent over the route.
  function buildElevation(samples, targetGain, seed) {
    const rand = rng(seed + 99);
    const n = samples.length;
    const raw = [];
    for (let i = 0; i < n; i++) {
      const p = samples[i].dist / (samples[n - 1].dist || 1);
      raw.push(smoothNoise(p, rand, 5));
    }
    // measure raw positive gain
    let rawGain = 0;
    for (let i = 1; i < n; i++) rawGain += Math.max(0, raw[i] - raw[i - 1]);
    const scale = rawGain > 0 ? targetGain / rawGain : 0;
    const base = 40 + rand() * 60; // arbitrary starting altitude
    return raw.map((v) => base + v * scale); // positive gain now ~= targetGain
  }

  // Main: produce per-point samples with lat/lng/dist/ele/hr/paceSecPerKm/time.
  // opts: { avgPaceSecPerKm, paceVarPct, includeHR, avgHR, hrVarPct, elevGain,
  //         startEpoch (s), seed }
  function synthesize(routePts, opts) {
    const totalM = global.Geo.pathLength(routePts);
    if (totalM < 1) return null;
    // choose sample count: ~1 point / 12 m, clamped 30..3000
    const n = Math.min(3000, Math.max(30, Math.round(totalM / 12)));
    const samples = global.Geo.resample(routePts, n);

    const rand = rng((opts.seed || 1) + 7);
    const paceVar = opts.paceVarPct / 100;
    const ele = buildElevation(samples, opts.elevGain, opts.seed || 1);

    // ---- pass 1: pace (grade-aware) + heart rate ----
    let prevEle = ele[0];
    for (let i = 0; i < n; i++) {
      const p = samples[i].dist / totalM;
      const noise = smoothNoise(p, rand, 4);

      // grade in % over the last segment, biases pace (uphill slower)
      let grade = 0;
      if (i > 0) {
        const dM = samples[i].dist - samples[i - 1].dist || 1;
        grade = ((ele[i] - prevEle) / dM) * 100;
      }
      const gradeFactor = 1 + Math.max(-0.25, Math.min(0.5, grade * 0.035));

      let paceSec = opts.avgPaceSecPerKm * (1 + paceVar * noise) * gradeFactor;
      paceSec = Math.max(120, paceSec); // floor at 2:00/km

      samples[i].ele = +ele[i].toFixed(1);
      samples[i].paceSecPerKm = paceSec;

      if (opts.includeHR) {
        // HR drifts up over the run + responds to grade + noise.
        const drift = 1 + 0.05 * p;
        const hrNoise = smoothNoise(p + 0.3, rand, 3);
        const hr = opts.avgHR * drift * (1 + (opts.hrVarPct / 100) * hrNoise)
                   + Math.max(0, grade) * 0.8;
        samples[i].hr = Math.round(Math.max(60, Math.min(210, hr)));
      }
      prevEle = ele[i];
    }

    // normalise pace so the distance-weighted average matches the target,
    // preserving the variation/grade shape (keeps the displayed avg pace honest)
    let wSum = 0, pwSum = 0;
    for (let i = 1; i < n; i++) {
      const dM = samples[i].dist - samples[i - 1].dist;
      const segPace = (samples[i].paceSecPerKm + samples[i - 1].paceSecPerKm) / 2;
      wSum += dM; pwSum += dM * segPace;
    }
    const realisedAvg = wSum > 0 ? pwSum / wSum : opts.avgPaceSecPerKm;
    const paceScale = realisedAvg > 0 ? opts.avgPaceSecPerKm / realisedAvg : 1;
    for (let i = 0; i < n; i++) {
      samples[i].paceSecPerKm = Math.max(120, samples[i].paceSecPerKm * paceScale);
    }

    // ---- pass 2: integrate time from normalised pace ----
    let t = opts.startEpoch; // seconds
    samples[0].time = t;
    for (let i = 1; i < n; i++) {
      const dM = samples[i].dist - samples[i - 1].dist;
      const segPace = (samples[i].paceSecPerKm + samples[i - 1].paceSecPerKm) / 2;
      t += (dM / 1000) * segPace;
      samples[i].time = t;
    }

    // re-centre HR so the realised average matches the requested avg
    if (opts.includeHR) {
      const mean = samples.reduce((s, x) => s + x.hr, 0) / n;
      const adj = opts.avgHR - mean;
      samples.forEach((x) => { x.hr = Math.round(Math.max(60, Math.min(210, x.hr + adj))); });
    }

    const duration = samples[n - 1].time - opts.startEpoch;
    let gain = 0;
    for (let i = 1; i < n; i++) gain += Math.max(0, samples[i].ele - samples[i - 1].ele);

    return {
      samples,
      totalM,
      durationSec: duration,
      elevGain: Math.round(gain),
      avgPaceSecPerKm: (duration / (totalM / 1000)),
    };
  }

  global.Profiles = { synthesize };
})(window);
