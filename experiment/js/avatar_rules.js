/* avatar_rules.js: how the matching-task foil avatar is derived from the designed avatar (v3.0; in pilot 1 the same
 * rule made the "unfamiliar person", hence the function name). Rules agreed for pilot 1 (design/avatar_style_sheet.html
 * in rbzsparks/srl-adult-prolific, tag v2.4.2-pilot1).
 *
 * Foil avatar: copies the group features (skin lightness and undertone, age and grey, lid type, iris colour,
 * freckles, hair texture and length, head covering, facial hair present/absent), moves AVATAR_UNFAM_K randomly chosen
 * identity sliders by ±AVATAR_UNFAM_STEP (direction flipped at a bound), and makes 3 categorical changes, each visible
 * at scene size:
 *   hair visible      hair style from the similar-style list (same length and texture), a different shirt colour,
 *                     and either a hair-colour change of 1..AVATAR_UNFAM_COLOUR_MAX_STEPS steps or glasses on/off
 *   head covering     covering colour, shirt colour, glasses on/off
 *   bald + facial hr  facial hair style (stays present), shirt colour, glasses on/off
 *   bald, no facial   shirt colour, glasses on/off, and one more identity slider (AVATAR_UNFAM_K_BALD_NO_FACIAL_HAIR) */
SRL.avatarRules = (function () {
  const P = SRL.people;

  const ID_SLIDERS = ['faceW', 'jaw', 'eyeSize', 'eyeTilt', 'eyeSpacing', 'noseW', 'noseL', 'lipFull', 'mouthW', 'browThick', 'browArch'];

  /* Natural hair colours as an ordered scale: black – dark brown – brown – light brown – blonde, with auburn next to
   * brown. Values are positions on the hair-colour slider. Grey is an age cue: copied, never changed, and colour
   * changes are skipped when grey (> 0.5) would hide them. */
  const HAIR_NAMED = { black: 0, darkbrown: 0.2, brown: 0.4, lightbrown: 0.58, auburn: 0.72, blonde: 0.92 };
  const HAIR_LABEL = { black: 'black', darkbrown: 'dark brown', brown: 'brown', lightbrown: 'light brown', auburn: 'auburn', blonde: 'blonde' };
  const COLOUR_ADJ = { black: ['darkbrown'], darkbrown: ['black', 'brown'], brown: ['darkbrown', 'lightbrown', 'auburn'], lightbrown: ['brown', 'blonde'], blonde: ['lightbrown'], auburn: ['brown'] };
  const namedColour = (v) => Object.keys(HAIR_NAMED).reduce((b, k) => (Math.abs(HAIR_NAMED[k] - v) < Math.abs(HAIR_NAMED[b] - v) ? k : b), 'black');
  function colourSteps(from) {
    const d = { [from]: 0 }, queue = [from];
    while (queue.length) { const c = queue.shift(); for (const n of COLOUR_ADJ[c]) if (d[n] === undefined) { d[n] = d[c] + 1; queue.push(n); } }
    return d;
  }

  /* Similar-outline styles. Never to or from bald. */
  const SIMILAR = { buzz: ['crop', 'coils_short', 'curly_short'], crop: ['sidepart', 'buzz'], sidepart: ['crop'], curly_short: ['coils_short', 'buzz'], coils_short: ['curly_short', 'buzz'],
    bangs: ['shoulder', 'bob'], bob: ['bangs', 'shoulder'], shoulder: ['bangs', 'bob', 'long'], long: ['shoulder'], curly_mid: ['afro', 'curly_long'], afro: ['curly_mid'], curly_long: ['curly_mid'], braids: ['locs'], locs: ['braids'], bun: [] };
  const FACIAL_SWAP = { stubble: 'beard', mustache: 'beard', beard: 'mustache', fullbeard: 'mustache' };
  const fitsTex = (p, s) => s !== 'bald' && P.STYLES[s].tex.includes(p.texture);
  const fits = (p, s) => fitsTex(p, s) && P.STYLES[s].len.includes(p.length);

  const pick = (a, r) => a[Math.floor(r() * a.length)];
  function shuffle(a, r) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  const clamp01 = (v) => Math.max(0, Math.min(1, v));

  function moveIdentity(p, K, step, r) {
    const q = Object.assign({}, p), moves = {};
    for (const k of shuffle(ID_SLIDERS.slice(), r).slice(0, K)) {
      let dir = r() < 0.5 ? -1 : 1, v = p[k] + dir * step;
      if (v < 0 || v > 1) { dir = -dir; v = p[k] + dir * step; }
      q[k] = clamp01(v); moves[k] = q[k] - p[k];
    }
    return { q, moves };
  }
  const distance = (moves) => Math.sqrt(Object.values(moves).reduce((s, d) => s + d * d, 0));

  /* known: feature vector; seed: integer (the participant seed), so the result can be regenerated exactly.
   * cfg: SRL_CONFIG (AVATAR_* values). Returns { spec, moves, changes, K, distance }. */
  function unfamiliar(known, seed, cfg) {
    const r = P.rng((seed ^ 0x5EED1) >>> 0), plan = [];
    let K = cfg.AVATAR_UNFAM_K;
    if (known.covering !== 'none') plan.push('covering colour', 'shirt colour', 'glasses');
    else if (known.hairStyle === 'bald') {
      if (known.facial !== 'none') plan.push('facial hair style', 'shirt colour', 'glasses');
      else { plan.push('shirt colour', 'glasses'); K = cfg.AVATAR_UNFAM_K_BALD_NO_FACIAL_HAIR; }
    } else plan.push('hair style', 'shirt colour', pick(known.hairGray <= 0.5 ? ['hair colour', 'glasses'] : ['glasses'], r));
    const { q, moves } = moveIdentity(known, K, cfg.AVATAR_UNFAM_STEP, r);
    const changes = [];
    for (const c of plan) {
      if (c === 'hair style') {
        const similar = SIMILAR[known.hairStyle] || [];
        let opts = similar.filter((s) => fits(known, s));
        if (!opts.length) {
          // Long straight / wavy hair has no other long style on the list: allow shoulder length (agreed exception).
          const cross = similar.filter((s) => fitsTex(known, s));
          if (cross.length) { opts = cross; }
          else opts = Object.keys(P.STYLES).filter((s) => s !== known.hairStyle && fits(known, s));
        }
        q.hairStyle = pick(opts, r);
        if (!P.STYLES[q.hairStyle].len.includes(q.length)) q.length = P.STYLES[q.hairStyle].len[0];
        changes.push(`hairStyle:${known.hairStyle}>${q.hairStyle}`);
      }
      if (c === 'hair colour') {
        const from = namedColour(known.hairColor), d = colourSteps(from);
        const to = pick(Object.keys(d).filter((k) => d[k] >= 1 && d[k] <= cfg.AVATAR_UNFAM_COLOUR_MAX_STEPS), r);
        q.hairColor = HAIR_NAMED[to]; changes.push(`hairColor:${from}>${to}`);
      }
      if (c === 'glasses') { q.glasses = known.glasses === 'none' ? pick(['round', 'rect'], r) : 'none'; changes.push(`glasses:${known.glasses}>${q.glasses}`); }
      if (c === 'shirt colour') { q.shirt = pick(Object.keys(P.DESIGNER_SHIRTS).filter((x) => x !== known.shirt), r); changes.push(`shirt:${known.shirt}>${q.shirt}`); }
      if (c === 'covering colour') { q.coverColor = pick(Object.keys(P.COVER).filter((x) => x !== known.coverColor), r); changes.push(`coverColor:${known.coverColor}>${q.coverColor}`); }
      if (c === 'facial hair style') { q.facial = FACIAL_SWAP[known.facial]; changes.push(`facial:${known.facial}>${q.facial}`); }
    }
    return { spec: q, moves, changes, K, distance: distance(moves) };
  }

  /* ---------- Control condition: the avatar to copy, and how closely it was copied ----------
   * v3.1 uses a FIXED set of 6 targets (stimuli.json control_targets), chosen from candidates this generator made
   * (tools/control_targets.html). target(rng, avoid, want) is the pilot-1 generator; want = { masc, age } fixes the
   * presentation and age band (pilot 1 drew both at random).
   * Pilot-1 rules: skin depth spread evenly over the six bands the strangers use; other skin and face sliders
   * uniform in a moderate range (0.25-0.75 for face sliders); hair texture and colour, eye colour and freckles loosely
   * follow skin depth, as among the strangers; a masculine or feminine presentation, half each, which sets the hair
   * length mix (mostly short / mostly medium or long) and facial hair (about 45% of masculine targets); any hair style
   * that fits the texture and length (a bun at 0.4 and a buzz cut at 0.5 weight, as they fit every texture; a buzz cut only for masculine targets, bald only for older masculine ones); grey
   * hair by age; glasses in a quarter; no head covering (a covering is
   * personal, so it is never assigned at random); a designer shirt colour. It avoids a near-twin of any stranger in the
   * participant's set (same style, same age, skin within 0.15). */
  const BANDS = [[0.02, 0.14], [0.16, 0.3], [0.32, 0.46], [0.48, 0.62], [0.64, 0.78], [0.8, 0.94]];
  const r2 = (x) => Math.round(x * 100) / 100;
  const wpick = (a, w, r) => { let x = r() * w.reduce((t, v) => t + v, 0); for (let i = 0; i < a.length; i++) { x -= w[i]; if (x < 0) return a[i]; } return a[a.length - 1]; };
  function target(rng, avoid, want) {
    want = want || {};
    let q = null;
    for (let tries = 0; tries < 60; tries++) {
      const u = (a, b) => r2(a + (b - a) * rng());
      q = Object.assign({}, P.NEUTRAL);
      const band = BANDS[Math.floor(rng() * BANDS.length)];
      q.skinL = u(band[0], band[1]); q.skinU = u(0.2, 0.85);
      q.age = want.age || pick(P.AGES, rng);
      ['faceW', 'jaw', 'eyeSize', 'eyeTilt', 'eyeSpacing', 'browThick', 'browArch', 'noseW', 'noseL', 'lipFull', 'mouthW'].forEach((k) => (q[k] = u(0.25, 0.75)));
      q.lid = pick(['double', 'double', 'hooded', 'mono'], rng);
      const deep = q.skinL > 0.62, light = q.skinL < 0.3;
      q.iris = light ? pick(['blue', 'green', 'hazel', 'gray', 'brown', 'darkbrown'], rng) : deep ? pick(['darkbrown', 'brown'], rng) : pick(['darkbrown', 'brown', 'hazel'], rng);
      q.texture = deep ? pick(['coily', 'coily', 'curly', 'wavy'], rng) : light ? pick(['straight', 'straight', 'wavy', 'curly'], rng) : pick(P.TEXTURES, rng);
      // Presentation, half and half as among the strangers: sets the hair length mix and whether there is facial hair.
      const masc = want.masc !== undefined ? want.masc : rng() < 0.5;
      q.length = wpick(P.LENGTHS, masc ? [0.75, 0.2, 0.05] : [0.2, 0.4, 0.4], rng);
      const styles = P.stylesFor(q.texture, q.length).filter((s) => (s !== 'bald' || (masc && q.age === 'older')) && (s !== 'buzz' || masc));
      q.hairStyle = wpick(styles, styles.map((s) => (s === 'bun' ? 0.4 : s === 'buzz' ? 0.5 : 1)), rng);   // bun and buzz fit every texture, so they get less weight
      q.hairColor = light ? u(0, 1) : u(0, 0.3);
      q.hairGray = q.age === 'young' ? 0 : q.age === 'middle' ? u(0, 0.3) : u(0.4, 0.95);
      q.facial = masc && rng() < 0.45 ? pick(['stubble', 'mustache', 'beard', 'fullbeard'], rng) : 'none';
      q.glasses = rng() < 0.25 ? pick(['round', 'rect'], rng) : 'none';
      q.freckles = light && rng() < 0.3 ? u(0.2, 0.5) : 0;
      q.covering = 'none';
      q.shirt = pick(Object.keys(P.DESIGNER_SHIRTS), rng);
      if (!(avoid || []).some((a) => a && a.hairStyle === q.hairStyle && a.age === q.age && Math.abs(a.skinL - q.skinL) < 0.15)) break;
    }
    return q;
  }
  // How far the copy is from the target: mean absolute difference over the 16 sliders (0-1), and the categorical
  // features that differ (hair colour and grey count as sliders; covering colour and shirt are not compared).
  const COPY_NUM = ['skinL', 'skinU', 'faceW', 'jaw', 'eyeSize', 'eyeTilt', 'eyeSpacing', 'browThick', 'browArch', 'noseW', 'noseL', 'lipFull', 'mouthW', 'hairColor', 'hairGray', 'freckles'];
  const COPY_CAT = ['age', 'lid', 'iris', 'texture', 'length', 'hairStyle', 'facial', 'glasses', 'covering'];
  function copyError(t, c) {
    const err = COPY_NUM.reduce((s, k) => s + Math.abs((+t[k] || 0) - (+c[k] || 0)), 0) / COPY_NUM.length;
    const miss = COPY_CAT.filter((k) => t[k] !== c[k]);
    return { err: +err.toFixed(3), miss };
  }

  return { ID_SLIDERS, HAIR_NAMED, HAIR_LABEL, SIMILAR, namedColour, colourSteps, moveIdentity, unfamiliar, distance, target, copyError, COPY_NUM, COPY_CAT };
})();
