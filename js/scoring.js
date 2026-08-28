/* IQ Lab — scoring model.
   Deviation-IQ scoring in the Wechsler tradition (M = 100, SD = 15):

   1. Each item i carries an a-priori difficulty p_i — the estimated proportion
      of the adult population that answers it correctly.
   2. For a random member of the population, expected raw score μ = Σ p_i.
   3. Population variance of the raw score exceeds the independent-items
      (binomial) value because item responses correlate positively through g
      (Spearman 1904). We inflate the binomial SD by a factor consistent with
      an internal-consistency reliability around .85–.93 for tests of this
      length (Cronbach-alpha logic): σ = σ_binomial × INFLATE.
   4. z = (raw − μ) / σ, IQ = 100 + 15z, clamped to the range where a brief
      online instrument retains any measurement precision.
   5. The confidence interval uses SEM = 15·√(1 − reliability)
      (Dudek 1979, "The continuing misinterpretation of the standard error of
      measurement").

   This is an ESTIMATE with provisional (non-clinical) norms — stated plainly
   on the methodology page and on every result. */

const IQScore = (() => {
  const INFLATE = 1.75; // item-covariance inflation of binomial SD
  const RELIABILITY = { short: 0.85, long: 0.93 };
  const CLAMP = { min: 60, max: 145 };

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

  /** items: the test form; responses: {itemId: {correct: bool}} */
  function score(mode, items, responses) {
    let raw = 0, mu = 0, varB = 0;
    const domains = {};
    for (const it of items) {
      const resp = responses[it.id];
      const ok = !!(resp && resp.correct);
      raw += ok ? 1 : 0;
      mu += it.p;
      varB += it.p * (1 - it.p);
      const d = (domains[it.domain] ||= { correct: 0, total: 0 });
      d.total += 1;
      d.correct += ok ? 1 : 0;
    }
    const sigma = Math.sqrt(varB) * INFLATE;
    const z = (raw - mu) / sigma;
    const iq = Math.round(Math.min(CLAMP.max, Math.max(CLAMP.min, 100 + 15 * z)));
    const rel = RELIABILITY[mode] || 0.85;
    const sem = 15 * Math.sqrt(1 - rel);
    const ci90 = Math.round(1.645 * sem);
    const pct = Math.round(phi((iq - 100) / 15) * 1000) / 10;
    return {
      raw, total: items.length, iq, ci90,
      pct: Math.min(99.9, Math.max(0.1, pct)),
      band: classify(iq),
      domains,
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
