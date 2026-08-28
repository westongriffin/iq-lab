/* IQ Lab - landing page interactions: welcome-back banner and the
   interactive percentile explorer. */

(() => {
  // welcome back
  const profile = IQStore.getProfile();
  const latest = IQStore.latestResult();
  const banner = document.getElementById("welcome");
  if (banner && (profile?.name || latest)) {
    const bits = [];
    if (profile?.name) bits.push(`Welcome back, <strong>${profile.name.replace(/</g, "&lt;")}</strong>.`);
    else bits.push("Welcome back.");
    if (latest) {
      bits.push(`Your last score was <strong>${latest.iq}</strong> (${latest.band}) on ${new Date(latest.date).toLocaleDateString()}. <a href="results.html">View your results →</a>`);
    }
    banner.innerHTML = bits.join(" ");
    banner.classList.add("show");
  }

  // resume-in-progress notice on test cards
  for (const mode of ["short", "long"]) {
    const prog = IQStore.getProgress(mode);
    const elBtn = document.getElementById(`cta-${mode}`);
    if (prog && elBtn) {
      const answered = Object.keys(prog.answers || {}).length + Object.values(prog.spans || {}).filter((s) => s.done).length;
      if (answered > 0) elBtn.textContent = `Resume test (${answered} answered)`;
    }
  }

  // percentile explorer
  const slider = document.getElementById("iq-slider");
  if (!slider) return;
  const W = 640, H = 200, PAD = 34, BASE = H - 30;
  const xOf = (v) => PAD + ((v - 40) / 120) * (W - 2 * PAD);
  const pdf = (v) => Math.exp(-0.5 * Math.pow((v - 100) / 15, 2));
  const yOf = (v) => BASE - pdf(v) * (BASE - 20);

  function draw(iq) {
    let curve = "", fill = `M ${xOf(40)} ${BASE} `;
    for (let v = 40; v <= 160; v++) {
      curve += `${v === 40 ? "M" : "L"} ${xOf(v).toFixed(1)} ${yOf(v).toFixed(1)} `;
      if (v <= iq) fill += `L ${xOf(v).toFixed(1)} ${yOf(v).toFixed(1)} `;
    }
    fill += `L ${xOf(iq).toFixed(1)} ${BASE} Z`;
    const ticks = [55, 70, 85, 100, 115, 130, 145]
      .map((v) => `<text x="${xOf(v)}" y="${BASE + 18}" text-anchor="middle" font-size="12" fill="var(--ink-3)" font-family="system-ui">${v}</text>`)
      .join("");
    document.getElementById("explorer-svg").innerHTML = `
      <line x1="${PAD}" y1="${BASE}" x2="${W - PAD}" y2="${BASE}" stroke="var(--baseline)" stroke-width="1.5"/>
      ${ticks}
      <path d="${fill}" fill="var(--series-1, #2a78d6)" opacity="0.2"/>
      <path d="${curve}" fill="none" stroke="var(--series-1, #2a78d6)" stroke-width="2"/>
      <line x1="${xOf(iq)}" y1="${yOf(iq)}" x2="${xOf(iq)}" y2="${BASE}" stroke="var(--series-2, #eb6834)" stroke-width="2" stroke-dasharray="4 3"/>
      <circle cx="${xOf(iq)}" cy="${yOf(iq)}" r="5" fill="var(--series-2, #eb6834)" stroke="var(--surface)" stroke-width="2"/>`;
    const pct = IQScore.phi((iq - 100) / 15) * 100;
    const rare = IQScore.rarity(iq);
    document.getElementById("ex-iq").textContent = iq;
    document.getElementById("ex-pct").textContent = pct >= 99.9 ? "99.9+" : pct <= 0.1 ? "<0.1" : pct.toFixed(1);
    document.getElementById("ex-rare").textContent =
      iq >= 100 ? `1 in ${rare.toLocaleString()}` : `1 in ${rare.toLocaleString()}`;
    document.getElementById("ex-rare-lbl").textContent =
      iq >= 100 ? "score this high or higher" : "score this low or lower";
  }
  slider.addEventListener("input", () => draw(Number(slider.value)));
  draw(Number(slider.value));
})();
