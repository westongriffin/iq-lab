/* IQ Lab - scoring model (item response theory).
   Deviation-IQ scoring in the Wechsler convention (M = 100, SD = 15), computed
   with a Bayesian IRT model rather than a raw-sum lookup:

   1. Each item i is modeled with a three-parameter logistic (3PL) curve
      (Birnbaum 1968; Embretson & Reise 2000):
        P_i(th) = c_i + (1 - c_i) / (1 + exp(-a_i (th - b_i)))
      where c_i is the guessing floor (1 / number of options; 0 for typed
      digit-span responses), a_i is the discrimination assigned by item format,
      and b_i is the difficulty.
   2. b_i is calibrated at load time so that the model's population pass rate
      (integrating the curve over a standard-normal ability prior) equals the
      item's a-priori difficulty estimate p_i.
   3. A test-taker's ability is the expected a posteriori (EAP) estimate: the
      mean of the posterior over ability given their full right/wrong response
      pattern and a N(0,1) prior (Bock & Mislevy 1982). Which items were solved
      matters, not just how many, and lucky guesses on hard items move the
      estimate less because the guessing floor absorbs them.
   4. IQ = 100 + 15·EAP, reported within 60-145. The confidence interval is
      individualized: 90% CI = 1.645 × 15 × posterior SD, so it tightens where
      the test is most informative and widens honestly at the extremes.

   Norms remain provisional (model-derived, not census-normed) - stated plainly
   on the methodology page and on every result. */

const IQScore = (() => {
  // ability grid for numerical integration
  const GRID = [];
  for (let t = -4; t <= 4.001; t += 0.1) GRID.push(t);
  const PRIOR = GRID.map((t) => Math.exp(-0.5 * t * t));

  // discrimination by item format (literature-typical values)
  const DISC = { matrix: 1.3, mcq: 1.15, poly: 1.0, span: 1.0 };

  const CLAMP = { min: 60, max: 145 };

  function p3(theta, a, b, c) {
    return c + (1 - c) / (1 + Math.exp(-a * (theta - b)));
  }

  // marginal population pass rate of an item, given its parameters
  function marginal(a, b, c) {
    let num = 0, den = 0;
    for (let i = 0; i < GRID.length; i++) {
      num += PRIOR[i] * p3(GRID[i], a, b, c);
      den += PRIOR[i];
    }
    return num / den;
  }

  // solve for the difficulty b that reproduces the item's target pass rate
  function calibrateB(p, a, c) {
    let lo = -6, hi = 6;
    for (let k = 0; k < 40; k++) {
      const mid = (lo + hi) / 2;
      if (marginal(a, mid, c) > p) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }

  const paramCache = new Map();
  function params(it) {
    if (!paramCache.has(it.id)) {
      const a = DISC[it.type] || 1.0;
      const c = it.type === "span" ? 0 : 1 / (it.options?.length || 4);
      paramCache.set(it.id, { a, b: calibrateB(it.p, a, c), c });
    }
    return paramCache.get(it.id);
  }

  // standard normal CDF (Zelen & Severo approximation)
  function phi(z) {
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const d = 0.3989422804 * Math.exp((-z * z) / 2);
    let p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return z > 0 ? 1 - p : p;
  }

  // Wechsler-style descriptive classifications (WAIS-IV manual terminology)
  function classify(iq) {
    if (iq >= 130) return "Very Superior";
    if (iq >= 120) return "Superior";
    if (iq >= 110) return "High Average";
    if (iq >= 90) return "Average";
    if (iq >= 80) return "Low Average";
    if (iq >= 70) return "Borderline";
    return "Extremely Low";
  }

  /** items: the test form; responses: {itemId: {correct: bool, rt?: seconds}} */
  function score(mode, items, responses) {
    let raw = 0;
    const domains = {};

    // log-likelihood of the response pattern at each grid point
    const logL = new Array(GRID.length).fill(0);
    for (const it of items) {
      const resp = responses[it.id];
      const ok = !!(resp && resp.correct);
      raw += ok ? 1 : 0;
      const d = (domains[it.domain] ||= { correct: 0, total: 0 });
      d.total += 1;
      d.correct += ok ? 1 : 0;

      const { a, b, c } = params(it);
      for (let i = 0; i < GRID.length; i++) {
        const P = p3(GRID[i], a, b, c);
        logL[i] += Math.log(ok ? P : 1 - P);
      }
    }

    // posterior over ability; EAP mean and posterior SD
    const maxLL = Math.max(...logL);
    let wSum = 0, tSum = 0;
    const w = GRID.map((t, i) => {
      const wi = PRIOR[i] * Math.exp(logL[i] - maxLL);
      wSum += wi; tSum += wi * t;
      return wi;
    });
    const eap = tSum / wSum;
    let vSum = 0;
    for (let i = 0; i < GRID.length; i++) vSum += w[i] * Math.pow(GRID[i] - eap, 2);
    const psd = Math.sqrt(vSum / wSum);

    const iq = Math.round(Math.min(CLAMP.max, Math.max(CLAMP.min, 100 + 15 * eap)));
    const ci90 = Math.round(1.645 * 15 * psd);
    const pct = Math.round(phi((iq - 100) / 15) * 1000) / 10;

    // effort check: rapid-guessing detection (Wise & Kong 2005). Median
    // response times under ~2.5s on reasoning items indicate non-effortful
    // responding; the score is reported but flagged.
    const rts = items
      .filter((it) => it.type !== "span" && responses[it.id]?.rt != null)
      .map((it) => responses[it.id].rt);
    let lowEffort = false;
    if (rts.length >= 6) {
      const fast = rts.filter((t) => t < 2.5).length;
      lowEffort = fast / rts.length >= 0.3;
    }

    return {
      raw, total: items.length, iq, ci90,
      pct: Math.min(99.9, Math.max(0.1, pct)),
      band: classify(iq),
      domains,
      lowEffort,
    };
  }

  function percentile(iq) {
    return phi((iq - 100) / 15) * 100;
  }
  function rarity(iq) {
    // 1 in N people at or above this IQ (for IQ >= 100), or at/below (< 100)
    const p = phi((iq - 100) / 15);
    const tail = iq >= 100 ? 1 - p : p;
    return tail > 0 ? Math.round(1 / tail) : Infinity;
  }

  return { score, percentile, rarity, classify, phi };
})();
