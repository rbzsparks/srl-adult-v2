/* people.js: parametric bust figures (viewBox 0 0 200 240), shaded at "Level 2" as chosen in design/avatar_style_sheet.html.
 * One renderer draws the designer preview, strangers, foils, the known and unfamiliar person, and the face test, so
 * drawing quality is identical for everyone shown. Feature vectors are plain objects (see FEATURE_KEYS / NEUTRAL).
 *
 * Feature contrast: every facial feature is coloured relative to the skin it sits on (CIELAB lightness difference,
 * dL*), so no feature is masked on any skin tone: mouth seam dL* 24, eyes near-black, brows >= 25 and facial hair
 * >= 22 (dark or brown hair only ever pushed darker), age lines 10 / 13, stubble 6.
 * Animation: PersonRig (gaze, head roll, nod, mouth opening, smile, brow raise, bounce) with a three-quarter turn
 * toward the partner (facing). */
SRL.people = (function () {
  const U = SRL.util;
  let uid = 0;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const f = (n) => (+n).toFixed(1);
  const pt = (p) => f(p[0]) + ' ' + f(p[1]);
  const hex2rgb = (h) => { h = h.replace('#', ''); return [0, 2, 4].map((i) => parseInt(h.substr(i, 2), 16)); };
  const rgb2hex = (r) => '#' + r.map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, t) => { const A = hex2rgb(a), B = hex2rgb(b); return rgb2hex(A.map((v, i) => v + (B[i] - v) * t)); };
  const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const gam = (c) => { c = clamp(c, 0, 1); return 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055); };
  function lstar(h) { const [r, g, b] = hex2rgb(h).map(lin); const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b; return Y > 0.008856 ? 116 * Math.cbrt(Y) - 16 : 903.3 * Y; }
  function oklch(L, C, H) {
    const a = C * Math.cos(H * Math.PI / 180), b = C * Math.sin(H * Math.PI / 180);
    const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3), m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3), s = Math.pow(L - 0.0894841775 * a - 1.2914855480 * b, 3);
    return rgb2hex([gam(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s), gam(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s), gam(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)]);
  }
  const INK = '#120B09', WHITE = '#FFFFFF';
  // Mix toward INK or WHITE until L* reaches target (clamped when out of reach).
  function towardL(base, target) {
    const L0 = lstar(base); if (Math.abs(target - L0) < 0.05) return base;
    const dark = target < L0, to = dark ? INK : WHITE;
    if (dark ? lstar(to) >= target : lstar(to) <= target) return to;
    let lo = 0, hi = 1;
    for (let i = 0; i < 22; i++) { const m = (lo + hi) / 2, L = lstar(mix(base, to, m)); if (dark ? L <= target : L >= target) hi = m; else lo = m; }
    return mix(base, to, hi);
  }
  const shade = (c, dl) => towardL(c, lstar(c) - dl);
  const light = (c, dl) => towardL(c, lstar(c) + dl);
  // Push base lighter or darker (smaller change) until |L* - L*(skin)| >= dl.
  function away(base, skin, dl) {
    const Ls = lstar(skin), Lb = lstar(base);
    if (Math.abs(Lb - Ls) >= dl) return base;
    const d = towardL(base, Ls - dl), l = towardL(base, Ls + dl);
    const okD = Math.abs(lstar(d) - Ls) >= dl - 0.5, okL = Math.abs(lstar(l) - Ls) >= dl - 0.5;
    if (okD && okL) return Math.abs(lstar(d) - Lb) <= Math.abs(lstar(l) - Lb) ? d : l;
    if (okD) return d; if (okL) return l;
    return Math.abs(lstar(d) - Ls) >= Math.abs(lstar(l) - Ls) ? d : l;
  }
  // Hair-coloured features (brows, facial hair): dark or brown hair is only ever pushed darker, so a brown beard on
  // deep skin becomes near-black rather than lighter than the skin. Light hair uses away().
  function awayHair(base, skin, dl) {
    if (lstar(base) >= 55) return away(base, skin, dl);
    const Ls = lstar(skin);
    return Math.abs(lstar(base) - Ls) >= dl && lstar(base) < Ls ? base : towardL(base, Ls - dl);
  }
  // Tint between skin and c with |dL*| = dl.
  function tint(skin, c, dl) {
    const Ls = lstar(skin); if (Math.abs(lstar(c) - Ls) <= dl) return c;
    let lo = 0, hi = 1;
    for (let i = 0; i < 22; i++) { const m = (lo + hi) / 2; if (Math.abs(lstar(mix(skin, c, m)) - Ls) >= dl) hi = m; else lo = m; }
    return mix(skin, c, hi);
  }

  /* Skin: lightness (0 light .. 1 deep) x undertone (0 cool .. 0.33 neutral .. 0.67 warm .. 1 olive). */
  function skinHex(L01, U01) {
    const L = 0.895 - 0.52 * L01;
    const H = 38 + 38 * U01;
    let C = 0.052 + 0.036 * L01;
    if (U01 > 0.8) C *= 1 - 0.1 * (U01 - 0.8) / 0.2;
    return oklch(L, C, H);
  }
  // Named natural colours sit at fixed points on the slider: black 0, dark brown 0.2, brown 0.4, light brown 0.58,
  // auburn 0.72, blonde 0.92. Neighbouring names differ by about 10-14 L* so a one-step change is visible.
  const HAIR_STOPS = [[0, '#1C1918'], [0.2, '#33231C'], [0.4, '#744C30'], [0.58, '#9C7148'], [0.72, '#8E4A2D'], [0.82, '#B88A55'], [0.92, '#CFAE72'], [1, '#E2CA96']];
  function hairHex(c, gray) {
    let col = HAIR_STOPS[HAIR_STOPS.length - 1][1];
    for (let i = 1; i < HAIR_STOPS.length; i++) if (c <= HAIR_STOPS[i][0]) { const [a, ca] = HAIR_STOPS[i - 1], [b, cb] = HAIR_STOPS[i]; col = mix(ca, cb, (c - a) / (b - a)); break; }
    if (gray > 0) col = mix(col, '#A3A19D', clamp(gray * 1.6, 0, 1));
    if (gray > 0.6) col = mix(col, '#E8E5E0', (gray - 0.6) / 0.4);
    return col;
  }
  const IRIS = { darkbrown: '#3A2416', brown: '#5C3A21', hazel: '#7B6437', green: '#5E7447', blue: '#5A7FA8', gray: '#7E8B95' };
  // Shirt palettes. Designer (known / unfamiliar person) and stranger colours are disjoint, so clothing never links the
  // person on the right to a stranger.
  const DESIGNER_SHIRTS = { warmgray: '#B9B3A8', navy: '#2F3E66', maroon: '#8E3B46', rose: '#D98BA3', olive: '#77763A', charcoal: '#3E3E44' };
  const STRANGER_SHIRTS = { teal: '#3E8C86', blue: '#4C78B5', mustard: '#C9A13B', coral: '#D27860', green: '#5E8F4E', plum: '#7D5A8C', slate: '#6B7480' };
  const SHIRTS = Object.assign({}, DESIGNER_SHIRTS, STRANGER_SHIRTS);
  const COVER = { navy: '#34506E', plum: '#704A66', forest: '#2F5D50', sand: '#A88A5E', saffron: '#C77A2E', white: '#ECE8E1', maroon: '#7A2E33' };

  /* Hair styles: texture(s) and length category. */
  const STYLES = {
    buzz: { tex: ['straight', 'wavy', 'curly', 'coily'], len: ['short'], label: 'Buzz' },
    bald: { tex: ['straight', 'wavy', 'curly', 'coily'], len: ['short'], label: 'Bald / receding' },
    crop: { tex: ['straight', 'wavy'], len: ['short'], label: 'Short crop' },
    sidepart: { tex: ['straight', 'wavy'], len: ['short'], label: 'Side part' },
    curly_short: { tex: ['curly'], len: ['short'], label: 'Short curls' },
    coils_short: { tex: ['coily'], len: ['short'], label: 'Short coils' },
    bangs: { tex: ['straight', 'wavy'], len: ['medium'], label: 'Bob with bangs' },
    bob: { tex: ['straight', 'wavy'], len: ['medium'], label: 'Bob' },
    shoulder: { tex: ['straight', 'wavy'], len: ['medium'], label: 'Shoulder length' },
    curly_mid: { tex: ['curly', 'coily'], len: ['medium'], label: 'Curls / coils, medium' },
    afro: { tex: ['curly', 'coily'], len: ['medium'], label: 'Afro' },
    bun: { tex: ['straight', 'wavy', 'curly', 'coily'], len: ['medium', 'long'], label: 'Bun / puff' },
    long: { tex: ['straight', 'wavy'], len: ['long'], label: 'Long' },
    curly_long: { tex: ['curly'], len: ['long'], label: 'Curls, long' },
    braids: { tex: ['curly', 'coily'], len: ['long'], label: 'Braids' },
    locs: { tex: ['curly', 'coily'], len: ['long'], label: 'Locs' }
  };

  /* Catmull-Rom sampling. */
  function cr(pts, closed, seg) {
    seg = seg || 8; const n = pts.length, out = [];
    const get = (i) => closed ? pts[(i + n) % n] : pts[clamp(i, 0, n - 1)];
    const last = closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
      for (let k = 0; k < seg; k++) {
        const t = k / seg, t2 = t * t, t3 = t2 * t;
        const c = (j) => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3);
        out.push([c(0), c(1)]);
      }
    }
    if (!closed) out.push(pts[n - 1]);
    return out;
  }
  // Three-quarter turn: while W is set, outlines (head, hair, facial hair, covering) are narrowed on the far side.
  let W = null;
  const ptw = (q) => pt(W ? W(q) : q);
  const poly = (pts) => 'M' + pts.map(ptw).join('L') + 'Z';
  const M = (p) => [200 - p[0], p[1]];
  const sym = (r) => r.concat(r.slice(1, -1).reverse().map(M));
  const shape = (...segs) => segs.reduce((acc, s) => acc.concat(cr(s, false, 7)), []);
  const wave = (pts, amp, freq, y0) => pts.map(([x, y]) => (y > y0 ? [x + Math.sign(x - 100) * amp * Math.sin((y - y0) * freq), y] : [x, y]));
  function bumps(pts, r, step) {
    let out = '', acc = step;
    for (let i = 1; i < pts.length; i++) {
      acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      if (acc >= step) { acc = 0; const q = W ? W(pts[i]) : pts[i]; out += `<circle cx="${f(q[0])}" cy="${f(q[1])}" r="${f(r)}"/>`; }
    }
    return out;
  }
  // Points on a circle. (Not Array.from(…, fn): Qualtrics' Prototype.js 1.7.1 replaces Array.from and ignores fn.)
  function ring(cx, cy, r, n) { const out = []; for (let i = 0; i < n; i++) out.push([cx + r * Math.cos(i / (n - 1) * Math.PI * 2), cy + r * Math.sin(i / (n - 1) * Math.PI * 2)]); return out; }
  /* ---------- Textured hair (v2.3) ----------
   * Curly and coily hair is drawn as one filled mass whose edge is made of clustered curls of varied size, plus
   * texture strokes inside it (tight coils or open ringlets) in a darker and a lighter shade of the hair colour.
   * This replaced v2.2's ring of identical circles around a flat shape, which read as a beaded sticker outline.
   * Everything is seeded, so a given avatar always looks the same. */
  // Arc-length walker over a polyline: point and unit tangent at distance s.
  function walker(pts) {
    const L = [0];
    for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    let j = 1;
    const at = (s) => {
      if (s <= 0) j = 1;
      while (j < pts.length - 1 && L[j] < s) j++;
      while (j > 1 && L[j - 1] > s) j--;
      const a = pts[j - 1], b = pts[j], seg = (L[j] - L[j - 1]) || 1e-6, t = clamp((s - L[j - 1]) / seg, 0, 1);
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, (b[0] - a[0]) / seg, (b[1] - a[1]) / seg];
    };
    return { total: L[L.length - 1], at };
  }
  /* Replace a polyline by clustered curls: bulges of varied length (size × 0.55–1.45) and height (amp × 0.5–1.3),
   * pointing away from (cx, cy) (dir = 1) or toward it (dir = -1). */
  function curlEdge(pts, size, amp, cx, cy, seed, dir) {
    const r = rng(seed), wk = walker(pts), out = [pts[0]], d = dir || 1;
    let s = 0;
    while (s < wk.total - 0.01) {
      let len = size * (0.55 + 0.9 * r());
      if (wk.total - s < len * 1.4) len = wk.total - s;
      const h = amp * (0.5 + 0.8 * r()) * Math.min(1.2, len / size);
      const n = Math.max(3, Math.round(len / 1.1));
      for (let k = 1; k <= n; k++) {
        const t = k / n, q = wk.at(s + len * t);
        let nx = -q[3], ny = q[2];
        if (((q[0] - cx) * nx + (q[1] - cy) * ny) * d < 0) { nx = -nx; ny = -ny; }
        const b = h * Math.pow(Math.sin(Math.PI * t), 0.75);
        out.push([q[0] + nx * b, q[1] + ny * b]);
      }
      s += len;
    }
    return out;
  }
  // Points on an ellipse with slow, seeded lumps, so a round shape (afro, puff) isn't a perfect oval.
  function lumpy(cx, cy, rx, ry, n, seed, depth) {
    const r = rng(seed), p1 = r() * 6.3, p2 = r() * 6.3, p3 = r() * 6.3, out = [];
    for (let i = 0; i <= n; i++) {
      const a = i / n * Math.PI * 2, k = 1 + depth * (0.5 * Math.sin(3 * a + p1) + 0.35 * Math.sin(5 * a + p2) + 0.25 * Math.sin(8 * a + p3));
      out.push([cx + rx * k * Math.cos(a), cy + ry * k * Math.sin(a)]);
    }
    return out;
  }
  /* Texture inside a hair shape (clipped to it): the mass is read as many overlapping curl clusters. Each cluster gets a
   * shadow crescent along its lower edge and, on most, a highlight on its upper left, so the hair has the bumpy volume
   * of real curls or coils. kind 'coil' (coily): small, dense clusters plus a few fine coils; 'curl' (curly): larger,
   * slightly taller clusters. box = [x0, y0, x1, y1] to fill; the n argument scales the density (1 = normal). */
  function hairTexture(shapePts, box, n, kind, seed, C, clipId) {
    const r = rng(seed), coil = kind === 'coil', dens = n || 1;
    const darkHair = lstar(C.hair) < 25;
    const shadow = shade(C.hair, darkHair ? 4 : 13), lite = light(C.hair, darkHair ? 15 : 10), fineC = darkHair ? light(C.hair, 9) : shade(C.hair, 10);
    const R = (coil ? 3.9 : 5.6) / Math.sqrt(dens), dx = R * 1.55, dy = R * (coil ? 1.3 : 1.45);
    const arc = (cx, cy, rx, ry, a, b) => `M${f(cx + rx * Math.cos(a))} ${f(cy + ry * Math.sin(a))}A${f(rx)} ${f(ry)} 0 0 1 ${f(cx + rx * Math.cos(b))} ${f(cy + ry * Math.sin(b))}`;
    let dk = '', lt = '', fine = '', row = 0;
    for (let y = box[1]; y < box[3] + R; y += dy, row++) {
      for (let x = box[0] + (row % 2 ? dx / 2 : 0); x < box[2] + R; x += dx) {
        const jx = x + (r() - 0.5) * R * 1.6, jy = y + (r() - 0.5) * R * 1.5, q = W ? W([jx, jy]) : [jx, jy];
        const rx = R * (0.72 + 0.55 * r()), ry = rx * (coil ? 0.92 : 1.12);
        dk += arc(q[0], q[1], rx, ry, 0.12 + 0.4 * r(), Math.PI - 0.12 - 0.4 * r());
        const top = (y - box[1]) / (box[3] - box[1]);
        if (r() < 0.75 - 0.35 * top) lt += arc(q[0], q[1], rx * 0.7, ry * 0.7, Math.PI * 1.08 + 0.25 * r(), Math.PI * 1.5 + 0.2 * r());
        if (coil && r() < 0.5) {
          const fr = 0.8 + 0.6 * r(), a0 = r() * 6.283, fx = q[0] + (r() - 0.5) * rx, fy = q[1] + (r() - 0.5) * ry;
          fine += `M${f(fx + fr * Math.cos(a0))} ${f(fy + fr * Math.sin(a0))}A${f(fr)} ${f(fr)} 0 1 1 ${f(fx + fr * Math.cos(a0 + 4.4))} ${f(fy + fr * Math.sin(a0 + 4.4))}`;
        }
      }
    }
    return `<clipPath id="${clipId}"><path d="${poly(shapePts)}"/></clipPath><g clip-path="url(#${clipId})" fill="none" stroke-linecap="round">` +
      `<path d="${dk}" stroke="${shadow}" stroke-width="${coil ? 1.35 : 1.7}" opacity="${darkHair ? 0.9 : 0.5}"/>` +
      `<path d="${lt}" stroke="${lite}" stroke-width="${coil ? 1 : 1.25}" opacity="${darkHair ? 0.6 : 0.5}"/>` +
      (fine ? `<path d="${fine}" stroke="${fineC}" stroke-width="0.6" opacity="0.45"/>` : '') + '</g>';
  }
  /* Grain for straight / wavy short hair, buzz cuts, stubble and straight beards (v2.3): short strokes on a jittered grid,
   * each pointing the way the hair grows or is combed (dirFn(x, y) -> [dx, dy]), darker strokes everywhere and lighter
   * ones in the upper part (sheen). len 0 gives a stipple of dots; wave > 0 bends each stroke. Clipped to the shape. */
  function grain(shapePts, box, step, len, dirFn, wave, seed, C, clipId, opt) {
    opt = opt || {};
    const r = rng(seed), darkHair = lstar(C.hair) < 25;
    const dk = opt.dark || shade(C.hair, darkHair ? 4 : 12), lt = opt.light || light(C.hair, darkHair ? 15 : 10);
    let d1 = '', d2 = '', row = 0;
    for (let y = box[1]; y < box[3]; y += step, row++) {
      for (let x = box[0] + (row % 2 ? step / 2 : 0); x < box[2]; x += step) {
        const jx = x + (r() - 0.5) * step * 0.9, jy = y + (r() - 0.5) * step * 0.9;
        const v = dirFn(jx, jy), m = Math.hypot(v[0], v[1]) || 1, ux = v[0] / m, uy = v[1] / m, L = len * (0.7 + 0.6 * r());
        const a = W ? W([jx, jy]) : [jx, jy];
        let s;
        if (!len) s = `M${f(a[0])} ${f(a[1])}h.1`;   // a dot: a tiny round-capped stroke (far smaller than an arc)
        else {
          const bend = (wave || 0) * (r() - 0.3) * L * 0.4;
          s = `M${f(a[0])} ${f(a[1])}q${f(ux * L / 2 - uy * bend)} ${f(uy * L / 2 + ux * bend)} ${f(ux * L)} ${f(uy * L)}`;
        }
        const top = (jy - box[1]) / (box[3] - box[1]);
        if (!opt.noLight && r() < 0.5 - 0.4 * top) d2 += s; else d1 += s;
      }
    }
    const sw = opt.width || (len ? 0.6 : 1.05);
    const paint = (d, c, o) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${sw}" opacity="${o}" stroke-linecap="round"/>`;
    return `<clipPath id="${clipId}"><path d="${poly(shapePts)}"/></clipPath><g clip-path="url(#${clipId})">` +
      paint(d1, dk, opt.darkOp || (darkHair ? 0.7 : 0.45)) + (d2 ? paint(d2, lt, opt.lightOp || 0.45) : '') + '</g>';
  }
  // Two-scale curl edge: larger clumps, with finer curls on top of them.
  function clumpEdge(pts, kind, cx, cy, seed, dir, k) {
    const coil = kind === 'coil', s = k || 1;
    const coarse = curlEdge(pts, (coil ? 11 : 15) * s, (coil ? 2.4 : 3.6) * s, cx, cy, seed, dir);
    return curlEdge(coarse, (coil ? 3 : 4.6) * s, (coil ? 0.85 : 1.15) * s, cx, cy, seed + 7, dir);
  }
  // A soft darker rim just inside a hair shape's edge, for depth.
  const rim = (pts, C, w) => `<path d="${poly(pts)}" fill="none" stroke="${shade(C.hair, 9)}" stroke-width="${w || 1.4}" opacity="0.45" stroke-linejoin="round"/>`;

  function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const FRECKLES = (() => { const r = rng(7), out = []; for (let i = 0; i < 34; i++) { const side = i % 2 ? 1 : -1; const ang = r() * Math.PI * 2, rad = Math.sqrt(r()); out.push(i % 6 === 5 ? [side * 3 * r(), 112 + 8 * r(), 'n'] : [side * (26 + 11 * rad * Math.cos(ang)), 117 + 6 * rad * Math.sin(ang), 'c']); } return out; })();

  function geom(p, o) {
    const hw = 47 + 17 * p.faceW, jawHW = hw * (0.6 + 0.24 * p.jaw), chinHW = 6.5 + 12 * p.jaw;
    // facing: -1 .. 1. Features shift about 9% of face width toward the partner; the far eye narrows.
    const fc = o.facing || 0, turn = Math.abs(fc), dir = Math.sign(fc), dx = fc * 0.09 * 2 * hw;
    const right = [[100, 36], [100 + hw * 0.74, 44], [100 + hw * 0.97, 70], [100 + hw, 100], [100 + hw * 0.95, 126], [100 + jawHW, 151], [100 + chinHW, 167], [100, 172]];
    const nb = 121 + 12 * p.noseL;
    return {
      dx, turn, dir, hw, jawHW, chinHW, head: cr(sym(right), true, 8),
      eyeY: 104, ex: 19.5 + 8 * p.eyeSpacing, a: 9 + 4 * p.eyeSize, b: 5 + 2.2 * p.eyeSize, tilt: (p.eyeTilt - 0.5) * 6.4,
      nb, nw: 6.5 + 6.5 * p.noseW, nx: 100 + dx * 1.3,
      my: nb + 15, mw: 10 + 7 * p.mouthW, ut: 1.7 + 2.5 * p.lipFull, lt: 2.3 + 3.3 * p.lipFull, mx: 100 + dx * 1.15
    };
  }

  function colors(p, lv) {
    const skin = skinHex(p.skinL, p.skinU), hair = hairHex(p.hairColor, p.hairGray), Ls = lstar(skin);
    const facial = awayHair(hair, skin, 22);
    const lip = towardL(mix(skin, '#A4544C', 0.25), Ls - 8);
    return {
      skin, hair, facial, stubble: tint(skin, facial, 6), lip, lipUp: towardL(lip, Ls - 11), lipHi: light(lip, 7),
      seam: towardL(skin, Ls - 24), interior: towardL(skin, Ls - 32), lid: towardL(skin, Ls - 32),
      crease: towardL(skin, Ls - 13), l10: towardL(skin, Ls - 10), l13: towardL(skin, Ls - 13), l16: towardL(skin, Ls - 16), nose: towardL(skin, Ls - 17), nostril: towardL(skin, Ls - 24),
      hi: light(skin, lv >= 3 ? 6 : 3.5), lo: towardL(skin, Ls - (lv >= 3 ? 11 : 7)), socket: towardL(skin, Ls - 8),
      brow: awayHair(mix(hair, '#3A2A22', 0.35), skin, 25), frame: away('#2B2B30', skin, 25),
      freckle: towardL(mix(skin, '#8A5A3A', 0.3), Ls - 13), iris: IRIS[p.iris] || IRIS.brown,
      shirt: SHIRTS[p.shirt] || p.shirt, cover: COVER[p.coverColor] || COVER.navy,
      hairLine: lstar(hair) < 25 ? light(hair, 12) : shade(hair, 12)
    };
  }

  const far = (g, s) => g.turn > 0 && s === g.dir;
  const eyeA = (g, s) => g.a * (far(g, s) ? 1 - 0.12 * g.turn : 1);
  const eyeX = (g, s) => 100 + s * g.ex * (far(g, s) ? 1 - 0.06 * g.turn : 1) + g.dx;
  function eye(s, g, p, o, C, id, lv) {
    const cx = eyeX(g, s), cy = g.eyeY, a = eyeA(g, s), b = g.b, t = g.tilt;
    const I = [cx - s * a, cy + t * 0.5], O = [cx + s * a, cy - t * 0.5];
    // Looking down lowers the upper lid (same amount for every lid type).
    const up = (p.lid === 'mono' ? 1.22 : 1.32) - 0.5 * Math.max(0, o.gaze[1]);
    const U1 = [cx - s * a * 0.45, cy - b * up - t * 0.1], U2 = [cx + s * a * 0.5, cy - b * up - t * 0.35];
    const L1 = [cx + s * a * 0.45, cy + b * 0.95 - t * 0.2], L2 = [cx - s * a * 0.4, cy + b * 0.98 + t * 0.15];
    const upper = `M${pt(I)}C${pt(U1)} ${pt(U2)} ${pt(O)}`;
    const shp = upper + `C${pt(L1)} ${pt(L2)} ${pt(I)}Z`;
    const ix = cx + o.gaze[0] * a * 0.5, iy = cy + 0.4 + o.gaze[1] * b * 0.45, ir = b * 0.92 + 0.6;
    const cid = id + (s > 0 ? 'er' : 'el');
    let out = '';
    if (lv >= 3) out += `<ellipse cx="${f(cx)}" cy="${f(cy - b * 0.9)}" rx="${f(a * 1.45)}" ry="${f(b * 1.7)}" fill="${C.socket}" opacity="0.45"/>`;
    if (p.lid === 'mono' && lv >= 2) out += `<path d="${upper}" transform="translate(0 -1.8)" fill="none" stroke="${C.socket}" stroke-width="3.2" opacity="0.55" stroke-linecap="round"/>`;
    out += `<clipPath id="${cid}"><path d="${shp}"/></clipPath><path d="${shp}" fill="#F6F3EE"/>`;
    out += `<g clip-path="url(#${cid})"><circle cx="${f(ix)}" cy="${f(iy)}" r="${f(ir)}" fill="${C.iris}"/>`;
    if (lv >= 2) out += `<circle cx="${f(ix)}" cy="${f(iy)}" r="${f(ir - 0.4)}" fill="none" stroke="${shade(C.iris, 14)}" stroke-width="0.8"/>`;
    out += `<circle cx="${f(ix)}" cy="${f(iy)}" r="${f(ir * 0.45)}" fill="#0E0A09"/>`;
    if (lv >= 2) out += `<path d="${upper}" fill="none" stroke="#3A2A24" stroke-width="3" opacity="0.18"/>`;
    out += `<circle cx="${f(ix - ir * 0.35)}" cy="${f(iy - ir * 0.4)}" r="1.1" fill="#FFFFFF" opacity="0.92"/></g>`;
    out += `<path d="M${pt(O)}C${pt(L1)} ${pt(L2)} ${pt(I)}" fill="none" stroke="${C.l10}" stroke-width="0.7" opacity="0.8"/>`;
    out += `<path d="${upper}" fill="none" stroke="${C.lid}" stroke-width="1.7" stroke-linecap="round"/>`;
    out += `<path d="M${pt(O)}l${f(s * 1.6)} -0.8" stroke="${C.lid}" stroke-width="1.3" stroke-linecap="round"/>`;
    if (p.lid === 'double') out += `<path d="M${pt([cx - s * a * 0.55, cy - b * 1.05])}Q${pt([cx + s * a * 0.15, cy - b * 2.25 - t * 0.3])} ${pt([cx + s * a * 1.02, cy - b * 0.75 - t * 0.5])}" fill="none" stroke="${C.crease}" stroke-width="0.9" stroke-linecap="round"/>`;
    if (p.lid === 'hooded') {
      const fold = `M${pt([cx - s * a * 0.1, cy - b * 1.85])}Q${pt([cx + s * a * 0.75, cy - b * 1.95 - t * 0.3])} ${pt([O[0] + s * 1.4, O[1] - b * 0.25])}`;
      if (lv >= 2) out += `<path d="${fold}" transform="translate(0 1.2)" fill="none" stroke="${C.socket}" stroke-width="2.4" opacity="0.5"/>`;
      out += `<path d="${fold}" fill="none" stroke="${C.crease}" stroke-width="1.05" stroke-linecap="round"/>`;
    }
    return out;
  }

  function brow(s, g, p, C) {
    const cx = eyeX(g, s), a = eyeA(g, s), y0 = g.eyeY - g.b * 1.35 - 9, th = 1.2 + 3.2 * p.browThick, arch = 0.5 + 5.5 * p.browArch, t = g.tilt;
    const ix = cx - s * a * 0.95, ox = cx + s * a * 1.3, px = ix + (ox - ix) * 0.6;
    const iy = y0 + 1 + t * 0.3, oy = y0 + 2.4 - t * 0.4, py = y0 - arch + 1.6;
    const pts = [[ix, iy], [ix - s * 0.4, iy - th], [px, py - th * 0.85], [ox, oy - th * 0.2], [px + s * 1, py + 0.2]];
    return `<path d="${poly(cr(pts, true, 6))}" fill="${C.brow}"/>`;
  }

  function nose(g, C, lv) {
    const x = g.nx, y = g.nb, w = g.nw;
    let out = '';
    if (lv >= 2) {
      out += `<path d="M${f(x + 2.5)} 100 C${f(x + 4)} ${f(y - 10)} ${f(x + w * 0.9)} ${f(y - 6)} ${f(x + w * 0.7)} ${f(y)} L${f(x + 2)} ${f(y - 1)}Z" fill="${C.lo}" opacity="${lv >= 3 ? 0.55 : 0.4}"/>`;
      out += `<ellipse cx="${f(x - 1.2)}" cy="${f(y - 3.5)}" rx="3.2" ry="2.6" fill="${C.hi}" opacity="0.7"/>`;
      out += `<ellipse cx="${f(x)}" cy="${f(y + 4.5)}" rx="${f(w * 0.45)}" ry="1.6" fill="${C.lo}" opacity="0.35"/>`;
    }
    if (lv >= 3) out += `<path d="M${f(x - 1)} 101 L${f(x - 1.2)} ${f(y - 7)}" stroke="${C.hi}" stroke-width="1.6" opacity="0.5" stroke-linecap="round"/>`;
    out += `<path d="M${f(x - w)} ${f(y - 4)}Q${f(x - w - 1.6)} ${f(y + 0.6)} ${f(x - w * 0.42)} ${f(y + 0.9)}M${f(x + w)} ${f(y - 4)}Q${f(x + w + 1.6)} ${f(y + 0.6)} ${f(x + w * 0.42)} ${f(y + 0.9)}M${f(x - w * 0.34)} ${f(y + 1.3)}Q${f(x)} ${f(y + 2.9)} ${f(x + w * 0.34)} ${f(y + 1.3)}" fill="none" stroke="${C.nose}" stroke-width="1.3" stroke-linecap="round"/>`;
    out += `<ellipse cx="${f(x - w * 0.5)}" cy="${f(y + 0.2)}" rx="1.7" ry="0.9" fill="${C.nostril}" opacity="0.75"/><ellipse cx="${f(x + w * 0.5)}" cy="${f(y + 0.2)}" rx="1.7" ry="0.9" fill="${C.nostril}" opacity="0.75"/>`;
    return out;
  }

  function mouth(g, o, C, lv, halo) {
    const s = clamp(o.smile || 0, 0, 1), op = clamp(o.mouth || 0, 0, 1);
    const mx = g.mx, my = g.my, mw = g.mw, ut = g.ut, lt = g.lt, h = op * 12.75;
    const cyc = my - s * 2.2 + op * 0.5, half = mw + s * 1.2 - op * 1.0;
    const Lc = [mx - half, cyc], Rc = [mx + half, cyc];
    const seamC = [mx, my + s * 1.6], lowC = [mx, my + s * 1.6 + 2 * h];
    const upperLip = `M${pt(Lc)}C${pt([Lc[0] + mw * 0.3, my - ut * 1.05])} ${pt([mx - mw * 0.2, my - ut * 1.15])} ${pt([mx, my - ut * 0.75])}C${pt([mx + mw * 0.2, my - ut * 1.15])} ${pt([Rc[0] - mw * 0.3, my - ut * 1.05])} ${pt(Rc)}Q${pt(seamC)} ${pt(Lc)}Z`;
    const ly = my + (lt + h) * 1.33 + s * 0.8;
    const lowerLip = `M${pt(Lc)}Q${pt(lowC)} ${pt(Rc)}C${pt([Rc[0] - mw * 0.25, ly])} ${pt([Lc[0] + mw * 0.25, ly])} ${pt(Lc)}Z`;
    let out = '';
    if (halo) out += `<g fill="none" stroke="${C.skin}" stroke-width="2.4" stroke-linejoin="round"><path d="${upperLip}"/><path d="${lowerLip}"/></g>`;
    out += `<path d="${lowerLip}" fill="${C.lip}"/><path d="${upperLip}" fill="${C.lipUp}"/>`;
    if (lv >= 2) out += `<ellipse cx="${f(mx - 1)}" cy="${f(my + h + lt * 0.55)}" rx="${f(mw * 0.35)}" ry="${f(lt * 0.25)}" fill="${C.lipHi}" opacity="0.55"/>`;
    if (h > 0.35) {
      const inner = `M${pt(Lc)}Q${pt(seamC)} ${pt(Rc)}Q${pt(lowC)} ${pt(Lc)}Z`;
      out += `<path d="${inner}" fill="${C.interior}"/>`;
      if (h > 2.5) out += `<path d="M${pt([Lc[0] + 2, Lc[1] + 0.6])}Q${pt([mx, seamC[1] + 0.2])} ${pt([Rc[0] - 2, Rc[1] + 0.6])}Q${pt([mx, seamC[1] + Math.min(5.2, h * 0.75)])} ${pt([Lc[0] + 2, Lc[1] + 0.6])}Z" fill="#F1EDE6"/>`;
      out += `<path d="${inner}" fill="none" stroke="${C.seam}" stroke-width="0.9"/>`;
    } else {
      out += `<path d="M${pt(Lc)}Q${pt(seamC)} ${pt(Rc)}" fill="none" stroke="${C.seam}" stroke-width="1.15" stroke-linecap="round"/>`;
    }
    return out;
  }

  function facialHair(p, g, C, lv) {
    if (!p.facial || p.facial === 'none') return '';
    const hw = g.hw, my = g.my, mw = g.mw, ut = g.ut;
    const beard = (ext) => sym([[100, my - ut - 5.5], [100 + mw * 0.6, my - ut - 5.2], [100 + mw + 5, my - 2], [100 + hw * 0.66, 132], [100 + hw * 0.96, 122],
      [100 + hw * 0.95 + ext * 0.15, 134], [100 + g.jawHW + ext * 0.5, 153], [100 + g.chinHW + ext * 0.4, 168 + ext * 0.5], [100, 173 + ext]]);
    const tex = p.texture === 'curly' || p.texture === 'coily';
    let out = '';
    const FC = Object.assign({}, C, { hair: C.facial });
    // Hair grows down and slightly outward from the chin's centre line.
    const down = (x) => [(x - 100) * 0.25, 1];
    if (p.facial === 'stubble') {
      // v2.3: a light tint with fine stipple and a slightly broken edge, instead of a flat patch.
      const sp = curlEdge(cr(beard(0), true, 7), 2.4, 0.5, 100, 140, 83, 1);
      out = `<path d="${poly(sp)}" fill="${C.stubble}" opacity="0.8"/>`;
      if (lv >= 2) out += grain(sp, [100 - hw, 112, 100 + hw, 176], 1.25, 0, down, 0, 84, FC, 'fs' + (++uid), { dark: C.facial, darkOp: 0.3, noLight: true });
    }
    if (p.facial === 'beard' || p.facial === 'fullbeard') {
      const ext = p.facial === 'fullbeard' ? 7 : 1.5;
      // v2.3: straight / wavy beards get a softly broken edge and hair strokes growing down (flat shapes before).
      const pts = tex ? cr(beard(ext), true, 7) : curlEdge(cr(beard(ext), true, 7), 2.6, p.facial === 'fullbeard' ? 0.9 : 0.6, 100, 140, 85, 1);
      out = `<path d="${poly(pts)}" fill="${C.facial}"/>`;
      if (!tex && lv >= 2) out += grain(pts, [100 - hw, 110, 100 + hw, 184], 2, p.facial === 'fullbeard' ? 3.6 : 2.6, down, p.texture === 'wavy' ? 1.2 : 0.2, 86, FC, 'fb' + (++uid), { width: 0.55 });
      if (p.facial === 'fullbeard' && tex) {
        // Textured full beard: a clustered lower edge (not a row of identical circles).
        const low = pts.filter((q) => q[1] > 138), kind = p.texture === 'coily' ? 'coil' : 'curl';
        out += `<path d="${poly(curlEdge(low, p.texture === 'coily' ? 4 : 6, p.texture === 'coily' ? 1.6 : 2.4, 100, 130, 81, 1).concat([[100, 150]]))}" fill="${C.facial}"/>`;
        if (lv >= 2) out += hairTexture(pts, [100 - g.hw, 118, 100 + g.hw, 182], 1.5, kind, 82, Object.assign({}, C, { hair: C.facial }), 'fb' + (++uid));
      }
      if (lv >= 3) out += `<path d="${poly(pts)}" fill="none" stroke="${C.hairLine}" stroke-width="0.6" opacity="0.5"/>`;
    }
    if (p.facial === 'mustache' || p.facial === 'beard' || p.facial === 'fullbeard') {
      const m = sym([[100, my - ut - 4.4], [100 + mw * 0.55, my - ut - 4], [100 + mw + 1.4, my - 0.2], [100 + mw * 0.6, my - ut - 0.9], [100, my - ut - 0.4]]);
      const mp = cr(m, true, 7);
      out += `<path d="${poly(mp)}" fill="${C.facial}"/>`;
      // v2.3: hair strokes growing down and out from the centre of the lip.
      if (lv >= 2 && !tex) out += grain(mp, [100 - mw - 3, my - ut - 6, 100 + mw + 3, my + 1], 1.3, 2, (x) => [(x - 100) * 0.6, 1], 0, 87, FC, 'fm' + (++uid), { width: 0.45, noLight: true, darkOp: 0.55 });
    }
    return out;
  }

  // A fine loose strand (wisps, flyaways, tendrils; v2.3.2): a smooth line through the points, in the hair colour.
  const strand = (q, C, w, o) => `<path d="M${cr(q, false, 8).map(ptw).join('L')}" fill="none" stroke="${C.hair}" stroke-width="${w}" opacity="${o}" stroke-linecap="round"/>`;

  // A stray curl / coil (v2.3.2): a strand leaving p0 in direction (dx, dy) and looping n times (radius r) over len.
  const curlWisp = (p0, dx, dy, len, n, r, C, w, o) => {
    const m = Math.hypot(dx, dy) || 1, ux = dx / m, uy = dy / m, a = len / (2 * Math.PI * n), q = [];
    for (let i = 0; i <= n * 14; i++) { const th = 2 * Math.PI * i / 14, u = a * th + r * Math.sin(th) * 0.9, v = r * (1 - Math.cos(th)); q.push(ptw([p0[0] + ux * u - uy * v, p0[1] + uy * u + ux * v])); }
    return `<path d="M${q.join('L')}" fill="none" stroke="${C.hair}" stroke-width="${w}" opacity="${o}" stroke-linecap="round" stroke-linejoin="round"/>`;
  };

  function hair(p, g, C, lv, id) {
    if (p.covering === 'hijab' || p.covering === 'turban') return { back: '', front: '', over: '' };
    const hw = g.hw, st = p.hairStyle, tex = p.texture;
    const fill = lv >= 2 ? `url(#${id}h)` : C.hair;
    const outerR = (t, sY) => [[100 + hw + t * 0.35, sY], [100 + hw * 0.98 + t * 0.6, 70], [100 + hw * 0.76, 43 - t * 0.8]];
    const cap = (t, hy, tY, sY, hl, topX) => {
      const R = outerR(t, sY), L = R.slice().reverse().map(M), top = [[100 + (topX || 0), 36 - t]];
      const line = hl || [[100 - hw + 0.6, sY], [100 - hw * 0.92, tY], [100 - hw * 0.58, hy + 4], [100, hy], [100 + hw * 0.58, hy + 4], [100 + hw * 0.92, tY], [100 + hw - 0.6, sY]];
      return { outer: cr(R.concat(top, L), false, 8), pts: shape(R.concat(top, L), line), line: cr(line, false, 8) };
    };
    const P = (pts, fl) => `<path d="${poly(pts)}" fill="${fl || fill}"/>`;
    const B = (pts, r, step, fl) => `<g fill="${fl || C.hair}">${bumps(pts, r, step)}</g>`;
    let back = '', front = '', over = '', frontPts = null, outerPts = null;
    const hiArc = `<path d="M${f(100 - hw * 0.55)} 50 Q${f(100 - hw * 0.1)} 38 ${f(100 + hw * 0.35)} 44" fill="none" stroke="${light(C.hair, 16)}" stroke-width="3.5" opacity="0.4" stroke-linecap="round"/>`;
    const longBack = (bottom, flare) => { const r = [[100, 30], [100 + hw * 0.86, 38], [100 + hw + 9, 74], [100 + hw + 11 + flare * 0.5, 120], [100 + hw + 12 + flare, bottom]]; return shape(r, [[100 + hw + 12 + flare, bottom], [100, bottom + 3], [100 - hw - 12 - flare, bottom]], r.slice().reverse().map(M)); };
    const curtains = (bottom, flare) => {
      const R = [[100 + hw + 11 + flare, bottom], [100 + hw + 10 + flare * 0.5, 120], [100 + hw + 8, 74], [100 + hw * 0.85, 37]];
      const L = R.slice().reverse().map(M);
      const inner = [[100 - hw - 11 - flare + 13, bottom], [100 - hw + 1, 120], [100 - hw * 0.85, 80], [100 - hw * 0.4, 62], [94, 54]];
      const inner2 = [[94, 54], [100 + hw * 0.3, 58], [100 + hw * 0.85, 76], [100 + hw - 1, 120], [100 + hw + 11 + flare - 13, bottom]];
      return shape(R.concat([[96, 30]], L), inner, inner2);
    };
    switch (st) {
      case 'buzz': {
        // Buzz (v2.3): close-cropped hair with skin showing through, a fine grain that matches the hair type (tiny coils /
        // curls for curly and coily hair, short strokes for straight and wavy) and a soft, slightly uneven hairline.
        const textured = tex === 'curly' || tex === 'coily';
        const c = cap(1.4, 60, 74, 100), line = curlEdge(c.line, 2.4, 0.45, 100, 30, 101, 1), pts = c.outer.concat(line);
        frontPts = pts;
        front = P(pts, mix(C.hair, C.skin, 0.38));
        if (lv >= 2) {
          const tone = { dark: mix(C.hair, C.skin, 0.12), light: light(mix(C.hair, C.skin, 0.3), 8), darkOp: 0.75, lightOp: 0.35 };
          front += textured
            ? grain(pts, [100 - hw - 4, 32, 100 + hw + 4, 100], 1.5, 0, () => [0, 1], 0, 102, C, id + 'hg', tone)
            : grain(pts, [100 - hw - 4, 32, 100 + hw + 4, 100], 1.7, 1.5, (x, y) => [x - 100, y - 20], 0, 102, C, id + 'hg', Object.assign({ width: 0.5 }, tone));
          front += `<path d="${poly(pts)}" fill="none" stroke="${mix(C.hair, C.skin, 0.25)}" stroke-width="0.8" opacity="0.5"/>`;
        }
        break;
      }
      case 'bald': {
        // Bald / receding (v2.3): a short fringe of hair hugging the sides of the head from the temples down past the ear
        // tops, thinning toward the top edge; a soft sheen on the scalp.
        const tex2 = tex === 'curly' || tex === 'coily';
        for (const sd of [-1, 1]) {
          // Tapered at both ends; in front, a strip on the temple and down past the ear top; behind the ears, a rim of hair
          // just outside the head outline (so the ears stay in front of it).
          const o = [[100 + sd * (hw * 0.95 - 0.5), 88], [100 + sd * (hw - 0.8), 98], [100 + sd * (hw - 1.4), 108], [100 + sd * (hw - 2.6), 116]];
          const i2 = [[100 + sd * (hw - 4.6), 114], [100 + sd * (hw - 5.6), 106], [100 + sd * (hw - 5), 98], [100 + sd * (hw * 0.95 - 1.2), 89]];
          const band = cr(o, false, 6).concat(curlEdge(cr(i2, false, 6), 2.2, 0.4, 100 + sd * (hw + 6), 104, 110 + sd, -1));
          const rimPts = cr([[100 + sd * (hw - 2), 90], [100 + sd * (hw + 2.6), 98], [100 + sd * (hw + 3.4), 116], [100 + sd * (hw * 0.97 + 2), 136], [100 + sd * (hw * 0.97 - 2), 136], [100 + sd * (hw - 2), 110]], true, 6);
          back += P(curlEdge(rimPts, 2.4, 0.45, 100, 115, 113 + sd, 1), mix(C.hair, C.skin, 0.25));
          front += P(band, mix(C.hair, C.skin, 0.3));
          if (lv >= 2) front += grain(band, [100 + sd * hw - 9, 78, 100 + sd * hw + 9, 128], 1.4, tex2 ? 0 : 1.6, () => [sd * 0.3, 1], 0, 111 + sd, C, id + 'hg' + (sd + 1),
            { dark: mix(C.hair, C.skin, 0.05), light: light(C.hair, 10), darkOp: 0.7, lightOp: 0.3, width: 0.5 });
        }
        if (lv >= 2) front += `<ellipse cx="${f(100 - hw * 0.25)}" cy="50" rx="${f(hw * 0.38)}" ry="9" fill="${light(C.skin, 7)}" opacity="0.35"/>`;
        break;
      }
      case 'crop': {
        // Short crop (v2.3): close to the head, short strands growing forward and down from the crown, a soft hairline.
        const c = cap(3.4, 63, 76, 98, [[100 - hw + 0.6, 98], [100 - hw * 0.92, 76], [100 - hw * 0.6, 64.5], [100, 63.5], [100 + hw * 0.6, 64.5], [100 + hw * 0.92, 76], [100 + hw - 0.6, 98]]);
        const line = curlEdge(c.line, 2.8, tex === 'wavy' ? 0.9 : 0.6, 100, 30, 121, 1), pts = c.outer.concat(line);
        frontPts = pts; front = P(pts);
        if (lv >= 2) front += grain(pts, [100 - hw - 6, 30, 100 + hw + 6, 100], 2.6, 4, (x, y) => [x - 100, y - 22], tex === 'wavy' ? 1.2 : 0.2, 122, C, id + 'hg') + hiArc + rim(pts, C, 1);
        break;
      }
      case 'sidepart': {
        // Side part (v2.3): taller, with a visible part; strands combed away from it, the fringe swept down across the
        // forehead and ending in soft tips rather than a hard cut.
        const c = cap(12, 60, 74, 96, [[100 - hw + 0.6, 96], [100 - hw * 0.93, 72], [100 - hw * 0.5, 54], [100 - hw * 0.38, 50], [100 - hw * 0.05, 61], [100 + hw * 0.4, 71], [100 + hw * 0.8, 81], [100 + hw - 0.6, 94]], 12);
        const line = curlEdge(c.line, 3.6, tex === 'wavy' ? 1.3 : 0.9, 100 - hw * 0.2, 30, 131, 1), pts = c.outer.concat(line);
        frontPts = pts; front = P(pts);
        const px = 100 - hw * 0.38;
        if (lv >= 2) {
          front += grain(pts, [100 - hw - 14, 22, 100 + hw + 14, 98], 2.8, 6, (x, y) => (x < px ? [-1, 0.9] : [1, 0.35 + (y - 40) / 80]), tex === 'wavy' ? 1.2 : 0.25, 132, C, id + 'hg');
          front += hiArc + rim(pts, C, 1);
        }
        front += `<path d="M${f(px)} 51 Q${f(100 - hw * 0.36)} 38 ${f(100 - hw * 0.26)} 25" fill="none" stroke="${C.hairLine}" stroke-width="1.3" opacity="0.85" stroke-linecap="round"/>`;
        break;
      }
      case 'curly_short': case 'coils_short': {
        // Short natural hair: a close, rounded mass with a softly clustered outline and a fine, slightly uneven hairline.
        const coil = st === 'coils_short', kind = coil ? 'coil' : 'curl', c = cap(coil ? 8 : 10, 62, 77, 99);
        const outer = clumpEdge(c.outer, kind, 100, 96, 31, 1, coil ? 0.75 : 0.8);
        const line = curlEdge(c.line, coil ? 2.6 : 4.2, coil ? 0.7 : 1.2, 100, 30, 32, 1);
        const pts = outer.concat(line);
        frontPts = pts; outerPts = outer;
        front = P(pts);
        if (lv >= 2) front += hairTexture(pts, [100 - hw - 12, 24, 100 + hw + 12, 84], coil ? 1.3 : 1.2, kind, 33, C, id + 'ht') + rim(pts, C, 1.2);
        break;
      }
      case 'bangs': case 'bob': {
        // Bob: chin-length, full at the sides, ends curving in toward the jaw. 'bangs' has a soft, uneven fringe;
        // 'bob' has a side part with the hair swept across the forehead.
        // Rounded crown; sides fall full and straight; the ends round under toward the jaw, and the back edge rises
        // behind the neck, so there is no flat shelf at the bottom.
        const R = [[100, 24], [100 + hw * 0.68, 26], [100 + hw + 8, 43], [100 + hw + 14, 72], [100 + hw + 16, 106], [100 + hw + 15, 136],
          [100 + hw + 12, 151], [100 + hw + 5, 158], [100 + hw - 3, 157]];
        const bp = shape(R, [[100 + hw - 3, 157], [100 + hw * 0.55, 153], [100, 149], [100 - hw * 0.55, 153], [100 - hw + 3, 157]], R.slice().reverse().map(M));
        const oR = R.slice(1).reverse();   // right outer edge, bottom → crown
        const inner = st === 'bangs'
          ? [[100 - hw + 3, 156], [100 - hw - 0.5, 140], [100 - hw + 0.5, 108], [100 - hw * 0.9, 88], [100 - hw * 0.72, 83.5], [100 - hw * 0.5, 81], [100 - hw * 0.28, 83], [100 - hw * 0.06, 80.5],
            [100 + hw * 0.18, 82.5], [100 + hw * 0.42, 80.5], [100 + hw * 0.66, 83], [100 + hw * 0.88, 87], [100 + hw - 0.5, 108], [100 + hw + 0.5, 140], [100 + hw - 3, 156]]
          : [[100 - hw + 3, 156], [100 - hw - 0.5, 140], [100 - hw + 0.5, 108], [100 - hw * 0.94, 84], [100 - hw * 0.7, 66], [100 - hw * 0.42, 55], [100 - hw * 0.18, 60], [100 + hw * 0.2, 68],
            [100 + hw * 0.55, 77], [100 + hw * 0.84, 90], [100 + hw - 0.5, 112], [100 + hw + 0.5, 140], [100 + hw - 3, 156]];
        let pts = shape(oR.concat([[100, 24]], oR.slice().reverse().map(M)), inner), bpts = bp;
        if (tex === 'wavy') { pts = wave(pts, 2, 0.22, 92); bpts = wave(bp, 2.2, 0.22, 92); }
        back = P(bpts); frontPts = pts; front = P(pts);
        if (lv >= 2) {
          // Strands following the shape, a sheen across the crown, and the part (bob) or fringe separations (bangs).
          const sh = shade(C.hair, 10), lt = light(C.hair, lstar(C.hair) < 25 ? 14 : 9);
          let d = '';
          for (const s of [-1, 1]) for (let k = 0; k < 4; k++) {
            const x0 = 100 + s * hw * (0.25 + 0.17 * k), x1 = 100 + s * (hw + 3 + 3 * k);
            d += `M${pt([x0, 34 + 3 * k])}Q${pt([100 + s * (hw + 6 + 2.2 * k), 70 + 4 * k])} ${pt([x1, 150 - 4 * k])}`;
          }
          front += `<clipPath id="${id}hb"><path d="${poly(pts)}"/></clipPath><g clip-path="url(#${id}hb)" fill="none" stroke-linecap="round">` +
            `<path d="${d}" stroke="${sh}" stroke-width="0.9" opacity="0.45"/>` +
            `<path d="M${pt([100 - hw * 0.62, 48])}Q${pt([100 - hw * 0.05, 30])} ${pt([100 + hw * 0.55, 44])}" stroke="${lt}" stroke-width="5" opacity="0.35"/>` +
            `<path d="M${pt([100 - hw - 6, 120])}Q${pt([100 - hw - 9, 138])} ${pt([100 - hw - 4, 154])}M${pt([100 + hw + 6, 120])}Q${pt([100 + hw + 9, 138])} ${pt([100 + hw + 4, 154])}" stroke="${lt}" stroke-width="2.4" opacity="0.28"/></g>`;
          if (st === 'bangs') {
            let fr = '';
            for (const x of [-0.6, -0.38, -0.17, 0.06, 0.3, 0.54, 0.76]) fr += `M${pt([100 + hw * x, 81.5])}Q${pt([100 + hw * (x - 0.03), 72])} ${pt([100 + hw * (x - 0.07), 62])}`;
            front += `<path d="${fr}" fill="none" stroke="${sh}" stroke-width="0.8" opacity="0.5" stroke-linecap="round"/>`;
          } else {
            front += `<path d="M${pt([100 - hw * 0.42, 56])}Q${pt([100 - hw * 0.4, 42])} ${pt([100 - hw * 0.3, 28])}" fill="none" stroke="${C.hairLine}" stroke-width="1.3" opacity="0.8" stroke-linecap="round"/>`;
          }
          front += rim(pts, C, 1);
        }
        break;
      }
      case 'shoulder': case 'long': case 'curly_long': {
        const curly = st === 'curly_long';
        const bottom = st === 'shoulder' ? 162 : 204, flare = curly ? 10 : tex === 'wavy' ? 3 : 0;
        let bp = longBack(bottom, flare), fp = curtains(bottom - 8, flare);
        if (tex === 'wavy') { bp = wave(bp, 2.6, 0.2, 90); fp = wave(fp, 2.2, 0.2, 90); }
        if (curly) {
          // Long curls: ringlet clusters along every edge, ringlet texture inside.
          bp = clumpEdge(bp, 'curl', 100, 110, 41, 1);
          fp = clumpEdge(fp.concat([fp[0]]), 'curl', 100, 70, 42, 1, 0.85).slice(0, -1);
          back = P(bp); front = P(fp); frontPts = fp;
          if (lv >= 2) {
            back += hairTexture(bp, [100 - hw - 26, 30, 100 + hw + 26, bottom], 1, 'curl', 43, C, id + 'hk');
            front += hairTexture(fp, [100 - hw - 22, 26, 100 + hw + 22, bottom], 1, 'curl', 44, C, id + 'ht') + rim(fp, C, 1.1);
          }
        } else {
          // Straight / wavy shoulder length and long (v2.3): the ends finish in soft, uneven tips with rounded outer
          // corners instead of a square-cut edge; strands follow the hair from the crown down; sheen on the crown and
          // down each side.
          const rs = rng(st === 'long' ? 141 : 142);
          const tips = (x0, x1, y, n, depth) => {
            const out = [];
            for (let k = 1; k < n; k++) { const t = k / n, edge = Math.sin(Math.PI * t); out.push([x0 + (x1 - x0) * t, y + edge * (k % 2 ? depth * (0.6 + 0.5 * rs()) : depth * 0.15)]); }
            return out;
          };
          const ox = hw + 12 + flare, by2 = bottom;
          const rb = [[100, 30], [100 + hw * 0.86, 38], [100 + hw + 9, 74], [100 + hw + 11 + flare * 0.5, 120], [100 + ox, by2 - 10], [100 + ox - 3, by2 - 2]];
          bp = shape(rb, [[100 + ox - 3, by2 - 2]].concat(tips(100 + ox - 3, 100 - ox + 3, by2, 26, 5)).concat([[100 - ox + 3, by2 - 2]]), rb.slice().reverse().map(M));
          // Front curtains with tipped ends.
          const cb = bottom - 8, co = hw + 11 + flare, ci = co - 13;
          const R = [[100 + co - 2, cb - 3], [100 + co, cb - 12], [100 + hw + 10 + flare * 0.5, 120], [100 + hw + 8, 74], [100 + hw * 0.85, 37]];
          const L = R.slice().reverse().map(M);
          const inner = [[100 - ci, cb - 1], [100 - hw + 1, 120], [100 - hw * 0.85, 80], [100 - hw * 0.4, 62], [94, 54]];
          const inner2 = [[94, 54], [100 + hw * 0.3, 58], [100 + hw * 0.85, 76], [100 + hw - 1, 120], [100 + ci, cb - 1]];
          fp = shape(R.concat([[96, 30]], L), tips(100 - co + 2, 100 - ci, cb, 4, 5).concat([[100 - ci, cb - 1]]), inner, inner2, tips(100 + ci, 100 + co - 2, cb, 4, 5).concat([[100 + co - 2, cb - 3]]));
          if (tex === 'wavy') { bp = wave(bp, 2.6, 0.2, 90); fp = wave(fp, 2.2, 0.2, 90); }
          back = P(bp); front = P(fp); frontPts = fp;
          if (lv >= 2) {
            const sh = shade(C.hair, lstar(C.hair) < 25 ? 4 : 11), lt = light(C.hair, lstar(C.hair) < 25 ? 15 : 9);
            const line = (pts) => { let q = cr(pts, false, 8); if (tex === 'wavy') q = wave(q, 2.2, 0.2, 90); return 'M' + q.map(ptw).join('L'); };
            let d = '', db = '';
            for (const sd of [-1, 1]) {
              for (let k = 0; k < 6; k++) d += line([[100 + sd * hw * (0.12 + 0.13 * k), 33 + 2 * k], [100 + sd * (hw + 3 + 1.6 * k), 82 + 4 * k], [100 + sd * (hw + 4 + 1.5 * k + flare * 0.5), 130], [100 + sd * (hw + 3 + 1.8 * k + flare), cb - 2 - 4 * rs()]]);
              for (let k = 0; k < 4; k++) db += line([[100 + sd * (hw - 2 + 3.5 * k), 120], [100 + sd * (hw - 1 + 3.8 * k + flare * 0.5), by2 - 6 - 4 * rs()]]);
            }
            back += `<clipPath id="${id}hl"><path d="${poly(bp)}"/></clipPath><g clip-path="url(#${id}hl)" fill="none" stroke-linecap="round"><path d="${db}" stroke="${sh}" stroke-width="0.8" opacity="0.4"/></g>`;
            front += `<clipPath id="${id}hb"><path d="${poly(fp)}"/></clipPath><g clip-path="url(#${id}hb)" fill="none" stroke-linecap="round">` +
              `<path d="${d}" stroke="${sh}" stroke-width="0.85" opacity="0.45"/>` +
              `<path d="${line([[100 - hw - 5, 92], [100 - hw - 7, 130], [100 - hw - 6, cb - 10]])}${line([[100 + hw + 5, 92], [100 + hw + 7, 130], [100 + hw + 6, cb - 10]])}" stroke="${lt}" stroke-width="2.4" opacity="0.28"/></g>` +
              hiArc + rim(fp, C, 1);
          }
        }
        break;
      }
      case 'curly_mid': {
        // Medium curls / coils: a full, rounded mass to the jaw, curls framing the face.
        const coil = tex === 'coily', kind = coil ? 'coil' : 'curl';
        // Rounded: fullest at the temples, narrowing a little toward the jaw.
        const r = [[100, 18], [100 + hw * 0.72, 21], [100 + hw + 12, 38], [100 + hw + 21, 68], [100 + hw + 24, 100], [100 + hw + 19, 132], [100 + hw + 10, 150]];
        let bp = shape(r, [[100 + hw + 11, 150], [100, 144], [100 - hw - 11, 150]], r.slice().reverse().map(M));
        bp = clumpEdge(bp, kind, 100, 88, 51, 1);
        const oR = [[100 + hw + 10, 128], [100 + hw + 17, 96], [100 + hw * 0.98 + 10, 60], [100 + hw * 0.8, 29]];
        const innerRaw = [[100 - hw + 1, 128], [100 - hw * 0.96, 92], [100 - hw * 0.62, 67], [100, 63], [100 + hw * 0.62, 67], [100 + hw * 0.96, 92], [100 + hw - 1, 128]];
        const outer = clumpEdge(cr(oR.concat([[100, 20]], oR.slice().reverse().map(M)), false, 8), kind, 100, 88, 52, 1, 0.9);
        const inner = curlEdge(cr(innerRaw, false, 8), coil ? 4 : 6.5, coil ? 1.3 : 2.2, 100, 112, 53, -1);
        const fp = outer.concat(inner);
        back = P(bp); frontPts = fp; front = P(fp);
        if (lv >= 2) {
          back += hairTexture(bp, [100 - hw - 26, 18, 100 + hw + 26, 150], 1, kind, 54, C, id + 'hk');
          front += hairTexture(fp, [100 - hw - 20, 18, 100 + hw + 20, 130], 1, kind, 55, C, id + 'ht') + rim(fp, C, 1.1);
        }
        break;
      }
      case 'afro': {
        // A full rounded afro with an uneven, cloud-like edge; coils (or curls) through the whole mass.
        const coil = tex === 'coily', kind = coil ? 'coil' : 'curl';
        let el = lumpy(100, 82, hw + 27, 63, 90, 61, 0.03);
        el = clumpEdge(el, kind, 100, 82, 62, 1);
        back = P(el); outerPts = el;
        const c = cap(2, 63, 78, 102);
        const line = curlEdge(c.line, coil ? 2.6 : 4, coil ? 0.75 : 1.2, 100, 30, 63, 1);
        const fpts = c.outer.concat(line);
        frontPts = fpts; front = P(fpts);
        if (lv >= 2) {
          // Shade toward the bottom of the mass (where it turns away from the light), coils over all of it.
          back += `<clipPath id="${id}ha"><path d="${poly(el)}"/></clipPath><g clip-path="url(#${id}ha)"><ellipse cx="100" cy="128" rx="${f(hw + 30)}" ry="34" fill="${shade(C.hair, 8)}" opacity="0.55"/></g>`;
          back += hairTexture(el, [100 - hw - 32, 14, 100 + hw + 32, 148], 1, kind, 64, C, id + 'hk') + rim(el, C, 1.4);
          front += hairTexture(fpts, [100 - hw, 30, 100 + hw, 80], 1, kind, 65, C, id + 'ht');
        }
        break;
      }
      case 'bun': {
        const textured = tex === 'curly' || tex === 'coily';
        const c = cap(textured ? 3.5 : 5, 60, 75, 96); frontPts = c.pts;
        if (textured) {
          // Puff: a rounded, clustered puff on the crown, the hair smoothed up toward it.
          const coil = tex === 'coily';
          let pf = lumpy(100, 22, 22, 19, 60, 71, 0.04);
          pf = clumpEdge(pf, coil ? 'coil' : 'curl', 100, 22, 72, 1, 0.75);
          back = P(pf) + (lv >= 2 ? hairTexture(pf, [76, 0, 124, 44], 1.2, coil ? 'coil' : 'curl', 73, C, id + 'hk') + rim(pf, C, 1.2) : '');
          const line = curlEdge(c.line, 2.4, 0.6, 100, 30, 74, 1);
          const pts = c.outer.concat(line);
          frontPts = pts; front = P(pts);
          if (lv >= 2) {
            let d = '';
            for (let k = -3; k <= 3; k++) d += `M${pt([100 + k * hw * 0.27, 63 - Math.abs(k) * 0.8])}Q${pt([100 + k * hw * 0.2, 48])} ${pt([100 + k * 3, 37])}`;
            front += `<path d="${d}" fill="none" stroke="${C.hairLine}" stroke-width="0.7" opacity="0.22" stroke-linecap="round"/>` + rim(pts, C, 1);
          }
          // Wisps (v2.3.2): stray curls / coils standing out from the edge of the puff, and a small loose curl at each
          // temple, so the puff looks soft rather than sculpted.
          const rw = rng(75), wc0 = lstar(C.hair) > 55 ? shade(C.hair, 10) : C.hair;
          for (let k = 0; k < 15; k++) {
            const a = Math.PI * (-0.1 + 1.2 * (k + 0.2 + 0.6 * rw()) / 15), ca = Math.cos(a), sa = Math.sin(a), sd = rw() < 0.5 ? 1 : -1;
            const p0 = [100 + 21 * ca, 22 - 18 * sa];
            back += curlWisp(p0, ca + sd * 0.4 * sa, -sa + sd * 0.4 * ca, coil ? 3 + 2 * rw() : 4.5 + 2.5 * rw(), coil ? 2 : 1, coil ? 0.9 : 1.4, { hair: wc0 }, 0.55, 0.85);
          }
          const wc = lstar(C.hair) > 55 ? shade(C.hair, 10) : C.hair;
          for (const sd of [-1, 1]) for (const [dx, n0, w] of [[0, coil ? 7 : 5, 1.1], [-2.6, coil ? 4 : 3, 0.8]]) {
            const x0 = 100 + sd * (hw - 2 + dx), y0 = 88, q = [[x0, y0]], n = n0, step = coil ? 2.2 : 3.2;
            for (let i = 1; i <= n; i++) q.push([x0 + sd * (0.8 + (i % 2 ? 1.5 : -1.2) * (coil ? 1 : 1.5)), y0 + i * step]);
            front += strand(q, { hair: wc }, w, 0.9);
          }
        } else {
          // Straight / wavy bun (v2.3): hair drawn smoothly back toward the crown with strands converging on the bun; the
          // bun is a slightly flattened, wrapped coil (wrap lines spiralling round it, shaded underneath) sitting on top,
          // with a band where it meets the head. Wavy hair gets gently waving strands.
          const wavy = tex === 'wavy', sh = shade(C.hair, 11), lt = light(C.hair, lstar(C.hair) < 25 ? 15 : 10);
          const bx = 100, by = 20, rx = 21, ry = 15.5;
          const bun = lumpy(bx, by, rx, ry, 64, 77, 0.025);
          back = P(bun);
          if (lv >= 2) {
            let wrap = '';
            // Wrap lines: arcs of a spiral, each a little smaller and higher than the last.
            for (let k = 0; k < 5; k++) {
              const s = 1 - k * 0.17, cy = by + 1.5 - k * 0.9, a0 = (k % 2 ? 0.25 : 0.05) * Math.PI, a1 = Math.PI * (k % 2 ? 0.95 : 1.1);
              const p0 = [bx + rx * s * Math.cos(Math.PI + a0), cy - ry * s * 0.75 * Math.sin(a0)], p1 = [bx + rx * s * Math.cos(Math.PI + a1), cy - ry * s * 0.75 * Math.sin(a1)];
              wrap += `M${pt(p0)}Q${pt([bx + (k % 2 ? 4 : -4), cy - ry * s * 1.35])} ${pt(p1)}`;
            }
            back += `<clipPath id="${id}bn"><path d="${poly(bun)}"/></clipPath><g clip-path="url(#${id}bn)">` +
              `<ellipse cx="${bx}" cy="${by + ry * 0.75}" rx="${rx + 2}" ry="${ry * 0.6}" fill="${sh}" opacity="0.55"/>` +
              `<path d="${wrap}" fill="none" stroke="${sh}" stroke-width="1" opacity="0.75" stroke-linecap="round"/>` +
              `<path d="M${pt([bx - rx * 0.6, by - ry * 0.35])}Q${pt([bx - rx * 0.1, by - ry * 0.95])} ${pt([bx + rx * 0.45, by - ry * 0.55])}" fill="none" stroke="${lt}" stroke-width="2.6" opacity="0.45" stroke-linecap="round"/></g>` +
              rim(bun, C, 1);
          }
          // Front: the hair pulled back, with a softly uneven hairline.
          const line = curlEdge(c.line, 5, 0.5, 100, 30, 78, 1);
          const pts = c.outer.concat(line);
          frontPts = pts; front = P(pts);
          if (lv >= 2) {
            let d = '';
            // Strands from the hairline sweep up and back; they fade out over the curve of the head at different heights
            // (they don't all meet at one point).
            const rs = rng(79);
            for (let k = -6; k <= 6; k++) {
              const ak = Math.abs(k) / 6, x0 = 100 + k * hw * 0.15 + (rs() - 0.5) * 3, y0 = 60 + ak * 3 + Math.pow(ak, 3) * 12 - rs() * 5;
              const x1 = 100 + k * hw * 0.1, y1 = 39 + rs() * 5 + ak * 4, xm = (x0 + x1) / 2 + k * 0.4, ym = (y0 + y1) / 2;
              d += wavy ? `M${pt([x0, y0])}C${pt([xm + 2.2, ym + 4])} ${pt([xm - 2.2, ym - 3])} ${pt([x1, y1])}` : `M${pt([x0, y0])}Q${pt([xm, ym])} ${pt([x1, y1])}`;
            }
            front += `<clipPath id="${id}hb"><path d="${poly(pts)}"/></clipPath><g clip-path="url(#${id}hb)" fill="none" stroke-linecap="round">` +
              `<path d="${d}" stroke="${sh}" stroke-width="0.75" opacity="0.32"/>` +
              `<path d="M${pt([100 - hw * 0.7, 52])}Q${pt([100 - hw * 0.15, 36])} ${pt([100 + hw * 0.45, 44])}" stroke="${lt}" stroke-width="4" opacity="0.32"/></g>` +
              // the band where the bun meets the head
              `<path d="M${pt([bx - 9, 34.5])}Q${pt([bx, 31])} ${pt([bx + 9, 34.5])}" fill="none" stroke="${shade(C.hair, 18)}" stroke-width="2.6" stroke-linecap="round" opacity="0.85"/>` +
              rim(pts, C, 1);
          }
          // Wisps (v2.3.2): a few loose tendrils falling at each temple in front of the ear (longer on one side), fine
          // strands lifting off the head and the bun in soft loops that break the outline, and short baby hairs along
          // the hairline, so the updo looks soft and lived-in rather than sculpted.
          const rw = rng(80), sw = wavy ? 2.4 : 1.4, wc = lstar(C.hair) > 55 ? shade(C.hair, 10) : C.hair;
          // loops: a run of outline points pushed outward (away from cx, cy) by up to h, back to the outline at both ends
          const loop = (pts, cx, cy, h) => pts.map(([x, y], i) => { const t = i / (pts.length - 1), m = Math.hypot(x - cx, y - cy) || 1, e = h * Math.sin(Math.PI * t); return [x + (x - cx) / m * e, y + (y - cy) / m * e]; });
          const ell = (cx, cy, ex, ey, a0, a1, n) => { const o = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; o.push([cx + ex * Math.cos(a), cy - ey * Math.sin(a)]); } return o; };
          for (const sd of [-1, 1]) {
            const lf = sd > 0 ? 1 : 0.78;
            for (const [dx, dy, ln, w, o] of [[0, 0, 40, 1.1, 0.95], [-2.4, -4, 31, 0.75, 0.85], [1.8, 2, 24, 0.6, 0.75]]) {
              const x0 = 100 + sd * (hw - 3 + dx), y0 = 86 + dy, L = ln * lf;
              front += strand([[x0, y0], [x0 + sd * (1.2 + sw), y0 + L * 0.3], [x0 + sd * (1.6 - sw), y0 + L * 0.64], [x0 + sd * (2.6 + sw * 0.7), y0 + L]], { hair: wc }, w, o);
            }
            if (lv >= 2) {
              let d = '';
              for (let k = 0; k < 5; k++) {
                const t = 0.15 + 0.17 * k + 0.05 * rw(), x = 100 + sd * hw * (0.45 + 0.5 * t), y = 62 + 30 * t * t;
                d += `M${pt([x, y - 1.5])}q${f(sd * 0.8)} 1.6 ${f(sd * (1.6 + rw()))} ${f(2.6 + rw() * 1.5)}`;
              }
              front += `<path d="${d}" fill="none" stroke="${wc}" stroke-width="0.45" opacity="0.7" stroke-linecap="round"/>`;
            }
          }
          if (lv >= 2) {
            // loops off the head, along the hair outline between the bun and the temples
            const N = c.outer.length;
            for (const [u0, u1, h] of [[0.14, 0.22, 2.2], [0.25, 0.33, 2.8], [0.3, 0.36, 1.4], [0.64, 0.7, 1.5], [0.67, 0.75, 2.6], [0.78, 0.86, 2]]) {
              front += strand(loop(c.outer.slice(Math.round(N * u0), Math.round(N * u1) + 1), 100, 80, h), { hair: wc }, 0.5, 0.85);
            }
            // loops off the bun
            for (const [a0, a1, h] of [[0.05, 0.22, 2.6], [0.3, 0.42, 1.8], [0.55, 0.7, 2.4], [0.78, 0.95, 2], [0.15, 0.3, 1.2], [0.62, 0.8, 1.3]]) {
              back += strand(loop(ell(bx, by, rx * 0.97, ry * 0.97, Math.PI * a0, Math.PI * a1, 8), bx, by, h), { hair: wc }, 0.5, 0.85);
            }
          }
        }
        break;
      }
      case 'braids': case 'locs': {
        // v2.3: every loc / braid is its own rope (rope()): width that varies along it (locs) or stays even (braids),
        // an outline so overlapping ropes stay separate, a highlight on the lit side, and texture along it (knobbly
        // ticks for locs, a plait pattern for braids). A centre part; ropes from the part cover the scalp, frame the
        // face and fall behind the shoulders, with a few in front. Locs fall to the shoulders, braids to the chest.
        const locs = st === 'locs', c = cap(locs ? 6 : 4, 61, 76, 100), r = rng(locs ? 91 : 92);
        const W0 = locs ? 7.2 : 3.9, bottom = locs ? 190 : 214;
        const scalp = shade(C.hair, locs ? 10 : 6);
        frontPts = c.pts;
        // Full volume behind the ropes, in a deeper shade of the hair colour, so the spaces between ropes read as more
        // hair further back (not as gaps). Its lower edge is uneven and sits under the rope ends.
        {
          const mb = locs ? 198 : 236, rv = [[100, 30], [100 + hw * 0.86, 38], [100 + hw + 10, 74], [100 + hw + 15, 120], [100 + hw + 19, mb - 6]];
          const low = []; for (let x = hw + 19; x >= -(hw + 19); x -= 6) low.push([100 + x, mb + (r() - 0.5) * 8]);
          back = P(shape(rv, low, rv.slice().reverse().map(M)), shade(C.hair, 12));
        }
        // Behind the neck: ropes hanging from the back of the head, visible between the neck and the side ropes.
        const nn = locs ? 5 : 8;
        for (const sd of [-1, 1]) for (let j = 0; j < nn; j++) {
          back += rope([[100 + sd * hw * (0.5 + 0.06 * j), 112], [100 + sd * (26 + j * (locs ? 6 : 3.4)), 150],
            [100 + sd * (25 + j * (locs ? 6.5 : 3.6)), 232]], W0 * (0.85 + 0.3 * r()), 700 + j + 50 * (sd + 1), lv);
        }
        // Behind the shoulders: ropes from the sides and back of the head.
        const nb = locs ? 10 : 16;
        for (const sd of [-1, 1]) for (let j = nb - 1; j >= 0; j--) {
          const q = j / (nb - 1), end = (locs ? 214 : 232) - r() * 8 - (j % 2) * 4;   // ends hidden behind the shoulders
          back += rope([[100 + sd * (hw * 0.86 + q * 4), 62 + 10 * q], [100 + sd * (hw * 0.92 + 3 + q * 7), 78 + 8 * q],
            [100 + sd * (hw + 6 + q * 12 + r() * 2), 128], [100 + sd * (hw + 5 + q * 17 + r() * 3), end]], W0 * (0.85 + 0.3 * r()), j + 100 * (sd + 1), lv);
        }
        // Over the head: from the part to the sides, the front-most ones framing the face (drawn back to front).
        front = P(c.pts, scalp);
        if (!locs && lv >= 2) {
          // Box braids: parted sections show between the braids near the part.
          const pc = mix(C.hair, C.skin, 0.55);
          let pd = `M${pt([100, 33])}L${pt([100, 61])}`;
          for (const sd of [-1, 1]) for (let k = 1; k <= 3; k++) pd += `M${pt([100 + sd * 1.5, 34 + k * 7])}Q${pt([100 + sd * hw * 0.3, 33 + k * 7.5])} ${pt([100 + sd * hw * 0.55, 38 + k * 8.5])}`;
          front += `<path d="${pd}" fill="none" stroke="${pc}" stroke-width="0.8" opacity="0.8"/>`;
        }
        const nc = locs ? 6 : 10;
        for (const sd of [-1, 1]) for (let k = 0; k < nc; k++) {
          // q = 0: the rope hugging the top of the head; q = 1: the one along the hairline.
          const q = k / (nc - 1), lerp2 = (a, b) => [a[0] + (b[0] - a[0]) * q, a[1] + (b[1] - a[1]) * q];
          const jt = k ? (r() - 0.5) * 3 : 0;
          const pts = [lerp2([100 + sd * 2, 32.5], [100 + sd * 3, 58]), lerp2([100 + sd * hw * 0.6, 35.5 + jt], [100 + sd * hw * 0.46, 64]),
            lerp2([100 + sd * (hw + 5), 60 + jt], [100 + sd * hw * 0.9, 78]), lerp2([100 + sd * (hw + 8), 110], [100 + sd * (hw - 0.5), 108]),
            lerp2([100 + sd * (hw + 9), bottom - 8 - r() * 8], [100 + sd * (hw + 1.5), (locs ? 168 : 190) + r() * 10])];
          front += rope(pts, W0 * (0.85 + 0.3 * r()), 300 + k + 50 * (sd + 1), lv);
        }
        // In front of the shoulders.
        const no = locs ? 4 : 6;
        for (const sd of [-1, 1]) for (let k = 0; k < no; k++) {
          over += rope([[100 + sd * (hw * 0.82 + k * 2), 72 + k * 4], [100 + sd * (hw + 1 + k * 2.4), 104], [100 + sd * (hw + (locs ? 2 : -1) + k * 3.4), 156],
            [100 + sd * (hw + (locs ? 1 : -5) + k * 4), (locs ? 204 : 236) - k * (locs ? 5 : 6) - r() * 5]], W0 * (0.85 + 0.3 * r()), 500 + k + 50 * (sd + 1), lv);
        }
        // One rope: a filled band around a centreline.
        function rope(ctrl, w, seed, lvl) {
          const rr = rng(seed * 7919 + (locs ? 1 : 2)), wk = walker(cr(ctrl, false, 6)), step = locs ? 2.3 : 2.8, u = 1.4 / step;
          const n = Math.max(4, Math.round(wk.total / step)), L = [], R = [], mid = [], ph1 = rr() * 6.3, ph2 = rr() * 6.3;
          const half = [];
          for (let i = 0; i <= n; i++) {
            const t = i / n, q = wk.at(t * wk.total), nx = -q[3], ny = q[2];
            let hwid = w / 2 * (locs ? 1 + 0.13 * Math.sin(t * wk.total / 5.5 + ph1) + 0.08 * Math.sin(t * wk.total / 2.3 + ph2) : 1);
            const tail = wk.total * (1 - t);
            if (tail < w * 1.1) hwid *= locs ? 0.78 + 0.22 * Math.sqrt(tail / (w * 1.1)) : 0.55 + 0.45 * (tail / (w * 1.1));
            if (t * wk.total < 3) hwid *= 0.82;
            L.push([q[0] + nx * hwid, q[1] + ny * hwid]); R.push([q[0] - nx * hwid, q[1] - ny * hwid]); mid.push([q[0], q[1], nx, ny]); half.push(hwid);
          }
          const body = poly(L.concat(R.reverse())), tone = light(C.hair, (rr() - 0.5) * (lstar(C.hair) < 25 ? 5 : 6));
          let out = `<path d="${body}" fill="${tone}" stroke="${C.hairLine}" stroke-width="${locs ? 0.7 : 0.55}" stroke-linejoin="round"/>`;
          if (lvl < 2) return out;
          const darkHair = lstar(C.hair) < 25, lt = light(C.hair, darkHair ? 16 : 10), dk = shade(C.hair, darkHair ? 5 : 14);
          // Highlight along the upper-left side.
          const side = mid[Math.floor(mid.length / 2)][2] < 0 ? 1 : -1;
          out += `<path d="M${mid.filter((m, i) => i % 2 === 0 || i === mid.length - 1).map((m, i2) => { const i = Math.min(mid.length - 1, i2 * 2); return ptw([m[0] + side * m[2] * half[i] * 0.42, m[1] + side * m[3] * half[i] * 0.42]); }).join('L')}" fill="none" stroke="${lt}" stroke-width="${f(w * 0.16)}" opacity="${darkHair ? 0.55 : 0.45}" stroke-linecap="round"/>`;
          let tex = '';
          if (locs) {
            // Knobbly texture: a few short curved ticks at irregular spacing (offset to either side, so they don't
            // read as rings), plus small coils scattered along the loc.
            let fine = '';
            for (let s = 1 + rr() * 3; s < mid.length - 2; s += (3.2 + rr() * 3.5) * u) {
              const i = Math.floor(s), m = mid[i], h = half[i] * (0.35 + 0.3 * rr()), off = (rr() - 0.5) * half[i] * 0.6, bow = (rr() - 0.5) * 1.6;
              const cx = m[0] + m[2] * off, cy = m[1] + m[3] * off;
              tex += `M${ptw([cx + m[2] * h, cy + m[3] * h])}Q${ptw([cx + m[3] * bow, cy - m[2] * bow + 0.9])} ${ptw([cx - m[2] * h, cy - m[3] * h])}`;
            }
            for (let s = 1 + rr() * 2; s < mid.length - 1; s += (2 + rr() * 2) * u) {
              const i = Math.floor(s), m = mid[i], off = (rr() - 0.5) * half[i] * 1.3, fr = 0.55 + 0.45 * rr(), a0 = rr() * 6.28;
              const q = W ? W([m[0] + m[2] * off, m[1] + m[3] * off]) : [m[0] + m[2] * off, m[1] + m[3] * off];
              fine += `M${f(q[0] + fr * Math.cos(a0))} ${f(q[1] + fr * Math.sin(a0))}A${f(fr)} ${f(fr)} 0 1 1 ${f(q[0] + fr * Math.cos(a0 + 4.2))} ${f(q[1] + fr * Math.sin(a0 + 4.2))}`;
            }
            out += `<path d="${tex}" fill="none" stroke="${dk}" stroke-width="0.6" opacity="0.38" stroke-linecap="round"/>` +
              `<path d="${fine}" fill="none" stroke="${lstar(C.hair) < 25 ? lt : dk}" stroke-width="0.45" opacity="0.4"/>`;
          } else {
            // Plait: alternating diagonal strokes from each edge to the centre a little further down.
            let k = 0;
            for (let i = 1; i + 1 < mid.length; i++, k++) {
              const a = mid[i], b = mid[i + 1], sd2 = k % 2 ? 1 : -1, h = half[i] * 0.95;
              tex += `M${ptw([a[0] + sd2 * a[2] * h, a[1] + sd2 * a[3] * h])}L${ptw([b[0] - sd2 * b[2] * h * 0.25, b[1] - sd2 * b[3] * h * 0.25])}`;
            }
            out += `<path d="${tex}" fill="none" stroke="${dk}" stroke-width="0.55" opacity="0.65" stroke-linecap="round"/>`;
          }
          return out;
        }
        break;
      }
    }
    // Level 3 texture inside the front hair shape.
    const ownTexture = ['curly_short', 'coils_short', 'curly_mid', 'afro', 'curly_long', 'bangs', 'bob', 'locs', 'braids', 'crop', 'sidepart', 'shoulder', 'long'].indexOf(st) >= 0 || (st === 'bun' && (tex === 'curly' || tex === 'coily'));
    if (lv >= 3 && frontPts && st !== 'buzz' && st !== 'bald' && !ownTexture) {
      const r = rng(11); let t = '';
      const textured = tex === 'curly' || tex === 'coily';
      for (let i = 0; i < 26; i++) {
        const x = 100 - hw + 2 * hw * r(), y = 38 + 50 * r();
        t += textured ? `<circle cx="${f(x)}" cy="${f(y)}" r="${f(1.2 + r())}" fill="none"/>` : `<path d="M${f(x)} ${f(y)} q${f(3 + 3 * r())} ${f(-2 - 2 * r())} ${f(7 + 4 * r())} ${f(1 * r())}" fill="none"/>`;
      }
      front += `<clipPath id="${id}hc"><path d="${poly(frontPts)}"/></clipPath><g clip-path="url(#${id}hc)" stroke="${C.hairLine}" stroke-width="0.5" opacity="0.35">${t}</g>`;
    }
    return { back, front, over };
  }

  function covering(p, g, C, lv, id) {
    const hw = g.hw, fill = lv >= 2 ? `url(#${id}c)` : C.cover, fold = shade(C.cover, 12);
    if (p.covering === 'hijab') {
      // Hijab (v2.3): fabric framing the face with a soft folded edge, gathering under the chin and draping over the
      // shoulders in folds; shaded under the chin. (Before: a flat hood flaring into a cape.)
      const outer = sym([[100, 23], [100 + hw * 0.8, 30], [100 + hw + 9, 60], [100 + hw + 12, 102], [100 + hw + 9, 140], [100 + hw + 14, 170],
        [100 + hw + 25, 196], [100 + hw + 33, 220], [181, 240], [100, 241]]);
      const inner = sym([[100, 59], [100 + hw * 0.78, 66], [100 + hw - 3, 96], [100 + hw - 5, 126], [100 + g.jawHW * 0.97, 150], [100 + g.chinHW + 2, 167], [100, 174]]);
      const ip = cr(inner, true, 7), op = cr(outer, true, 7);
      let s = `<path fill-rule="evenodd" d="${poly(op)}${poly(ip)}" fill="${fill}"/>`;
      if (lv >= 2) {
        const lt = light(C.cover, 9), dk = shade(C.cover, 14), cid = id + 'hj';
        const fold = (pts, w, o) => `<path d="M${cr(pts, false, 8).map(ptw).join('L')}" fill="none" stroke="${dk}" stroke-width="${w}" opacity="${o}" stroke-linecap="round"/>` +
          `<path d="M${cr(pts.map((q) => [q[0] - 1.4, q[1] - 0.6]), false, 8).map(ptw).join('L')}" fill="none" stroke="${lt}" stroke-width="${w * 0.7}" opacity="${o * 0.7}" stroke-linecap="round"/>`;
        s += `<clipPath id="${cid}"><path fill-rule="evenodd" clip-rule="evenodd" d="${poly(op)}${poly(ip)}"/></clipPath><g clip-path="url(#${cid})">`;
        // Shadow under the chin and toward the bottom of the drape.
        s += `<radialGradient id="${cid}g"><stop offset="0" stop-color="${dk}" stop-opacity="0.5"/><stop offset="1" stop-color="${dk}" stop-opacity="0"/></radialGradient>` +
          `<ellipse cx="100" cy="184" rx="${f(g.jawHW + 14)}" ry="22" fill="url(#${cid}g)"/>`;
        // Folded edge around the face: a lighter band just outside the opening, with a fold line on its outer side.
        s += `<path d="${poly(cr(sym([[100, 54], [100 + hw * 0.82, 62], [100 + hw + 1, 94], [100 + hw - 1, 126], [100 + g.jawHW + 3, 152], [100 + g.chinHW + 5, 171], [100, 179]]), true, 7))}" fill="none" stroke="${lt}" stroke-width="5" opacity="0.32"/>`;
        s += `<path d="${poly(cr(sym([[100, 51.5], [100 + hw * 0.84, 60], [100 + hw + 3.5, 94], [100 + hw + 1.5, 127], [100 + g.jawHW + 5.5, 154], [100 + g.chinHW + 7, 174], [100, 182.5]]), true, 7))}" fill="none" stroke="${dk}" stroke-width="1" opacity="0.5"/>`;
        // Folds: gathering under the chin, falling from the sides of the head over the shoulders.
        for (const sd of [-1, 1]) {
          s += fold([[100 + sd * 8, 182], [100 + sd * 16, 205], [100 + sd * 24, 238]], 1.3, 0.55);
          s += fold([[100 + sd * 18, 180], [100 + sd * 32, 206], [100 + sd * 44, 238]], 1.2, 0.5);
          s += fold([[100 + sd * (hw + 4), 140], [100 + sd * (hw + 12), 186], [100 + sd * (hw + 26), 236]], 1.4, 0.55);
          s += fold([[100 + sd * (hw + 8), 108], [100 + sd * (hw + 9), 140], [100 + sd * (hw + 18), 178]], 1, 0.4);
          s += fold([[100 + sd * hw * 0.5, 34], [100 + sd * (hw + 2), 58], [100 + sd * (hw + 6), 90]], 0.9, 0.35);
        }
        s += `</g>`;
      }
      return s;
    }
    if (p.covering === 'turban') {
      // Turban (v2.3): layered wraps crossing at the front in a series of V-shaped pleats that rise to a soft peak, each
      // wrap with a shadowed fold below and a lit edge above. (Before: a plain shape with three lines.)
      const pts = shape([[100 + hw + 3, 92], [100 + hw + 6, 64], [100 + hw * 0.78, 30], [106, 16], [100, 14], [94, 16], [100 - hw * 0.78, 30], [100 - hw - 6, 64], [100 - hw - 3, 92]],
        [[100 - hw - 3, 92], [100 - hw * 0.7, 77], [92, 70], [100, 74], [108, 70], [100 + hw * 0.7, 77], [100 + hw + 3, 92]]);
      let s = `<path d="${poly(pts)}" fill="${fill}"/>`;
      const dk = shade(C.cover, 15), lt = light(C.cover, 9), cid = id + 'tb';
      let dd = '', dl = '';
      // Pleats rise steeply from the sides to the front centre, where the layers from each side meet in a V.
      for (let k = 0; k < 5; k++) {
        const yc = 68 - k * 10.5, ys = 88 - k * 5.5;
        for (const sd of [-1, 1]) {
          const q = [[100 + sd * (hw + 5), ys], [100 + sd * hw * 0.5, yc + 8 - k * 0.6], [100 + sd * 1.5, yc]];
          dd += 'M' + cr(q, false, 8).map(ptw).join('L');
          dl += 'M' + cr(q.map((v) => [v[0], v[1] - 1.6]), false, 8).map(ptw).join('L');
        }
      }
      s += `<clipPath id="${cid}"><path d="${poly(pts)}"/></clipPath><g clip-path="url(#${cid})" fill="none" stroke-linecap="round">` +
        (lv >= 2 ? `<path d="${dl}" stroke="${lt}" stroke-width="1.3" opacity="0.45"/>` : '') +
        `<path d="${dd}" stroke="${dk}" stroke-width="${lv >= 2 ? 1.5 : 1.1}" opacity="0.7"/>` +
        (lv >= 2 ? `<path d="M${pt([100 - hw - 6, 70])}Q${pt([100 - hw * 0.4, 66])} ${pt([100 - 4, 74])}" stroke="${dk}" stroke-width="5" opacity="0.18"/>` : '') + '</g>';
      if (lv >= 2) s += rim(pts, Object.assign({}, C, { hair: C.cover }), 1.2);
      return s;
    }
    return '';
  }

  function glasses(p, g, C, lv) {
    if (!p.glasses || p.glasses === 'none') return '';
    const y = g.eyeY, r = g.a + 3.6, xs = [-1, 1].map((s) => eyeX(g, s));
    const lens = p.glasses === 'round'
      ? xs.map((x) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}"/>`).join('')
      : xs.map((x) => `<rect x="${f(x - r - 0.5)}" y="${f(y - r * 0.72)}" width="${f(2 * r + 1)}" height="${f(r * 1.5)}" rx="3"/>`).join('');
    const ix = g.ex - r;
    let s = `<g fill="#FFFFFF" fill-opacity="0.13" stroke="${C.frame}" stroke-width="1.7">${lens}<path d="M${f(100 - ix + g.dx)} ${f(y - 1)} Q${f(100 + g.dx)} ${f(y - 4)} ${f(100 + ix + g.dx)} ${f(y - 1)}M${f(xs[0] - r)} ${f(y - 2)} L${f(g.warp ? g.warp([100 - g.hw, 0])[0] : 100 - g.hw)} ${f(y - 4)}M${f(xs[1] + r)} ${f(y - 2)} L${f(g.warp ? g.warp([100 + g.hw, 0])[0] : 100 + g.hw)} ${f(y - 4)}" fill="none"/></g>`;
    if (lv >= 2) s += xs.map((x) => `<path d="M${f(x - r * 0.55)} ${f(y - r * 0.2)} l${f(r * 0.45)} ${f(-r * 0.4)}" stroke="#FFFFFF" stroke-width="1.2" opacity="0.6" stroke-linecap="round"/>`).join('');
    return s;
  }

  function ageLines(p, g, C) {
    if (p.age === 'young') return '';
    const c = p.age === 'older' ? C.l13 : C.l10, w = p.age === 'older' ? 0.9 : 0.75;
    let d = '';
    for (const s of [-1, 1]) {
      const ox = 100 + s * (g.ex + g.a) + g.dx, oy = g.eyeY - g.tilt * 0.5 * s * s;
      d += `M${f(ox + s * 2.6)} ${f(oy - 1.2)} l${f(s * 2.6)} -1.3M${f(ox + s * 2.7)} ${f(oy + 1.3)} l${f(s * 2.6)} 0.9`;
      if (p.age === 'older') d += `M${f(g.nx + s * (g.nw + 3))} ${f(g.nb + 1)} Q${f(g.nx + s * (g.nw + 5.5))} ${f(g.my - 6)} ${f(g.mx + s * (g.mw + 4.2))} ${f(g.my - 1)}`;
      if (p.age === 'older') {
        const cx = 100 + s * g.ex + g.dx;
        d += `M${f(cx - s * g.a * 0.6)} ${f(g.eyeY + g.b + 2.6)} Q${f(cx)} ${f(g.eyeY + g.b + 4.6)} ${f(cx + s * g.a * 0.8)} ${f(g.eyeY + g.b + 2.2)}`;
        
      }
    }
    if (p.age === 'older') d += `M${f(100 - g.hw * 0.45)} 70 Q100 67 ${f(100 + g.hw * 0.45)} 70M${f(100 - g.hw * 0.38)} 76 Q100 73.5 ${f(100 + g.hw * 0.38)} 76`;
    return `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`;
  }

  /* ---------- Assembly ----------
   * A figure is split into a static part (everything that never moves relative to the head: outline, hair, nose,
   * facial hair, glasses, covering, clothes) and a dynamic part (eyes, brows, mouth). The static part is computed once
   * per feature vector + facing and cached; animation only redraws the dynamic part and updates three transforms. */
  const cache = new Map();
  function staticParts(p, o) {
    const lv = o.level, key = JSON.stringify(p) + '|' + (o.facing || 0) + '|' + lv;
    if (cache.has(key)) return cache.get(key);
    const id = 'avs' + (++uid), g = geom(p, o), C = colors(p, lv);
    const warp = g.turn ? (q) => { const k = Math.sign(q[0] - 100) === g.dir ? 1 - 0.08 * g.turn : 1 + 0.02 * g.turn; return [100 + (q[0] - 100) * k + g.dir * g.turn * 1.5, q[1]]; } : null;
    W = warp;
    const hairP = hair(p, g, C, lv, id), headPath = poly(g.head), coverW = covering(p, g, C, lv, id);
    // Facial hair: points near the middle move with the mouth, points at the jaw edge stay with the outline.
    W = (q) => { const t = Math.max(0, 1 - Math.abs(q[0] - 100) / g.hw); const q2 = [q[0] + g.dx * 1.1 * t, q[1]]; return warp ? warp(q2) : q2; };
    const facialW = facialHair(p, g, C, lv);
    W = null; g.warp = warp;
    const hijab = p.covering === 'hijab';
    let defs = '';
    if (lv >= 2) {
      defs += `<radialGradient id="${id}g" cx="0.42" cy="0.36" r="0.75"><stop offset="0" stop-color="${C.hi}"/><stop offset="0.55" stop-color="${C.skin}"/><stop offset="1" stop-color="${C.lo}"/></radialGradient>`;
      defs += `<linearGradient id="${id}h" x1="0" y1="0" x2="0.3" y2="1"><stop offset="0" stop-color="${light(C.hair, 7)}"/><stop offset="0.5" stop-color="${C.hair}"/><stop offset="1" stop-color="${shade(C.hair, 5)}"/></linearGradient>`;
      defs += `<linearGradient id="${id}s" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="${light(C.shirt, 6)}"/><stop offset="1" stop-color="${shade(C.shirt, 7)}"/></linearGradient>`;
      defs += `<linearGradient id="${id}c" x1="0" y1="0" x2="0.5" y2="1"><stop offset="0" stop-color="${light(C.cover, 7)}"/><stop offset="1" stop-color="${shade(C.cover, 8)}"/></linearGradient>`;
    }
    const skinFill = lv >= 2 ? `url(#${id}g)` : C.skin;
    const nk = clamp(g.jawHW * 0.5, 16, 24);
    let body = `<path d="M16 240 C18 214 46 199 100 199 C154 199 182 214 184 240Z" fill="${lv >= 2 ? `url(#${id}s)` : C.shirt}"/>`;
    if (lv >= 3) body += `<path d="M58 240 Q62 222 70 212M142 240 Q138 222 130 212" fill="none" stroke="${shade(C.shirt, 10)}" stroke-width="1.2" opacity="0.6"/>`;
    let neck = `<clipPath id="${id}n"><path d="M${f(100 - nk)} 150 L${f(100 - nk)} 200 Q100 214 ${f(100 + nk)} 200 L${f(100 + nk)} 150Z"/></clipPath>`;
    neck += `<path d="M${f(100 - nk)} 150 L${f(100 - nk)} 200 Q100 214 ${f(100 + nk)} 200 L${f(100 + nk)} 150Z" fill="${C.skin}"/>`;
    if (lv >= 2) neck += `<g clip-path="url(#${id}n)"><ellipse cx="100" cy="166" rx="${f(g.jawHW * 0.8)}" ry="11" fill="${C.lo}" opacity="0.45"/></g>`;
    const ears = [-1, 1].filter((s) => !(g.turn > 0.3 && s === g.dir)).map((s) => { const ex = warp ? warp([100 + s * (g.hw - 1), 110])[0] : 100 + s * (g.hw - 1); return `<ellipse cx="${f(ex)}" cy="110" rx="6.5" ry="10.5" fill="${C.skin}"/><path d="M${f(ex + s * 2.5)} 104 q${f(s * 2.6)} 6 0 12" fill="none" stroke="${C.l10}" stroke-width="1"/>`; }).join('');
    let head = `<clipPath id="${id}hd"><path d="${headPath}"/></clipPath><path d="${headPath}" fill="${skinFill}"/>`;
    let model = '';
    if (lv >= 3) model += [-1, 1].map((s) => `<ellipse cx="${f(100 + s * g.hw * 0.55 - 3)}" cy="117" rx="9" ry="5.5" fill="${C.hi}" opacity="0.5"/>`).join('') + `<path d="M${f(100 - g.jawHW - 4)} 146 Q100 186 ${f(100 + g.jawHW + 4)} 146" fill="none" stroke="${C.lo}" stroke-width="5" opacity="0.4"/>` + [-1, 1].map((s) => `<ellipse cx="${f(100 + s * g.hw * 0.55)}" cy="124" rx="7" ry="4" fill="${C.lip}" opacity="0.13"/>`).join('');
    if (lv >= 2) model += `<path d="${headPath}" fill="none" stroke="${C.lo}" stroke-width="${lv >= 3 ? 3 : 2}" opacity="0.35" transform="translate(1.2 0.6)"/>`;
    head += `<g clip-path="url(#${id}hd)">${model}</g>`;
    const nFreck = Math.round((p.freckles || 0) * FRECKLES.length);
    const freck = nFreck ? `<g fill="${C.freckle}">` + FRECKLES.slice(0, nFreck).map(([x, y, k]) => `<circle cx="${f((k === 'n' ? g.nx : 100 + g.dx) + x)}" cy="${f(y)}" r="0.8"/>`).join('') + '</g>' : '';
    const out = {
      g, C, lv, defs, id, back: hairP.back, body, neck, over: hairP.over, front: hairP.front + (hijab ? coverW : ''),
      hang: hijab ? HANG.hijab : HANG[p.hairStyle] || null,
      headUnder: (hijab ? '' : ears) + head + ageLines(p, g, C) + freck + facialW + nose(g, C, lv),
      headOver: glasses(p, g, C, lv) + (hijab ? '' : coverW),
      halo: p.facial === 'mustache' || p.facial === 'beard' || p.facial === 'fullbeard', key
    };
    cache.set(key, out);
    if (cache.size > 60) cache.delete(cache.keys().next().value);
    return out;
  }
  function dynamicPart(p, o, S) {
    const id = 'avd' + (++uid);
    return eye(-1, S.g, p, o, S.C, id, S.lv) + eye(1, S.g, p, o, S.C, id, S.lv) + mouth(S.g, o, S.C, S.lv, S.halo) +
      `<g transform="translate(0 ${f(-3 * (o.brow || 0))})">${brow(-1, S.g, p, S.C)}${brow(1, S.g, p, S.C)}</g>`;
  }
  const DEFAULT_STATE = { level: 2, gaze: [0, 0], mouth: 0, smile: 0.55, brow: 0, facing: 0, rot: 0, nod: 0, bounce: 0 };
  const headT = (o) => `translate(0 ${f(o.nod || 0)}) rotate(${f(o.rot || 0)} 100 165)`;
  /* Hanging hair. Short and rounded styles move rigidly with the head. Hair that hangs below the jaw is drawn in
   * horizontal bands: above y0 it turns with the head; from y0 to y1 the turn fades out; below y1 the hair only moves
   * along with the point it hangs from (it shifts sideways and drops with the head but stays vertical), as hair hanging
   * under gravity does. The bands overlap slightly so no seam shows. */
  const HANG = { shoulder: [128, 198], long: [128, 198], curly_long: [128, 198], locs: [128, 198], braids: [128, 198],
    bangs: [145, 190], bob: [145, 190], curly_mid: [140, 185], hijab: [165, 215, 24] };
  function hangBands(h) {
    const b = [-100, h[0]];
    const NB = h[2] || 12;   // steps across the fade (12; 24 for the wide hijab drape), each 1/NB of the turn, so no step shows
    for (let k = 1; k <= NB; k++) b.push(h[0] + (h[1] - h[0]) * k / NB);
    b.push(400);
    const out = [];
    for (let i = 0; i < b.length - 1; i++) {
      const mid = i === 0 ? h[0] : i === b.length - 2 ? h[1] : (b[i] + b[i + 1]) / 2;
      out.push({ y0: b[i] - 0.6, y1: b[i + 1] + 0.6, w: clamp(1 - (mid - h[0]) / (h[1] - h[0]), 0, 1) });
    }
    return out;
  }
  // w = 1: exactly the head transform; w = 0: no turn, only the hanging point's sideways shift and the head's drop.
  const hairT = (o, w) => {
    const rot = o.rot || 0, dx = 45 * Math.sin(rot * Math.PI / 180);
    return `translate(${f((1 - w) * dx)} ${f(o.nod || 0)}) rotate(${f(rot * w)} 100 165)`;
  };
  /* Animated figures (v2.3.3). In the scenes every hair layer is shown as a bitmap: the layer is drawn once onto a
   * canvas (as a PNG, at several pixels per unit, more on high-density screens) and the figure shows that picture. Each
   * frame of a head turn then costs a few bitmap draws. Before v2.3.3 the layers were shown as SVG images (v2.3.1) or
   * plain paths (v2.3.0); the browser still replayed every path of the hair on every frame (once per band for hanging
   * hair), which made scenes with braids and locs lag. Until a layer's bitmap is ready (the first few hundred ms) the SVG
   * image is shown, and it is swapped for the bitmap in place; if the browser refuses (e.g. an old browser treats the
   * canvas as tainted) the SVG image simply stays. Bitmaps are kept per figure + layer for the whole session.
   * prerender(spec, facing) starts the bitmaps for a figure and resolves when they are ready. */
  const RASTER = new Map();
  const rasterScale = () => Math.min(7, 3.5 * Math.max(1, (typeof window !== 'undefined' && window.devicePixelRatio) || 1));
  function rasterize(r) {
    r.p = new Promise((resolve) => {
      try {
        const sc = rasterScale(), im = new Image();
        im.onload = () => {
          try {
            const cv = document.createElement('canvas');
            cv.width = Math.round(200 * sc); cv.height = Math.round(240 * sc);
            cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
            cv.toBlob((b) => {
              if (b) {
                r.url = URL.createObjectURL(b);
                const els = document.querySelectorAll('image[data-rk="' + r.key + '"]');
                for (let k = 0; k < els.length; k++) els[k].setAttribute('href', r.url);
              }
              resolve(!!b);
            }, 'image/png');
          } catch (e) { resolve(false); }
        };
        im.onerror = () => resolve(false);
        im.src = r.svgUrl.replace('width%3D%22400%22%20height%3D%22480%22', 'width%3D%22' + Math.round(200 * sc) + '%22%20height%3D%22' + Math.round(240 * sc) + '%22');
      } catch (e) { resolve(false); }
    });
  }
  let rk = 0;
  function layerRaster(S, kind, content) {
    const k = S.key + '|' + kind;
    let r = RASTER.get(k);
    if (!r) {
      const doc = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 240" width="400" height="480"><defs>${S.defs}</defs>${content}</svg>`;
      r = { key: 'r' + (++rk), svgUrl: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(doc), url: null };
      RASTER.set(k, r);
      rasterize(r);
    }
    return r;
  }
  function layerImage(S, kind, content) {
    const r = layerRaster(S, kind, content);
    return `<image data-rk="${r.key}" href="${r.url || r.svgUrl}" x="0" y="0" width="200" height="240" preserveAspectRatio="none"/>`;
  }
  function prerender(spec, facing) {
    try {
      if (!spec) return Promise.resolve([]);
      const S = staticParts(spec, Object.assign({}, DEFAULT_STATE, { facing: facing || 0 }));
      const ps = [];
      [['b', S.back], ['f', S.front], ['o', S.over]].forEach(([kind, c]) => { if (c) ps.push(layerRaster(S, kind, c).p); });
      return Promise.all(ps);
    } catch (e) { return Promise.resolve([]); }
  }
  // One hair layer (back / front / over), banded when the style hangs. Animated figures (o.cacheHair, set by the scenes)
  // show the layer as a bitmap; still pictures keep the plain paths, so the designer preview never waits on an image.
  function hairLayer(S, o, kind, content) {
    if (!content) return '';
    const body = o.cacheHair ? layerImage(S, kind, content) : content;
    if (!S.hang) return `<g class="p-hair" data-w="1" transform="${hairT(o, 1)}">${body}</g>`;
    const ref = S.id + 'L' + kind;
    let out = `<defs><g id="${ref}">${body}</g>`;
    const bands = hangBands(S.hang);
    bands.forEach((b, i) => { out += `<clipPath id="${ref}c${i}"><rect x="-100" y="${f(b.y0)}" width="400" height="${f(b.y1 - b.y0)}"/></clipPath>`; });
    out += '</defs>';
    bands.forEach((b, i) => { out += `<g clip-path="url(#${ref}c${i})"><g class="p-hair" data-w="${f(b.w)}" transform="${hairT(o, b.w)}"><use href="#${ref}"/></g></g>`; });
    return out;
  }
  const bounceT = (o) => `translate(0 ${f(-(o.bounce || 0))})`;

  /* Full SVG markup. p: feature vector; o: { level, gaze:[x,y], mouth, smile, brow, facing, rot, nod, bounce, viewBox,
   * label, attrs }. gaze x/y in -1..1; facing -1 (turned to the viewer's left) .. 1 (right); rot in degrees. */
  function svg(p, o) {
    o = Object.assign({}, DEFAULT_STATE, o || {});
    const S = staticParts(p, o);
    return `<svg viewBox="${o.viewBox || '0 0 200 240'}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${o.label || 'person'}" ${o.attrs || ''}>` +
      `<defs>${S.defs}</defs><g class="p-bounce" transform="${bounceT(o)}">${hairLayer(S, o, 'b', S.back)}${S.body}${S.neck}` +
      `<g class="p-head" transform="${headT(o)}">${S.headUnder}<g class="p-dyn">${dynamicPart(p, o, S)}</g>${S.headOver}</g>` +
      `${hairLayer(S, o, 'f', S.front)}${hairLayer(S, o, 'o', S.over)}</g></svg>`;
  }

  /* Live, animatable figure. el = the <svg> element produced by svg(p, { facing }). */
  class PersonRig {
    constructor(el, p, facing, state) {
      this.el = el; this.p = p;
      this.s = Object.assign({}, DEFAULT_STATE, { facing: facing || 0 }, state || {});
      this.S = staticParts(p, this.s);
      this.bounceEl = el.querySelector('.p-bounce'); this.hairEls = Array.prototype.slice.call(el.querySelectorAll('.p-hair'));
      this.headEl = el.querySelector('.p-head'); this.dynEl = el.querySelector('.p-dyn');
      this.render();
    }
    set(st) { Object.assign(this.s, st); this.render(); }
    render() {
      const s = this.s, t = headT(s);
      this.bounceEl.setAttribute('transform', bounceT(s));
      this.headEl.setAttribute('transform', t);
      for (let i = 0; i < this.hairEls.length; i++) this.hairEls[i].setAttribute('transform', hairT(s, +this.hairEls[i].getAttribute('data-w')));
      this.dynEl.innerHTML = dynamicPart(this.p, s, this.S);
    }
    // Tween numeric state (and the gaze pair) to targets.
    to(target, ms, ease) {
      const from = {}; Object.keys(target).forEach((k) => (from[k] = Array.isArray(this.s[k]) ? this.s[k].slice() : this.s[k]));
      return U.tween(ms, (t) => {
        const st = {};
        Object.keys(target).forEach((k) => { st[k] = Array.isArray(target[k]) ? target[k].map((v, i) => U.lerp(from[k][i], v, t)) : U.lerp(from[k], target[k], t); });
        this.set(st);
      }, ease);
    }
  }

  /* ---------- Feature vectors ---------- */
  const FEATURE_KEYS = ['age', 'skinL', 'skinU', 'faceW', 'jaw', 'lid', 'eyeSize', 'eyeTilt', 'eyeSpacing', 'iris', 'browThick', 'browArch',
    'noseW', 'noseL', 'lipFull', 'mouthW', 'texture', 'length', 'hairStyle', 'hairColor', 'hairGray', 'facial', 'glasses', 'covering', 'coverColor', 'freckles', 'shirt'];
  // The neutral starting face for the designer: every slider at its midpoint, default categorical options.
  const NEUTRAL = { age: 'middle', skinL: 0.5, skinU: 0.45, faceW: 0.5, jaw: 0.5, lid: 'double', eyeSize: 0.5, eyeTilt: 0.5, eyeSpacing: 0.5, iris: 'brown',
    browThick: 0.5, browArch: 0.5, noseW: 0.5, noseL: 0.5, lipFull: 0.5, mouthW: 0.5, texture: 'straight', length: 'short', hairStyle: 'crop',
    hairColor: 0.2, hairGray: 0, facial: 'none', glasses: 'none', covering: 'none', coverColor: 'navy', freckles: 0, shirt: 'warmgray' };
  const GRAY_MAX = { young: 0.15, middle: 0.6, older: 1 };
  const AGES = ['young', 'middle', 'older'];
  const TEXTURES = ['straight', 'wavy', 'curly', 'coily'];
  const LENGTHS = ['short', 'medium', 'long'];
  const FACIAL = ['none', 'stubble', 'mustache', 'beard', 'fullbeard'];
  const GLASSES = ['none', 'round', 'rect'];
  const COVERINGS = ['none', 'hijab', 'turban'];
  const stylesFor = (texture, length) => Object.keys(STYLES).filter((s) => STYLES[s].tex.includes(texture) && STYLES[s].len.includes(length));
  // Compact, ordered "key=value;..." string for data files (numbers to 2 decimals).
  const vecString = (p) => FEATURE_KEYS.map((k) => k + '=' + (typeof p[k] === 'number' ? p[k].toFixed(2) : p[k])).join(';');

  return { svg, PersonRig, prerender, STYLES, IRIS, SHIRTS, DESIGNER_SHIRTS, STRANGER_SHIRTS, COVER, HAIR_STOPS, skinHex, hairHex, rng, lstar,
    FEATURE_KEYS, NEUTRAL, GRAY_MAX, AGES, TEXTURES, LENGTHS, FACIAL, GLASSES, COVERINGS, stylesFor, vecString };
})();
