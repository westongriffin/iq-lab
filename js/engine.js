/* IQ Lab - test engine (test.html). Drives item presentation, response capture,
   auto-save/resume via localStorage, and hands off to scoring on finish. */

(() => {
  const params = new URLSearchParams(location.search);
  const mode = params.get("mode") === "long" ? "long" : "short";
  const items = IQItems.getTest(mode);
  const D = IQItems.DOMAINS;

  const el = (id) => document.getElementById(id);
  const shell = el("shell");
  const TITLES = { short: "Quick Assessment", long: "Full Assessment" };
  const MINUTES = { short: "10–15", long: "30–40" };

  // ---------- state ----------
  let state = {
    idx: 0,
    answers: {},       // itemId -> option index (mcq/matrix/poly)
    rts: {},           // itemId -> seconds from first view to first answer
    spans: {},         // itemId -> {played, input, done}
    startedAt: null,
    elapsed: 0,        // seconds banked from previous sessions
    finished: false,
  };
  let sessionStart = null; // Date.now() when current session began
  let timerHandle = null;
  let spanTimer = null;

  const saved = IQStore.getProgress(mode);

  // ---------- helpers ----------
  function answeredCount() {
    let n = 0;
    for (const it of items) {
      if (it.type === "span" ? state.spans[it.id]?.done : state.answers[it.id] != null) n++;
    }
    return n;
  }
  function elapsedSec() {
    return state.elapsed + (sessionStart ? Math.floor((Date.now() - sessionStart) / 1000) : 0);
  }
  function persist() {
    IQStore.saveProgress(mode, { ...state, elapsed: elapsedSec() });
  }
  function fmtTime(s) {
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }

  // ---------- screens ----------
  function introScreen(resume) {
    const profile = IQStore.getProfile();
    const name = profile?.name || "";
    shell.innerHTML = `
      <div class="q-card screen-center">
        <div class="big-icon">🧠</div>
        <h2>${TITLES[mode]}</h2>
        <p><strong>${items.length} items · about ${MINUTES[mode]} minutes.</strong></p>
        <p>Items cover ${mode === "long" ? "five" : "four"} domains: pattern matrices, verbal reasoning,
           quantitative reasoning, spatial rotation${mode === "long" ? ", and working memory" : ""}.
           Work at a comfortable pace - there is no per-item time limit, but total time is recorded.</p>
        <p>Find a quiet spot, and don't use a calculator or scratch paper. You can move back and forth
           between questions (memory items lock once played). Progress saves automatically in this browser.</p>
        <p style="margin-top:18px">
          <input class="name-input" id="name-in" placeholder="Your name (optional)" value="${name.replace(/"/g, "&quot;")}" maxlength="40">
        </p>
        <div style="display:flex; gap:12px; justify-content:center; flex-wrap:wrap; margin-top:10px">
          ${resume ? `<button class="btn big" id="resume-btn">Resume test (${resume.done}/${items.length} answered)</button>
                      <button class="btn ghost" id="restart-btn">Start over</button>`
                   : `<button class="btn big" id="start-btn">Begin test</button>`}
        </div>
        <p class="muted" style="font-size:0.82rem; margin-top:22px">This is a research-based estimate for
          education and self-exploration - not a clinical evaluation.
          <a href="methodology.html">How scoring works →</a></p>
      </div>`;
    const saveName = () => {
      const v = el("name-in").value.trim();
      if (v) IQStore.saveProfile({ name: v });
    };
    if (resume) {
      el("resume-btn").onclick = () => { saveName(); beginSession(); };
      el("restart-btn").onclick = () => {
        saveName();
        IQStore.clearProgress(mode);
        state = { idx: 0, answers: {}, spans: {}, startedAt: null, elapsed: 0, finished: false };
        beginSession();
      };
    } else {
      el("start-btn").onclick = () => { saveName(); beginSession(); };
    }
  }

  function beginSession() {
    if (!state.startedAt) state.startedAt = Date.now();
    sessionStart = Date.now();
    if (timerHandle) clearInterval(timerHandle);
    timerHandle = setInterval(() => {
      const t = el("timer");
      if (t) t.textContent = fmtTime(elapsedSec());
    }, 1000);
    render();
  }

  function chrome(inner) {
    const done = answeredCount();
    return `
      <div class="test-topbar">
        <span>${TITLES[mode]}</span>
        <div class="progress-track"><div class="progress-fill" style="width:${(done / items.length) * 100}%"></div></div>
        <span>${done}/${items.length}</span>
        <span class="timer" id="timer">${fmtTime(elapsedSec())}</span>
      </div>
      ${inner}
      <div class="dot-strip">${items.map((it, i) => {
        const answered = it.type === "span" ? state.spans[it.id]?.done : state.answers[it.id] != null;
        return `<button data-jump="${i}" class="${answered ? "answered" : ""}${i === state.idx ? " current" : ""}" aria-label="Question ${i + 1}"></button>`;
      }).join("")}</div>`;
  }

  let viewStart = Date.now();

  function render() {
    if (spanTimer) { clearTimeout(spanTimer); spanTimer = null; }
    viewStart = Date.now();
    const it = items[state.idx];
    let body;
    if (it.type === "span") body = spanBody(it);
    else body = questionBody(it);
    shell.innerHTML = chrome(body);
    wire(it);
  }

  function questionBody(it) {
    const dom = D[it.domain];
    let stimulus = "", optsHtml = "", optClass = "text-opts";
    if (it.type === "matrix") {
      stimulus = `<div class="q-stimulus">${IQRender.renderMatrix(it.cells, 280)}</div>`;
      optClass = "visual-opts";
      optsHtml = it.options.map((o, i) => optTile(i, IQRender.renderCell(o, 76), state.answers[it.id] === i)).join("");
    } else if (it.type === "poly") {
      stimulus = `<div class="q-stimulus">${IQRender.renderPoly(it.cells, { px: 110, accent: it.accent })}</div>`;
      optClass = "visual-opts";
      optsHtml = it.options.map((o, i) =>
        optTile(i, IQRender.renderPoly(it.cells, { rot: o.rot, mirror: o.mirror, px: 80, accent: it.accent }), state.answers[it.id] === i)
      ).join("");
    } else {
      optsHtml = it.options.map((o, i) => `
        <button class="opt ${state.answers[it.id] === i ? "selected" : ""}" data-opt="${i}">
          <span class="key">${"ABCDEF"[i]}</span><span>${o}</span>
        </button>`).join("");
    }
    const prompt = it.type === "matrix" ? "Which tile completes the pattern?"
      : it.type === "poly" ? "Which option is the same shape, rotated - not mirrored?"
      : it.text;
    return `
      <div class="q-card">
        <div class="q-domain">${dom.label} · Question ${state.idx + 1} of ${items.length}</div>
        <div class="q-text">${prompt}</div>
        ${stimulus}
        <div class="options ${optClass}">${optsHtml}</div>
        ${navRow()}
      </div>`;
  }

  function optTile(i, svg, selected) {
    return `<button class="opt visual ${selected ? "selected" : ""}" data-opt="${i}">
      ${svg}<span class="key">${"ABCDEF"[i]}</span></button>`;
  }

  function spanBody(it) {
    const s = state.spans[it.id] || {};
    const dom = D[it.domain];
    const head = `<div class="q-domain">${dom.label} · Question ${state.idx + 1} of ${items.length}</div>`;
    if (s.done) {
      return `<div class="q-card screen-center">${head}
        <div class="big-icon">✅</div>
        <p><strong>Sequence recorded.</strong> Memory items lock after one attempt, so this one can't be replayed.</p>
        ${navRow()}</div>`;
    }
    return `<div class="q-card screen-center">${head}
      <div class="q-text">Memorize the digits</div>
      <p>${it.digits.length} digits will appear one at a time. When they finish, type the sequence
         in the <strong>same order</strong>. You get one attempt - the sequence won't repeat.</p>
      <div class="span-display" id="span-display"></div>
      <div id="span-controls">
        <button class="btn big" id="span-start">Show the digits</button>
      </div>
      ${navRow(true)}</div>`;
  }

  function navRow(hideNext) {
    const last = state.idx === items.length - 1;
    const allDone = answeredCount() === items.length;
    return `<div class="test-nav">
      <button class="btn ghost" id="prev-btn" ${state.idx === 0 ? "disabled" : ""}>← Back</button>
      <div class="spacer"></div>
      ${allDone || last
        ? `<button class="btn" id="finish-btn">Finish & see results</button>`
        : ""}
      ${!last && !hideNext ? `<button class="btn subtle" id="next-btn">Next →</button>` : ""}
    </div>`;
  }

  // ---------- wiring ----------
  function wire(it) {
    shell.querySelectorAll("[data-opt]").forEach((b) => {
      b.onclick = () => {
        if (state.rts[it.id] == null) state.rts[it.id] = (Date.now() - viewStart) / 1000;
        state.answers[it.id] = Number(b.dataset.opt);
        persist();
        // brief visual confirmation, then auto-advance
        render();
        setTimeout(() => {
          if (items[state.idx] === it && state.idx < items.length - 1) {
            state.idx++; persist(); render();
          } else if (answeredCount() === items.length) {
            render();
          }
        }, 350);
      };
    });
    shell.querySelectorAll("[data-jump]").forEach((b) => {
      b.onclick = () => { state.idx = Number(b.dataset.jump); persist(); render(); };
    });
    const prev = el("prev-btn"), next = el("next-btn"), fin = el("finish-btn");
    if (prev) prev.onclick = () => { state.idx--; persist(); render(); };
    if (next) next.onclick = () => { state.idx++; persist(); render(); };
    if (fin) fin.onclick = finish;
    const spanStart = el("span-start");
    if (spanStart) spanStart.onclick = () => playSpan(it);
  }

  function playSpan(it) {
    const disp = el("span-display");
    el("span-controls").innerHTML = "";
    state.spans[it.id] = { played: true, done: false };
    persist();
    const digits = it.digits.split("");
    let i = 0;
    const step = () => {
      if (i < digits.length) {
        disp.textContent = digits[i];
        disp.style.opacity = "0";
        requestAnimationFrame(() => { disp.style.transition = "opacity 0.15s"; disp.style.opacity = "1"; });
        i++;
        spanTimer = setTimeout(() => { disp.textContent = ""; spanTimer = setTimeout(step, 250); }, 850);
      } else {
        disp.textContent = "";
        el("span-controls").innerHTML = `
          <input class="span-input" id="span-in" inputmode="numeric" autocomplete="off"
                 placeholder="Type the digits" maxlength="${digits.length + 2}">
          <div style="margin-top:14px"><button class="btn" id="span-submit">Submit</button></div>`;
        const input = el("span-in");
        input.focus();
        const submit = () => {
          const val = input.value.replace(/\D/g, "");
          state.spans[it.id] = { played: true, done: true, input: val };
          persist();
          if (state.idx < items.length - 1) state.idx++;
          render();
        };
        el("span-submit").onclick = submit;
        input.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
      }
    };
    step();
  }

  // ---------- finish ----------
  function finish() {
    const unanswered = items.length - answeredCount();
    if (unanswered > 0 &&
        !confirm(`${unanswered} question${unanswered > 1 ? "s" : ""} unanswered - they will be scored as incorrect. Finish anyway?`)) {
      return;
    }
    const responses = {};
    for (const it of items) {
      if (it.type === "span") {
        responses[it.id] = { correct: state.spans[it.id]?.input === it.digits };
      } else {
        responses[it.id] = { correct: state.answers[it.id] === it.answer, rt: state.rts?.[it.id] };
      }
    }
    const s = IQScore.score(mode, items, responses);
    const profile = IQStore.getProfile();
    const result = {
      id: Date.now().toString(36),
      mode,
      date: new Date().toISOString(),
      name: profile?.name || null,
      durationSec: elapsedSec(),
      ...s,
    };
    IQStore.addResult(result);
    IQStore.clearProgress(mode);
    if (timerHandle) clearInterval(timerHandle);
    location.href = `results.html?id=${result.id}`;
  }

  // keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT") return;
    const it = items[state.idx];
    if (!it || it.type === "span") return;
    const k = e.key.toUpperCase();
    const idx = "ABCDEF".indexOf(k);
    if (idx >= 0 && idx < it.options.length) {
      shell.querySelector(`[data-opt="${idx}"]`)?.click();
    } else if (e.key === "ArrowRight" && state.idx < items.length - 1) {
      state.idx++; persist(); render();
    } else if (e.key === "ArrowLeft" && state.idx > 0) {
      state.idx--; persist(); render();
    }
  });

  // ---------- boot ----------
  document.title = `${TITLES[mode]} - IQ Lab`;
  if (saved && !saved.finished) {
    state = { ...state, ...saved };
    const done = (() => {
      let n = 0;
      for (const it of items) {
        if (it.type === "span" ? state.spans[it.id]?.done : state.answers[it.id] != null) n++;
      }
      return n;
    })();
    if (done > 0) introScreen({ done });
    else introScreen(null);
  } else {
    introScreen(null);
  }
})();
