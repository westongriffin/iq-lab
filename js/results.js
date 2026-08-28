/* IQ Lab — results page: score display, bell-curve visualization, domain
   breakdown, share / download, and result history. */

(() => {
  const el = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const result = params.get("id") ? IQStore.getResult(params.get("id")) : IQStore.latestResult();
  const D = IQItems.DOMAINS;

  const root = el("results-root");
  if (!result) {
    root.innerHTML = `
      <div class="q-card screen-center" style="max-width:640px;margin:40px auto">
        <div class="big-icon">📊</div>
        <h2>No results yet</h2>
        <p>Take a test and your results will appear here. They stay in this browser — no account needed.</p>
        <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
          <a class="btn big" href="test.html?mode=short">Take the quick test</a>
          <a class="btn ghost big" href="test.html?mode=long">Take the full test</a>
        </div>
      </div>`;
    renderHistory();
    return;
  }

  // ---------- hero ----------
  const dateStr = new Date(result.date).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  const modeLabel = result.mode === "long" ? "Full Assessment (40 items)" : "Quick Assessment (16 items)";
  const mins = Math.round(result.durationSec / 60);
  el("hero").innerHTML = `
    <p class="muted" style="margin-bottom:4px">${result.name ? `${escapeHtml(result.name)} · ` : ""}${modeLabel} · ${dateStr} · ${mins} min</p>
    <div class="iq-score">${result.iq}</div>
    <div class="iq-band"><strong>${result.band}</strong> range · higher than ${result.pct}% of the population</div>
    <div class="iq-ci">90% confidence interval: ${result.iq - result.ci90}–${result.iq + result.ci90} ·
      ${result.raw}/${result.total} items correct</div>`;

  // ---------- bell curve ----------
  function bellSvg(iq) {
    const W = 640, H = 240, PAD = 34, BASE = H - 36;
    const xOf = (v) => PAD + ((v - 40) / (160 - 40)) * (W - 2 * PAD);
    const pdf = (v) => Math.exp(-0.5 * Math.pow((v - 100) / 15, 2));
    const yOf = (v) => BASE - pdf(v) * (BASE - 26);
    let curve = "", fill = `M ${xOf(40)} ${BASE} `;
    for (let v = 40; v <= 160; v += 1) {
      const cmd = v === 40 ? "M" : "L";
      curve += `${cmd} ${xOf(v).toFixed(1)} ${yOf(v).toFixed(1)} `;
    }
    for (let v = 40; v <= Math.min(iq, 160); v += 1) fill += `L ${xOf(v).toFixed(1)} ${yOf(v).toFixed(1)} `;
    fill += `L ${xOf(Math.min(iq, 160)).toFixed(1)} ${BASE} Z`;
    const ticks = [55, 70, 85, 100, 115, 130, 145]
      .map((v) => `<line x1="${xOf(v)}" y1="${BASE}" x2="${xOf(v)}" y2="${BASE + 5}" stroke="var(--baseline)" stroke-width="1.5"/>
        <text x="${xOf(v)}" y="${BASE + 20}" text-anchor="middle" font-size="12" fill="var(--ink-3)" font-family="system-ui" style="font-variant-numeric:tabular-nums">${v}</text>`)
      .join("");
    const mx = xOf(Math.min(Math.max(iq, 40), 160));
    return `
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Normal distribution of IQ scores with your score marked" style="width:100%;height:auto" id="bell-svg">
        <line x1="${PAD}" y1="${BASE}" x2="${W - PAD}" y2="${BASE}" stroke="var(--baseline)" stroke-width="1.5"/>
        ${ticks}
        <path d="${fill}" fill="var(--series-1)" opacity="0.18"/>
        <path d="${curve}" fill="none" stroke="var(--series-1)" stroke-width="2"/>
        <line x1="${mx}" y1="${yOf(Math.min(Math.max(iq, 40), 160)) - 8}" x2="${mx}" y2="${BASE}" stroke="var(--series-2)" stroke-width="2" stroke-dasharray="4 3"/>
        <circle cx="${mx}" cy="${yOf(Math.min(Math.max(iq, 40), 160))}" r="5" fill="var(--series-2)" stroke="var(--surface)" stroke-width="2"/>
        <text x="${mx}" y="${Math.max(yOf(Math.min(Math.max(iq, 40), 160)) - 16, 14)}" text-anchor="middle" font-size="13" font-weight="700" fill="var(--ink)" font-family="system-ui">You · ${iq}</text>
        <g id="bell-hover" style="display:none">
          <line id="bh-line" y1="26" y2="${BASE}" stroke="var(--ink-3)" stroke-width="1" stroke-dasharray="2 3"/>
          <rect id="bh-box" width="120" height="22" rx="5" fill="var(--card)" stroke="var(--border)"/>
          <text id="bh-text" font-size="11.5" fill="var(--ink-2)" font-family="system-ui" text-anchor="middle"></text>
        </g>
        <rect x="${PAD}" y="20" width="${W - 2 * PAD}" height="${BASE - 20}" fill="transparent" id="bell-hit"/>
      </svg>`;
  }
  el("bell-wrap").innerHTML = bellSvg(result.iq);

  // hover readout on the curve
  {
    const svg = el("bell-svg"), hit = el("bell-hit"), g = el("bell-hover");
    const line = el("bh-line"), box = el("bh-box"), text = el("bh-text");
    const W = 640, PAD = 34;
    hit.addEventListener("mousemove", (e) => {
      const r = svg.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * W;
      const v = Math.round(40 + ((x - PAD) / (W - 2 * PAD)) * 120);
      if (v < 40 || v > 160) { g.style.display = "none"; return; }
      const pct = (IQScore.phi((v - 100) / 15) * 100).toFixed(1);
      g.style.display = "";
      line.setAttribute("x1", x); line.setAttribute("x2", x);
      const bx = Math.min(Math.max(x - 60, 4), W - 124);
      box.setAttribute("x", bx); box.setAttribute("y", 26);
      text.setAttribute("x", bx + 60); text.setAttribute("y", 41);
      text.textContent = `IQ ${v} · ${pct}th percentile`;
    });
    hit.addEventListener("mouseleave", () => { g.style.display = "none"; });
  }

  // ---------- domain bars ----------
  el("domain-bars").innerHTML = Object.entries(result.domains)
    .map(([k, d]) => {
      const pc = Math.round((d.correct / d.total) * 100);
      return `<div class="domain-row">
        <span class="lbl">${D[k]?.label || k}</span>
        <div class="domain-track"><div class="domain-fill" style="width:${pc}%"></div></div>
        <span class="val">${d.correct}/${d.total}</span>
      </div>`;
    })
    .join("");

  // ---------- interpretation ----------
  const rarity = IQScore.rarity(result.iq);
  el("interpret").innerHTML = `
    <p>A score of <strong>${result.iq}</strong> falls in the <strong>${result.band.toLowerCase()}</strong> range of the
    IQ scale (mean 100, standard deviation 15 — the convention used by the Wechsler tests). About
    <strong>${result.iq >= 100 ? `1 in ${rarity}` : `1 in ${rarity}`}</strong> people score
    ${result.iq >= 100 ? "this high or higher" : "this low or lower"}.</p>
    <p class="muted" style="font-size:0.9rem">Remember: this is a brief online estimate with provisional norms, not a
    clinical assessment. Scores can shift with sleep, effort, practice, and testing conditions —
    professionally administered tests report the same ±${result.ci90}-point kind of uncertainty.
    <a href="methodology.html">Read how this score is computed →</a></p>`;

  // ---------- share & download ----------
  const shareText = `I scored ${result.iq} (${result.band}, ${result.pct}th percentile) on the IQ Lab ${result.mode === "long" ? "Full" : "Quick"} Assessment 🧠`;

  el("share-btn").onclick = async () => {
    const data = { title: "IQ Lab result", text: shareText, url: location.origin + location.pathname.replace(/results\.html.*/, "") };
    try {
      if (navigator.share) await navigator.share(data);
      else await copyShare();
    } catch { /* user cancelled */ }
  };
  async function copyShare() {
    await navigator.clipboard.writeText(shareText);
    flash("copy-btn", "Copied!");
  }
  el("copy-btn").onclick = copyShare;

  function flash(id, msg) {
    const b = el(id), old = b.textContent;
    b.textContent = msg;
    setTimeout(() => (b.textContent = old), 1400);
  }

  // Result card PNG (1200×630) drawn on canvas
  el("download-btn").onclick = () => {
    const c = document.createElement("canvas");
    c.width = 1200; c.height = 630;
    const x = c.getContext("2d");
    // background
    const grad = x.createLinearGradient(0, 0, 1200, 630);
    grad.addColorStop(0, "#0d366b"); grad.addColorStop(1, "#2a78d6");
    x.fillStyle = grad; x.fillRect(0, 0, 1200, 630);
    x.fillStyle = "rgba(255,255,255,0.08)";
    x.beginPath(); x.arc(1050, 90, 220, 0, 7); x.fill();
    // brand
    x.fillStyle = "#ffffff"; x.font = "700 34px system-ui";
    x.fillText("IQ Lab", 70, 90);
    x.fillStyle = "rgba(255,255,255,0.7)"; x.font = "500 22px system-ui";
    x.fillText(modeLabel + " · " + dateStr, 70, 128);
    // score
    x.fillStyle = "#ffffff"; x.font = "850 190px system-ui";
    x.fillText(String(result.iq), 70, 330);
    x.font = "700 40px system-ui";
    x.fillText(result.band, 74, 392);
    x.fillStyle = "rgba(255,255,255,0.85)"; x.font = "500 26px system-ui";
    x.fillText(`Higher than ${result.pct}% of the population · 90% CI ${result.iq - result.ci90}–${result.iq + result.ci90}`, 74, 434);
    if (result.name) {
      x.fillStyle = "rgba(255,255,255,0.9)"; x.font = "600 28px system-ui";
      x.fillText(result.name, 70, 500);
    }
    // mini bell curve
    const bx = 70, bw = 1060, by = 600, bh = 70;
    x.strokeStyle = "rgba(255,255,255,0.9)"; x.lineWidth = 3; x.beginPath();
    for (let i = 0; i <= 120; i++) {
      const v = 40 + i;
      const px = bx + (i / 120) * bw;
      const py = by - Math.exp(-0.5 * Math.pow((v - 100) / 15, 2)) * bh;
      i === 0 ? x.moveTo(px, py) : x.lineTo(px, py);
    }
    x.stroke();
    const mvx = bx + ((Math.min(Math.max(result.iq, 40), 160) - 40) / 120) * bw;
    x.fillStyle = "#ffd27a";
    x.beginPath(); x.arc(mvx, by - Math.exp(-0.5 * Math.pow((result.iq - 100) / 15, 2)) * bh, 9, 0, 7); x.fill();
    x.fillStyle = "rgba(255,255,255,0.55)"; x.font = "500 20px system-ui";
    x.fillText("Research-based estimate · not a clinical assessment", 70, 560);
    // download
    const a = document.createElement("a");
    a.download = `iq-lab-result-${result.iq}.png`;
    a.href = c.toDataURL("image/png");
    a.click();
  };

  // ---------- history ----------
  renderHistory();
  function renderHistory() {
    const h = IQStore.getHistory();
    const wrap = el("history");
    if (!wrap) return;
    if (!h.length) { wrap.innerHTML = `<p class="muted center">No past results yet.</p>`; return; }
    wrap.innerHTML = h
      .map((r) => `
        <div class="history-item">
          <span class="score">${r.iq}</span>
          <span>${r.mode === "long" ? "Full" : "Quick"} · ${r.band} · ${r.pct}th pct</span>
          <span class="when">${new Date(r.date).toLocaleDateString()}</span>
          <a href="results.html?id=${r.id}" title="View">↗</a>
          <button class="del" data-del="${r.id}" title="Delete this result">✕</button>
        </div>`)
      .join("");
    wrap.querySelectorAll("[data-del]").forEach((b) => {
      b.onclick = () => {
        if (confirm("Delete this result from this browser?")) {
          IQStore.deleteResult(b.dataset.del);
          if (params.get("id") === b.dataset.del) location.href = "results.html";
          else renderHistory();
        }
      };
    });
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  }
})();
