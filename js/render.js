/* IQ Lab — SVG rendering for visual test items (matrix cells, polyomino shapes).
   All coordinates live in a 100×100 viewBox; colors come from CSS currentColor
   so items render correctly in light and dark themes. */

const IQRender = (() => {
  const SIZES = { 1: 11, 2: 17, 3: 24 }; // shape radius by size class

  // Returns SVG path/element markup for one shape centered at (cx, cy).
  function shapeMarkup(shape, cx, cy, r, fill, rot) {
    const f = fill === "outline" ? "none" : "currentColor";
    const sw = fill === "outline" ? 3 : 0;
    const stroke = fill === "outline" ? "currentColor" : "none";
    const tf = rot ? ` transform="rotate(${rot} ${cx} ${cy})"` : "";
    const common = `fill="${f}" stroke="${stroke}" stroke-width="${sw}"${tf}`;

    const pts = (n, r0, offset = -90) =>
      Array.from({ length: n }, (_, i) => {
        const a = ((offset + (360 / n) * i) * Math.PI) / 180;
        return `${(cx + r0 * Math.cos(a)).toFixed(2)},${(cy + r0 * Math.sin(a)).toFixed(2)}`;
      }).join(" ");

    let el;
    switch (shape) {
      case "circle":
        el = `<circle cx="${cx}" cy="${cy}" r="${r}" ${common}/>`;
        break;
      case "ring":
        el = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="currentColor" stroke-width="4"${tf}/>`;
        break;
      case "square":
        el = `<rect x="${cx - r}" y="${cy - r}" width="${2 * r}" height="${2 * r}" rx="2" ${common}/>`;
        break;
      case "tri":
        el = `<polygon points="${pts(3, r * 1.15)}" ${common}/>`;
        break;
      case "diamond":
        el = `<polygon points="${pts(4, r * 1.15)}" ${common}/>`;
        break;
      case "pent":
        el = `<polygon points="${pts(5, r * 1.1)}" ${common}/>`;
        break;
      case "star": {
        const p = Array.from({ length: 10 }, (_, i) => {
          const rr = i % 2 === 0 ? r * 1.25 : r * 0.55;
          const a = ((-90 + 36 * i) * Math.PI) / 180;
          return `${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`;
        }).join(" ");
        el = `<polygon points="${p}" ${common}/>`;
        break;
      }
      case "cross": {
        const t = r * 0.42;
        el = `<path d="M${cx - t} ${cy - r} h${2 * t} v${r - t} h${r - t} v${2 * t} h${-(r - t)} v${r - t} h${-2 * t} v${-(r - t)} h${-(r - t)} v${-2 * t} h${r - t} Z" ${common}/>`;
        break;
      }
      case "arrow": {
        // arrow pointing up before rotation
        el = `<path d="M${cx} ${cy - r * 1.2} L${cx + r * 0.9} ${cy + r * 0.2} L${cx + r * 0.35} ${cy + r * 0.2} L${cx + r * 0.35} ${cy + r * 1.1} L${cx - r * 0.35} ${cy + r * 1.1} L${cx - r * 0.35} ${cy + r * 0.2} L${cx - r * 0.9} ${cy + r * 0.2} Z" ${common}/>`;
        break;
      }
      case "bar":
        el = `<rect x="${cx - r * 1.3}" y="${cy - r * 0.35}" width="${r * 2.6}" height="${r * 0.7}" rx="3" ${common}/>`;
        break;
      case "halfmoon":
        el = `<path d="M ${cx} ${cy - r} A ${r} ${r} 0 0 1 ${cx} ${cy + r} Z" ${common}/>`;
        break;
      default:
        el = "";
    }

    // "half" fill: outline shape + clipped solid left half
    if (fill === "half") {
      const id = `h${Math.random().toString(36).slice(2, 8)}`;
      const outline = shapeMarkup(shape, cx, cy, r, "outline", rot);
      return `<clipPath id="${id}"><rect x="${cx - r * 1.5}" y="${cy - r * 1.5}" width="${r * 1.5}" height="${r * 3}"/></clipPath>` +
        `<g clip-path="url(#${id})">${shapeMarkup(shape, cx, cy, r, "solid", rot)}</g>${outline}`;
    }
    return el;
  }

  // Positions for n copies of a shape within the 100×100 cell.
  function positions(n) {
    const layouts = {
      1: [[50, 50]],
      2: [[32, 50], [68, 50]],
      3: [[50, 30], [32, 66], [68, 66]],
      4: [[32, 32], [68, 32], [32, 68], [68, 68]],
      5: [[50, 50], [28, 28], [72, 28], [28, 72], [72, 72]],
      6: [[30, 30], [70, 30], [30, 50], [70, 50], [30, 70], [70, 70]],
      7: [[50, 28], [28, 46], [72, 46], [50, 50], [28, 72], [72, 72], [50, 72]],
      8: [[30, 28], [70, 28], [30, 50], [70, 50], [30, 72], [70, 72], [50, 28], [50, 72]],
      9: [[28, 28], [50, 28], [72, 28], [28, 50], [50, 50], [72, 50], [28, 72], [50, 72], [72, 72]],
    };
    return layouts[n] || layouts[1];
  }

  // spec: {shape, n, fill:'solid'|'outline'|'half', rot, size:1|2|3}
  // or {overlay:[spec,spec]} to stack shapes; null → empty cell
  function cellMarkup(spec) {
    if (!spec) return "";
    if (spec.overlay) return spec.overlay.map(cellMarkup).join("");
    const n = spec.n || 1;
    const size = spec.size || 2;
    const r = n > 1 ? Math.min(SIZES[size], n > 4 ? 9 : 12) : SIZES[size];
    return positions(n)
      .map(([x, y]) => shapeMarkup(spec.shape, x, y, r, spec.fill || "solid", spec.rot || 0))
      .join("");
  }

  function svgWrap(inner, px, vb = 100) {
    return `<svg width="${px}" height="${px}" viewBox="0 0 ${vb} ${vb}" xmlns="http://www.w3.org/2000/svg" role="img">${inner}</svg>`;
  }

  // A single option tile
  function renderCell(spec, px = 84) {
    return svgWrap(cellMarkup(spec), px);
  }

  // 3×3 matrix stimulus; specs = 8 cells, 9th drawn as "?"
  function renderMatrix(specs, px = 300) {
    const cells = [];
    for (let i = 0; i < 9; i++) {
      const gx = (i % 3) * 100;
      const gy = Math.floor(i / 3) * 100;
      if (i < 8) {
        cells.push(`<g transform="translate(${gx},${gy})">${cellMarkup(specs[i])}</g>`);
      } else {
        cells.push(
          `<text x="${gx + 50}" y="${gy + 62}" text-anchor="middle" font-size="40" font-weight="700" fill="currentColor" opacity="0.35" font-family="system-ui">?</text>`
        );
      }
    }
    const grid = [1, 2]
      .map(
        (i) =>
          `<line x1="${i * 100}" y1="4" x2="${i * 100}" y2="296" stroke="currentColor" opacity="0.18" stroke-width="1.5"/>` +
          `<line x1="4" y1="${i * 100}" x2="296" y2="${i * 100}" stroke="currentColor" opacity="0.18" stroke-width="1.5"/>`
      )
      .join("");
    return `<svg width="${px}" height="${px}" viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="3 by 3 pattern matrix with one missing cell">${grid}${cells.join("")}</svg>`;
  }

  // Polyomino / flag shape from unit cells, optionally rotated (deg) and mirrored.
  // cells: [[x,y],...] in grid units; accent: index of one cell drawn hollow so
  // orientation is unambiguous.
  function renderPoly(cells, { rot = 0, mirror = false, px = 90, accent = 0 } = {}) {
    const u = 16;
    const xs = cells.map((c) => c[0]);
    const ys = cells.map((c) => c[1]);
    const w = (Math.max(...xs) + 1) * u;
    const h = (Math.max(...ys) + 1) * u;
    const cx = w / 2;
    const cy = h / 2;
    const body = cells
      .map(([x, y], i) => {
        const hollow = i === accent;
        return `<rect x="${x * u + 1}" y="${y * u + 1}" width="${u - 2}" height="${u - 2}" rx="2" fill="${hollow ? "none" : "currentColor"}" stroke="currentColor" stroke-width="${hollow ? 2.5 : 0}"/>`;
      })
      .join("");
    const tf = `translate(50 50) rotate(${rot}) ${mirror ? "scale(-1,1)" : ""} translate(${-cx} ${-cy})`;
    return svgWrap(`<g transform="${tf}">${body}</g>`, px);
  }

  return { renderCell, renderMatrix, renderPoly };
})();
