/* charts.js — lightweight canvas line charts for the profile panels */
(function (global) {
  function draw(canvas, xs, ys, opts) {
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth || 300;
    const cssH = canvas.height; // height attr is the CSS height here
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, cssW, cssH);

    const padL = 38, padR = 8, padT = 10, padB = 22;
    const w = cssW - padL - padR;
    const h = cssH - padT - padB;
    if (!xs.length) return;

    const xMin = xs[0], xMax = xs[xs.length - 1] || 1;
    let yMin = Math.min(...ys), yMax = Math.max(...ys);
    if (opts.yMin != null) yMin = Math.min(yMin, opts.yMin);
    if (opts.yMax != null) yMax = Math.max(yMax, opts.yMax);
    if (yMin === yMax) { yMin -= 1; yMax += 1; }
    const pad = (yMax - yMin) * 0.1;
    yMin -= pad; yMax += pad;

    const X = (v) => padL + ((v - xMin) / (xMax - xMin || 1)) * w;
    const Y = (v) => padT + h - ((v - yMin) / (yMax - yMin || 1)) * h;

    // grid + y labels
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.fillStyle = "#8b949e";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "right";
    const ticks = 4;
    for (let i = 0; i <= ticks; i++) {
      const yv = yMin + (i / ticks) * (yMax - yMin);
      const py = Y(yv);
      ctx.beginPath(); ctx.moveTo(padL, py); ctx.lineTo(padL + w, py); ctx.stroke();
      ctx.fillText(opts.yFmt ? opts.yFmt(yv) : yv.toFixed(0), padL - 5, py + 3);
    }

    // x labels (km)
    ctx.textAlign = "center";
    for (let i = 0; i <= 4; i++) {
      const xv = xMin + (i / 4) * (xMax - xMin);
      ctx.fillText((xv / 1000).toFixed(2), X(xv), cssH - 6);
    }

    // area fill
    const grad = ctx.createLinearGradient(0, padT, 0, padT + h);
    grad.addColorStop(0, opts.color + "55");
    grad.addColorStop(1, opts.color + "00");
    ctx.beginPath();
    ctx.moveTo(X(xs[0]), Y(ys[0]));
    for (let i = 1; i < xs.length; i++) ctx.lineTo(X(xs[i]), Y(ys[i]));
    ctx.lineTo(X(xs[xs.length - 1]), padT + h);
    ctx.lineTo(X(xs[0]), padT + h);
    ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();

    // line
    ctx.beginPath();
    ctx.moveTo(X(xs[0]), Y(ys[0]));
    for (let i = 1; i < xs.length; i++) ctx.lineTo(X(xs[i]), Y(ys[i]));
    ctx.strokeStyle = opts.color; ctx.lineWidth = 1.8; ctx.stroke();

    // average line
    if (opts.avg != null) {
      const py = Y(opts.avg);
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = opts.color + "aa";
      ctx.beginPath(); ctx.moveTo(padL, py); ctx.lineTo(padL + w, py); ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  function clear(canvas) {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  global.Charts = { draw, clear };
})(window);
