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

  return { ID_SLIDERS, HAIR_NAMED, HAIR_LABEL, SIMILAR, namedColour, colourSteps, moveIdentity, unfamiliar, distance };
})();
