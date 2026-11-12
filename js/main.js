/* flowy_state · a quiet grove */
(function () {
  "use strict";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var DPR = Math.min(window.devicePixelRatio || 1, 2);

  /* seeded random so the grove keeps its shape between visits */
  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  var PALETTE = [
    [168, 232, 185], [168, 232, 185], [168, 232, 185], [168, 232, 185],
    [236, 230, 216], [236, 230, 216], [201, 238, 122], [243, 201, 207]
  ];

  function buildNodes(w, h, count, rand, keepOut) {
    var nodes = [], tries = 0, minD = Math.sqrt((w * h) / count) * 0.62;
    while (nodes.length < count && tries < count * 60) {
      tries++;
      var x = 0.04 * w + rand() * 0.92 * w, y = 0.06 * h + rand() * 0.88 * h;
      if (keepOut && keepOut(x, y)) continue;
      var ok = true;
      for (var i = 0; i < nodes.length; i++) {
        var dx = nodes[i].bx - x, dy = nodes[i].by - y;
        if (dx * dx + dy * dy < minD * minD) { ok = false; break; }
      }
      if (!ok) continue;
      nodes.push({
        bx: x, by: y, x: x, y: y,
        r: 1 + rand() * 1.6,
        c: PALETTE[Math.floor(rand() * PALETTE.length)],
        ph: rand() * Math.PI * 2, sp: 0.00012 + rand() * 0.00018,
        amp: 6 + rand() * 14, tw: rand() * Math.PI * 2
      });
    }
    return nodes;
  }
  function buildEdges(nodes, k, maxD) {
    var edges = [], seen = {};
    nodes.forEach(function (a, i) {
      var near = nodes.map(function (b, j) {
        var dx = a.bx - b.bx, dy = a.by - b.by;
        return { j: j, d: Math.sqrt(dx * dx + dy * dy) };
      }).filter(function (o) { return o.j !== i && o.d < maxD; })
        .sort(function (p, q) { return p.d - q.d; }).slice(0, k);
      near.forEach(function (o) {
        var key = i < o.j ? i + "-" + o.j : o.j + "-" + i;
        if (!seen[key]) { seen[key] = 1; edges.push({ a: i, b: o.j, d: o.d, ph: Math.random() * 6.28 }); }
      });
    });
    return edges;
  }

  function step(n, t) {
    n.x = n.bx + Math.cos(t * n.sp + n.ph) * n.amp;
    n.y = n.by + Math.sin(t * n.sp * 1.3 + n.ph) * n.amp * 0.7;
  }

  /* ---------- hero grove ---------- */
  var cv = document.getElementById("grove");
  if (cv && cv.getContext) {
    var ctx = cv.getContext("2d"), W = 0, H = 0, nodes = [], edges = [], me = null;
    var running = false, visible = true, raf = 0, pointer = { x: -9999, y: -9999 };
    var pulses = [];

    function layout() {
      var r = cv.getBoundingClientRect();
      W = r.width; H = r.height;
      cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      var mobile = W < 600;
      var count = Math.max(22, Math.min(64, Math.round((W * H) / (mobile ? 16000 : 26000))));
      var rand = rng(24);
      nodes = buildNodes(W, H, count, rand);
      /* node #024 — flowy_state */
      var mx = mobile ? W * 0.84 : W * 0.72, my = mobile ? 122 : H * 0.42;
      nodes = nodes.filter(function (n) { return Math.hypot(n.bx - mx, n.by - my) > 70; });
      me = { bx: mx, by: my, x: mx, y: my, r: 3.2, c: [243, 201, 207], ph: 1, sp: 0.00015, amp: 6, tw: 0, me: true };
      nodes.push(me);
      edges = buildEdges(nodes, mobile ? 2 : 3, Math.max(W, H) * (mobile ? 0.3 : 0.2));
      pulses = [];
      if (!running) draw(performance.now());
    }

    function draw(t) {
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < nodes.length; i++) step(nodes[i], reduce ? 0 : t);
      ctx.lineWidth = 0.7;
      for (var e = 0; e < edges.length; e++) {
        var E = edges[e], a = nodes[E.a], b = nodes[E.b];
        var breathe = reduce ? 0.6 : 0.5 + 0.5 * Math.sin(t * 0.0004 + E.ph);
        var al = 0.07 + 0.12 * breathe;
        if (a.me || b.me) al += 0.12;
        ctx.strokeStyle = "rgba(168,232,185," + al.toFixed(3) + ")";
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      /* travelling light along an edge, rarely */
      if (!reduce && Math.random() < 0.012 && pulses.length < 3 && edges.length) {
        pulses.push({ e: edges[Math.floor(Math.random() * edges.length)], t0: t, dur: 2600 + Math.random() * 1800 });
      }
      pulses = pulses.filter(function (p) {
        var k = (t - p.t0) / p.dur; if (k >= 1) return false;
        var a = nodes[p.e.a], b = nodes[p.e.b];
        var x = a.x + (b.x - a.x) * k, y = a.y + (b.y - a.y) * k;
        var g = ctx.createRadialGradient(x, y, 0, x, y, 10);
        var al = Math.sin(k * Math.PI) * 0.55;
        g.addColorStop(0, "rgba(220,250,225," + al + ")"); g.addColorStop(1, "rgba(168,232,185,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 10, 0, 6.283); ctx.fill();
        return true;
      });
      for (var j = 0; j < nodes.length; j++) {
        var n = nodes[j];
        var tw = reduce ? 0.8 : 0.6 + 0.4 * Math.sin(t * 0.0009 + n.tw);
        var dp = Math.hypot(n.x - pointer.x, n.y - pointer.y);
        var near = dp < 140 ? (1 - dp / 140) * 0.5 : 0;
        var rr = n.r * (n.me ? 1 : 1 + near);
        var halo = rr * (n.me ? 9 : 6);
        var g2 = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, halo);
        g2.addColorStop(0, "rgba(" + n.c + "," + (0.28 * tw + near * 0.3).toFixed(3) + ")");
        g2.addColorStop(1, "rgba(" + n.c + ",0)");
        ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(n.x, n.y, halo, 0, 6.283); ctx.fill();
        ctx.fillStyle = "rgba(" + n.c + "," + Math.min(1, 0.55 + 0.45 * tw + near).toFixed(3) + ")";
        ctx.beginPath(); ctx.arc(n.x, n.y, rr, 0, 6.283); ctx.fill();
      }
      if (me) {
        var showLabel = W >= 600;
        var ring = reduce ? 0.5 : (t * 0.00025) % 1;
        ctx.strokeStyle = "rgba(243,201,207," + (0.45 * (1 - ring)).toFixed(3) + ")";
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(me.x, me.y, 6 + ring * 22, 0, 6.283); ctx.stroke();
        if (showLabel) {
        ctx.font = "500 11px 'Plex Mono', ui-monospace, monospace";
        ctx.fillStyle = "rgba(236,230,216,.78)";
        var label = "#024  flowy_state";
        var tx = me.x + 14, tw2 = ctx.measureText(label).width;
        if (tx + tw2 > W - 12) tx = me.x - 14 - tw2;
        ctx.fillText(label, tx, me.y + 4);
        }
      }
    }

    function loop(t) {
      if (!running) return;
      draw(t);
      raf = requestAnimationFrame(loop);
    }
    function setRun() {
      var should = !reduce && visible && !document.hidden;
      if (should && !running) { running = true; raf = requestAnimationFrame(loop); }
      else if (!should && running) { running = false; cancelAnimationFrame(raf); }
    }
    var rt; window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(layout, 160); });
    document.addEventListener("visibilitychange", setRun);
    cv.parentElement.addEventListener("pointermove", function (ev) {
      var r = cv.getBoundingClientRect(); pointer.x = ev.clientX - r.left; pointer.y = ev.clientY - r.top;
    });
    cv.parentElement.addEventListener("pointerleave", function () { pointer.x = pointer.y = -9999; });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (en) { visible = en[0].isIntersecting; setRun(); }).observe(cv);
    }
    layout();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (!running) draw(performance.now()); });
    setRun();
  }

  /* ---------- header ---------- */
  var top = document.querySelector(".top");
  function onScroll() { top.classList.toggle("is-scrolled", window.scrollY > 40); }
  window.addEventListener("scroll", onScroll, { passive: true }); onScroll();

  /* ---------- reveal ---------- */
  var rev = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && !reduce) {
    var io = new IntersectionObserver(function (en) {
      en.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add("is-in"); io.unobserve(x.target); } });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    rev.forEach(function (el) { io.observe(el); });
  } else rev.forEach(function (el) { el.classList.add("is-in"); });

  /* ---------- felt video ---------- */
  var vid = document.getElementById("bedsVideo"), vbtn = document.getElementById("bedsVideoBtn");
  if (vid && vbtn) {
    var txt = vbtn.querySelector(".video__txt"), userPaused = false;
    function sync() {
      var playing = !vid.paused;
      vbtn.setAttribute("aria-pressed", playing ? "true" : "false");
      txt.textContent = playing ? "Pause" : "Play the video";
    }
    vbtn.addEventListener("click", function () {
      if (vid.paused) { userPaused = false; vid.play().catch(function () {}); }
      else { userPaused = true; vid.pause(); }
    });
    vid.addEventListener("play", sync); vid.addEventListener("pause", sync);
    /* gentle autoplay only when in view, and never when motion is reduced */
    if (!reduce && "IntersectionObserver" in window) {
      new IntersectionObserver(function (en) {
        if (en[0].isIntersecting) { if (!userPaused) vid.play().catch(function () {}); }
        else if (!vid.paused) vid.pause();
      }, { threshold: 0.5 }).observe(vid);
    }
    sync();
  }

  /* ---------- try: walk into the grove ---------- */
  var tc = document.getElementById("tryCanvas"), form = document.getElementById("tryForm"), out = document.getElementById("tryReadout");
  if (tc && form) {
    var c2 = tc.getContext("2d"), w2 = 0, h2 = 0, tn = [], te = [], born = [], tRaf = 0, tRun = false, tVis = false;
    function tLayout() {
      var r = tc.getBoundingClientRect(); w2 = r.width; h2 = r.height;
      tc.width = Math.round(w2 * DPR); tc.height = Math.round(h2 * DPR);
      c2.setTransform(DPR, 0, 0, DPR, 0, 0);
      var guests = tn.filter(function (n) { return n.guest; });
      tn = buildNodes(w2, h2 * 0.9, Math.max(10, Math.round((w2 * h2) / 9000)), rng(7));
      guests.forEach(function (g) { g.bx = g.fx * w2; g.by = g.fy * h2 * 0.9; tn.push(g); });
      te = buildEdges(tn, 2, Math.max(w2, h2) * 0.4).map(function (e) { e.k = 1; return e; });
      guests.forEach(function (g) { connect(g, false); });
      if (!tRun) tDraw(performance.now());
    }
    function connect(g, animate) {
      var gi = tn.indexOf(g);
      tn.map(function (n, j) { return { j: j, d: Math.hypot(n.bx - g.bx, n.by - g.by) }; })
        .filter(function (o) { return o.j !== gi; }).sort(function (a, b) { return a.d - b.d; }).slice(0, 3)
        .forEach(function (o) { te.push({ a: gi, b: o.j, d: o.d, ph: 0, k: animate ? 0 : 1, glow: true }); });
    }
    function tDraw(t) {
      c2.clearRect(0, 0, w2, h2);
      tn.forEach(function (n) { step(n, reduce ? 0 : t); n.y += h2 * 0.03; });
      var busy = false;
      te.forEach(function (e) {
        if (e.k < 1) { e.k = Math.min(1, e.k + 0.012); busy = true; }
        var a = tn[e.a], b = tn[e.b];
        c2.strokeStyle = e.glow ? "rgba(243,201,207,.55)" : "rgba(168,232,185,.2)";
        c2.lineWidth = e.glow ? 1 : 0.7;
        c2.beginPath(); c2.moveTo(a.x, a.y); c2.lineTo(a.x + (b.x - a.x) * e.k, a.y + (b.y - a.y) * e.k); c2.stroke();
      });
      tn.forEach(function (n) {
        var col = n.guest ? [243, 201, 207] : n.c, rr = n.guest ? 3.4 : n.r;
        var g = c2.createRadialGradient(n.x, n.y, 0, n.x, n.y, rr * 7);
        g.addColorStop(0, "rgba(" + col + "," + (n.guest ? 0.45 : 0.22) + ")"); g.addColorStop(1, "rgba(" + col + ",0)");
        c2.fillStyle = g; c2.beginPath(); c2.arc(n.x, n.y, rr * 7, 0, 6.283); c2.fill();
        c2.fillStyle = "rgba(" + col + ",.95)"; c2.beginPath(); c2.arc(n.x, n.y, rr, 0, 6.283); c2.fill();
      });
      return busy;
    }
    function tLoop(t) { if (!tRun) return; tDraw(t); tRaf = requestAnimationFrame(tLoop); }
    function tSet() {
      var should = tVis && !document.hidden && !reduce;
      if (should && !tRun) { tRun = true; tRaf = requestAnimationFrame(tLoop); }
      else if (!should && tRun) { tRun = false; cancelAnimationFrame(tRaf); }
    }
    if ("IntersectionObserver" in window) new IntersectionObserver(function (en) { tVis = en[0].isIntersecting; tSet(); }).observe(tc);
    document.addEventListener("visibilitychange", tSet);
    var rt2; window.addEventListener("resize", function () { clearTimeout(rt2); rt2 = setTimeout(tLayout, 160); });

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var seek = form.seek.value.trim() || form.seek.placeholder;
      var offer = form.offer.value.trim() || form.offer.placeholder;
      var rand = Math.random, best = null, bestD = -1;
      for (var i = 0; i < 40; i++) {
        var x = 0.12 * w2 + rand() * 0.76 * w2, y = 0.12 * h2 + rand() * 0.7 * h2, md = 1e9;
        tn.forEach(function (n) { md = Math.min(md, Math.hypot(n.bx - x, n.by - y)); });
        if (md > bestD) { bestD = md; best = [x, y]; }
      }
      var g = { bx: best[0], by: best[1], x: best[0], y: best[1], fx: best[0] / w2, fy: best[1] / (h2 * 0.9), r: 3.4, c: [243, 201, 207], ph: rand() * 6, sp: 0.00015, amp: 4, tw: 0, guest: true };
      tn.push(g); connect(g, !reduce);
      out.textContent = "Your light: I seek " + seek + " · I offer " + offer;
      form.reset();
      if (reduce) tDraw(0);
    });
    tLayout();
  }
})();
