/* IQ Lab — item bank.
   All items are original, authored for this site. Item types follow formats with
   strong research pedigrees: figural matrices (the format of Raven 1938/2000),
   verbal analogies & vocabulary, quantitative series, mental rotation
   (Shepard & Metzler 1971), and forward digit span (Wechsler tradition).
   Each item carries `p` — an a-priori estimate of the proportion of the adult
   population expected to answer correctly — used by the scoring model.
   `answer` indexes into `options` after a deterministic per-item shuffle, so
   option order is stable across sessions (needed for saved progress). */

const IQItems = (() => {
  // ---------- deterministic shuffle ----------
  function seedFrom(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffled(arr, id) {
    const rng = mulberry32(seedFrom(id));
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ---------- builders ----------
  function mat(id, p, gen, distractors) {
    const cells = [];
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 3; c++)
        if (!(r === 2 && c === 2)) cells.push(gen(r, c));
    const correct = gen(2, 2);
    const options = shuffled([correct, ...distractors], id);
    return { id, domain: "mr", type: "matrix", p, cells, options, answer: options.indexOf(correct) };
  }

  function mcq(id, domain, p, text, options, answerText, note) {
    const opts = shuffled(options, id);
    return { id, domain, type: "mcq", p, text, options: opts, answer: opts.indexOf(answerText), note };
  }

  function poly(id, p, cells, accent, correctRot, mirrorRots) {
    const correct = { rot: correctRot, mirror: false };
    const options = shuffled([correct, ...mirrorRots.map((r) => ({ rot: r, mirror: true }))], id);
    return { id, domain: "sp", type: "poly", p, cells, accent, options, answer: options.indexOf(correct) };
  }

  function span(id, p, digits) {
    return { id, domain: "wm", type: "span", p, digits };
  }

  // ---------- matrix reasoning (figural matrices) ----------
  const MR = {};

  {
    const ROW = ["circle", "square", "tri"];
    MR.m01 = mat("m01", 0.95, (r, c) => ({ shape: ROW[r], size: c + 1 }), [
      { shape: "tri", size: 2 }, { shape: "tri", size: 1 },
      { shape: "circle", size: 3 }, { shape: "square", size: 3 },
      { shape: "tri", size: 3, fill: "outline" },
    ]);
  }
  {
    const ROW = ["diamond", "circle", "square"];
    MR.m02 = mat("m02", 0.9, (r, c) => ({ shape: ROW[r], n: c + 1, size: 2 }), [
      { shape: "square", n: 2, size: 2 }, { shape: "square", n: 4, size: 2 },
      { shape: "circle", n: 3, size: 2 }, { shape: "diamond", n: 3, size: 2 },
      { shape: "square", n: 3, size: 2, fill: "outline" },
    ]);
  }
  {
    const ROW = ["square", "circle", "pent"];
    const FILL = ["solid", "half", "outline"];
    MR.m03 = mat("m03", 0.85, (r, c) => ({ shape: ROW[r], size: 3, fill: FILL[c] }), [
      { shape: "pent", size: 3, fill: "solid" }, { shape: "pent", size: 3, fill: "half" },
      { shape: "circle", size: 3, fill: "outline" }, { shape: "square", size: 3, fill: "outline" },
      { shape: "pent", size: 2, fill: "outline" },
    ]);
  }
  {
    MR.m04 = mat("m04", 0.78, (r, c) => ({ shape: "arrow", size: 2, rot: r * 90 + c * 45 }), [
      { shape: "arrow", size: 2, rot: 0 }, { shape: "arrow", size: 2, rot: 90 },
      { shape: "arrow", size: 2, rot: 180 }, { shape: "arrow", size: 2, rot: 315 },
      { shape: "arrow", size: 2, rot: 225 },
    ]);
  }
  {
    const SH = ["tri", "circle", "square"];
    MR.m05 = mat("m05", 0.72, (r, c) => ({ shape: SH[(r + c) % 3], size: 3 }), [
      { shape: "tri", size: 3 }, { shape: "square", size: 3 },
      { shape: "circle", size: 3, fill: "outline" }, { shape: "circle", size: 2 },
      { shape: "diamond", size: 3 },
    ]);
  }
  {
    MR.m06 = mat("m06", 0.68, (r, c) => ({ shape: "circle", n: r + c + 1, size: 1 }), [
      { shape: "circle", n: 4, size: 1 }, { shape: "circle", n: 6, size: 1 },
      { shape: "circle", n: 3, size: 1 }, { shape: "square", n: 5, size: 1 },
      { shape: "circle", n: 5, size: 1, fill: "outline" },
    ]);
  }
  {
    const OUTER = [{ shape: "ring", size: 3 }, { shape: "square", size: 3, fill: "outline" }, { shape: "tri", size: 3, fill: "outline" }];
    const INNER = [{ shape: "circle", size: 1 }, { shape: "diamond", size: 1 }, { shape: "cross", size: 1 }];
    MR.m07 = mat("m07", 0.6, (r, c) => ({ overlay: [OUTER[r], INNER[c]] }), [
      { overlay: [OUTER[2], INNER[1]] }, { overlay: [OUTER[2], INNER[0]] },
      { overlay: [OUTER[0], INNER[2]] }, { overlay: [OUTER[1], INNER[2]] },
      { overlay: [OUTER[2], { shape: "cross", size: 1, fill: "outline" }] },
    ]);
  }
  {
    const COL = ["circle", "tri", "star"];
    MR.m08 = mat("m08", 0.55, (r, c) => ({ shape: COL[c], size: ((r + c) % 3) + 1 }), [
      { shape: "star", size: 1 }, { shape: "star", size: 3 },
      { shape: "tri", size: 2 }, { shape: "circle", size: 2 },
      { shape: "star", size: 2, fill: "outline" },
    ]);
  }
  {
    const A = [{ shape: "circle", size: 1 }, { shape: "square", size: 1 }, { shape: "tri", size: 1 }];
    const B = [{ shape: "ring", size: 3 }, { shape: "diamond", size: 3, fill: "outline" }, { shape: "pent", size: 3, fill: "outline" }];
    MR.m09 = mat("m09", 0.5, (r, c) => (c === 0 ? A[r] : c === 1 ? B[r] : { overlay: [B[r], A[r]] }), [
      { overlay: [B[2], A[0]] }, { overlay: [B[2], A[1]] },
      { overlay: [B[1], A[2]] }, { overlay: [B[0], A[2]] },
      { overlay: [B[2], { shape: "tri", size: 1, fill: "outline" }] },
    ]);
  }
  {
    MR.m10 = mat("m10", 0.45, (r, c) => ({ shape: "arrow", n: r + 1, rot: c * 90, size: r === 0 ? 2 : 1 }), [
      { shape: "arrow", n: 3, rot: 90, size: 1 }, { shape: "arrow", n: 3, rot: 270, size: 1 },
      { shape: "arrow", n: 2, rot: 180, size: 1 }, { shape: "arrow", n: 4, rot: 180, size: 1 },
      { shape: "arrow", n: 3, rot: 0, size: 1 },
    ]);
  }
  {
    MR.m11 = mat("m11", 0.42, (r, c) => ({ shape: "diamond", n: 5 - r - c, size: 1 }), [
      { shape: "diamond", n: 2, size: 1 }, { shape: "diamond", n: 3, size: 1 },
      { shape: "circle", n: 1, size: 1 }, { shape: "diamond", n: 1, size: 1, fill: "outline" },
      { shape: "diamond", n: 4, size: 1 },
    ]);
  }
  {
    const SH = ["square", "tri", "circle"];
    MR.m12 = mat("m12", 0.38, (r, c) => ({ shape: SH[(r + c) % 3], size: ((r + 2 * c) % 3) + 1 }), [
      { shape: "tri", size: 2 }, { shape: "tri", size: 3 },
      { shape: "circle", size: 1 }, { shape: "square", size: 1 },
      { shape: "tri", size: 1, fill: "outline" },
    ]);
  }
  {
    MR.m13 = mat("m13", 0.35, (r, c) => ({ shape: "halfmoon", size: 3, rot: ((r + c) % 4) * 90 }), [
      { shape: "halfmoon", size: 3, rot: 90 }, { shape: "halfmoon", size: 3, rot: 180 },
      { shape: "halfmoon", size: 3, rot: 270 }, { shape: "circle", size: 3 },
      { shape: "halfmoon", size: 2, rot: 0 },
    ]);
  }
  {
    const FILL = ["solid", "half", "outline"];
    MR.m14 = mat("m14", 0.3, (r, c) => ({ shape: "star", size: 3 - r, fill: FILL[c] }), [
      { shape: "star", size: 1, fill: "solid" }, { shape: "star", size: 1, fill: "half" },
      { shape: "star", size: 2, fill: "outline" }, { shape: "star", size: 3, fill: "outline" },
      { shape: "tri", size: 1, fill: "outline" },
    ]);
  }
  {
    MR.m15 = mat("m15", 0.27, (r, c) => ({ shape: "circle", n: (r + 1) * (c + 1), size: 1 }), [
      { shape: "circle", n: 8, size: 1 }, { shape: "circle", n: 6, size: 1 },
      { shape: "circle", n: 4, size: 1 }, { shape: "square", n: 9, size: 1 },
      { shape: "circle", n: 9, size: 1, fill: "outline" },
    ]);
  }
  {
    const OUTER = [{ shape: "ring", size: 3 }, { shape: "square", size: 3, fill: "outline" }, { shape: "pent", size: 3, fill: "outline" }];
    MR.m16 = mat("m16", 0.24, (r, c) => ({ overlay: [OUTER[(r + c) % 3], { shape: "circle", n: ((r + 2 * c) % 3) + 1, size: 1 }] }), [
      { overlay: [OUTER[1], { shape: "circle", n: 2, size: 1 }] },
      { overlay: [OUTER[1], { shape: "circle", n: 3, size: 1 }] },
      { overlay: [OUTER[0], { shape: "circle", n: 1, size: 1 }] },
      { overlay: [OUTER[2], { shape: "circle", n: 1, size: 1 }] },
      { overlay: [OUTER[1], { shape: "diamond", n: 1, size: 1 }] },
    ]);
  }
  {
    const FILL = ["solid", "outline", "half"];
    MR.m17 = mat("m17", 0.2, (r, c) => ({ shape: "arrow", size: 2, rot: ((r + c) % 4) * 90, fill: FILL[(r + 2 * c) % 3] }), [
      { shape: "arrow", size: 2, rot: 90, fill: "solid" }, { shape: "arrow", size: 2, rot: 0, fill: "outline" },
      { shape: "arrow", size: 2, rot: 0, fill: "half" }, { shape: "arrow", size: 2, rot: 180, fill: "solid" },
      { shape: "arrow", size: 2, rot: 270, fill: "half" },
    ]);
  }

  // ---------- verbal reasoning ----------
  const VR = [
    mcq("v01", "vr", 0.92, "Bird is to nest as bee is to ___", ["flower", "hive", "honey", "wing"], "hive"),
    mcq("v02", "vr", 0.85, "Which one does not belong?", ["apple", "banana", "carrot", "cherry"], "carrot", "The others are fruits."),
    mcq("v03", "vr", 0.7, "Scarce is to abundant as transparent is to ___", ["clear", "opaque", "fragile", "visible"], "opaque"),
    mcq("v04", "vr", 0.5, "All Blorks are Fleems. No Fleems are Quins. Which statement must be true?", [
      "All Fleems are Blorks", "No Blorks are Quins", "Some Quins are Blorks", "Some Fleems are Quins",
    ], "No Blorks are Quins"),
    mcq("v05", "vr", 0.9, "Puppy is to dog as kitten is to ___", ["mouse", "cat", "fur", "lion"], "cat"),
    mcq("v06", "vr", 0.82, "Which word is closest in meaning to “candid”?", ["hidden", "frank", "hopeful", "careful"], "frank"),
    mcq("v07", "vr", 0.75, "Which one does not belong?", ["oak", "maple", "pine", "rose"], "rose", "The others are trees."),
    mcq("v08", "vr", 0.68, "Author is to novel as sculptor is to ___", ["chisel", "statue", "museum", "stone"], "statue"),
    mcq("v09", "vr", 0.6, "“Ephemeral” most nearly means:", ["eternal", "short-lived", "delicate", "glowing"], "short-lived"),
    mcq("v10", "vr", 0.55, "Maria is taller than Jane. Jane is taller than Sue. Kate is shorter than Sue. Who is second tallest?", ["Maria", "Jane", "Sue", "Kate"], "Jane"),
    mcq("v11", "vr", 0.48, "Mitigate is to aggravate as ___ is to squander", ["conserve", "spend", "waste", "gather"], "conserve"),
    mcq("v12", "vr", 0.42, "Which word does not belong?", ["scalene", "isosceles", "equilateral", "perpendicular"], "perpendicular", "The others are types of triangles."),
    mcq("v13", "vr", 0.35, "Some Dax are Rell. All Rell are Vim. Which statement must be true?", [
      "All Dax are Vim", "Some Dax are Vim", "No Vim are Dax", "All Vim are Rell",
    ], "Some Dax are Vim"),
    mcq("v14", "vr", 0.28, "“Obdurate” most nearly means:", ["obedient", "stubborn", "generous", "ancient"], "stubborn"),
  ];

  // ---------- quantitative reasoning ----------
  const NR = [
    mcq("n01", "nr", 0.92, "What number comes next?   2, 4, 6, 8, …", ["9", "10", "12", "14"], "10"),
    mcq("n02", "nr", 0.8, "What number comes next?   1, 2, 4, 8, 16, …", ["24", "30", "32", "64"], "32"),
    mcq("n03", "nr", 0.62, "What number comes next?   3, 4, 6, 9, 13, …", ["16", "17", "18", "20"], "18"),
    mcq("n04", "nr", 0.45, "What number comes next?   2, 5, 11, 23, …", ["35", "44", "46", "47"], "47"),
    mcq("n05", "nr", 0.88, "What number comes next?   5, 10, 15, 20, …", ["22", "25", "30", "35"], "25"),
    mcq("n06", "nr", 0.75, "What number comes next?   21, 18, 15, 12, …", ["8", "9", "10", "11"], "9"),
    mcq("n07", "nr", 0.65, "What number comes next?   1, 1, 2, 3, 5, 8, …", ["11", "12", "13", "16"], "13"),
    mcq("n08", "nr", 0.58, "What number comes next?   64, 32, 16, 8, …", ["2", "4", "6", "0"], "4"),
    mcq("n09", "nr", 0.48, "What number comes next?   2, 6, 12, 20, 30, …", ["40", "42", "44", "36"], "42"),
    mcq("n10", "nr", 0.6, "What number comes next?   1, 4, 9, 16, 25, …", ["30", "34", "36", "49"], "36"),
    mcq("n11", "nr", 0.33, "What number comes next?   1, 2, 4, 3, 9, 4, 16, 5, …", ["20", "25", "6", "32"], "25"),
    mcq("n12", "nr", 0.28, "If 3 workers build 3 walls in 3 days, how many days do 9 workers need to build 9 walls?", ["1 day", "3 days", "9 days", "27 days"], "3 days"),
  ];

  // ---------- spatial (mental rotation) ----------
  const SP = {
    sp1: poly("sp1", 0.85, [[0, 0], [0, 1], [0, 2], [1, 2]], 0, 90, [0, 90, 180, 270]),
    sp2: poly("sp2", 0.72, [[1, 0], [2, 0], [0, 1], [1, 1]], 2, 180, [0, 90, 180, 270]),
    sp3: poly("sp3", 0.6, [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2]], 4, 270, [0, 90, 180, 270]),
    sp4: poly("sp4", 0.8, [[0, 0], [0, 1], [1, 1]], 0, 90, [0, 90, 180, 270]),
    sp5: poly("sp5", 0.5, [[1, 0], [2, 0], [0, 1], [1, 1], [1, 2]], 0, 180, [0, 90, 180, 270]),
    sp6: poly("sp6", 0.42, [[1, 0], [0, 1], [1, 1], [1, 2], [1, 3]], 0, 90, [0, 90, 180, 270]),
    sp7: poly("sp7", 0.35, [[0, 0], [1, 0], [1, 1], [1, 2], [2, 2]], 0, 270, [0, 90, 180, 270]),
    sp8: poly("sp8", 0.3, [[0, 0], [0, 1], [1, 1], [1, 2], [1, 3]], 0, 180, [0, 90, 180, 270]),
    sp9: poly("sp9", 0.25, [[1, 0], [2, 0], [0, 1], [1, 1], [1, 2]], 3, 90, [0, 90, 180, 270]),
  };

  // ---------- working memory (forward digit span) ----------
  const WM = [
    span("w1", 0.88, "58273"),
    span("w2", 0.7, "739154"),
    span("w3", 0.45, "8241976"),
    span("w4", 0.22, "62958314"),
  ];

  // ---------- test forms ----------
  const SHORT = [
    MR.m01, MR.m03, MR.m05, MR.m08, MR.m10,
    VR[0], VR[1], VR[2], VR[3],
    NR[0], NR[1], NR[2], NR[3],
    SP.sp1, SP.sp3, SP.sp7,
  ];

  const LONG = [
    MR.m02, MR.m04, MR.m06, MR.m07, MR.m09, MR.m11, MR.m12, MR.m13, MR.m14, MR.m15, MR.m16, MR.m17,
    VR[4], VR[5], VR[6], VR[7], VR[8], VR[9], VR[10], VR[11], VR[12], VR[13],
    NR[4], NR[5], NR[6], NR[7], NR[8], NR[9], NR[10], NR[11],
    SP.sp4, SP.sp2, SP.sp5, SP.sp6, SP.sp8, SP.sp9,
    ...WM,
  ];

  const DOMAINS = {
    mr: { label: "Matrix Reasoning", desc: "Find the rule and pick the missing tile." },
    vr: { label: "Verbal Reasoning", desc: "Word meanings, analogies, and logic." },
    nr: { label: "Quantitative Reasoning", desc: "Number patterns and quantitative logic." },
    sp: { label: "Spatial Rotation", desc: "Pick the rotated — not mirrored — version." },
    wm: { label: "Working Memory", desc: "Memorize the digits, then type them back." },
  };

  return {
    getTest: (mode) => (mode === "long" ? LONG : SHORT),
    DOMAINS,
  };
})();
