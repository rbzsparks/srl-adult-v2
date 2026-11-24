/* stimuli.js: loads the stimulus file and builds every participant-level assignment:
 * list → condition per scene set, incidental colors, familiarization order, test trials.
 * Two designs (SRL_CONFIG.DESIGN_VERSION / design_version from the survey):
 *   unique12: stimuli.json, 12 scene sets shown once.
 *   repeat6:  stimuli_repeat6.json, 6 scene sets shown twice; the strangers come from stranger set X or Y. */
SRL.stimuli = (function () {
  const U = SRL.util;
  let DATA = null, DESIGN = 'unique12', SSET = null;

  async function load(base, design, strangerSet) {
    DESIGN = design === 'repeat6' ? 'repeat6' : 'unique12';
    SSET = strangerSet || null;
    const file = DESIGN === 'repeat6' ? SRL_CONFIG.STIMULI_JSON_REPEAT6 : SRL_CONFIG.STIMULI_JSON;
    const res = await fetch(base + file + '?v=' + encodeURIComponent(SRL_CONFIG.VERSION), { cache: 'no-cache' });
    if (!res.ok) throw new Error('Could not load stimuli.json (' + res.status + ')');
    DATA = await res.json();
    return DATA;
  }
  const data = () => DATA;

  // Scene sets with their stranger, foil and audio clips. unique12: as in the file; repeat6: merged with the stranger set.
  function rawSets() {
    if (DESIGN !== 'repeat6') return DATA.scene_sets.map((s) => Object.assign({ greet_clip: 'greet_' + s.id, label_clip: 'label_' + s.id }, s));
    const E = DATA.stranger_sets[SSET];
    if (!E) throw new Error('Unknown stranger set ' + SSET);
    return DATA.scene_sets.map((s, i) => Object.assign({}, s, { stranger: E[i].stranger, foil: E[i].foil, foil_change: E[i].foil_change,
      voice: E[i].voice, greet_clip: E[i].greet_clip, label_clip: E[i].label_clip }));
  }

  function clipIds() {
    const ids = [];
    rawSets().forEach((s) => ids.push(s.greet_clip, s.label_clip, 'test_word_' + s.word, 'test_incid_' + s.incidental));
    ids.push('test_face');
    SRL_CONFIG.AUDIO_CHECK_WORDS.forEach((w) => ids.push('check_' + w));
    return ids;
  }

  // Pseudorandom order: no more than 2 consecutive scenes of the same condition, and the last 2 scenes are one known-person
  // and one unfamiliar-person scene (in random order), so recency affects both conditions equally.
  function famOrder(sets) {
    for (let attempt = 0; attempt < 5000; attempt++) {
      const o = U.shuffle(sets);
      let ok = true;
      for (let i = 2; i < o.length; i++) {
        if (o[i].condition === o[i - 1].condition && o[i].condition === o[i - 2].condition) { ok = false; break; }
      }
      if (ok && o[o.length - 1].condition !== o[o.length - 2].condition) return o;
    }
    throw new Error('Could not build familiarization order');
  }

  /* Word-test foils. For each target: 3 foils from the other 11 scene sets, with at least one foil from each
   * condition (hard rule). Soft rule: all 4 options have different first vowels. Also aims for every object
   * appearing as a foil exactly 3 times. Random-restart search; relaxes the vowel rule only if needed. */
  function wordFoils(sets) {
    const vowel = (s) => DATA.words[s.word].first_vowel;
    const combos = (arr, k) => {
      const out = [];
      const rec = (start, cur) => {
        if (cur.length === k) { out.push(cur.slice()); return; }
        for (let i = start; i < arr.length; i++) { cur.push(arr[i]); rec(i + 1, cur); cur.pop(); }
      };
      rec(0, []);
      return out;
    };
    const candidates = {};
    sets.forEach((t) => {
      const others = sets.filter((s) => s.id !== t.id);
      candidates[t.id] = combos(others, 3).filter((c) => c.some((s) => s.condition === 'known') && c.some((s) => s.condition === 'unfamiliar'))
        .map((c) => ({ foils: c, vowelOk: new Set([vowel(t)].concat(c.map(vowel))).size === 4 }));
    });
    let best = null;
    for (let attempt = 0; attempt < 400; attempt++) {
      const use = {}; sets.forEach((s) => (use[s.id] = 0));
      const result = {}; let relaxed = 0; let fail = false;
      for (const t of U.shuffle(sets)) {
        let pool = candidates[t.id].filter((c) => c.vowelOk && c.foils.every((f) => use[f.id] < 3));
        let rel = false;
        if (!pool.length) { pool = candidates[t.id].filter((c) => c.foils.every((f) => use[f.id] < 3)); rel = true; }
        if (!pool.length) { fail = true; break; }
        const c = U.pick(pool);
        c.foils.forEach((f) => use[f.id]++);
        result[t.id] = { foils: c.foils.map((f) => f.id), vowel_rule_met: !rel };
        if (rel) relaxed++;
      }
      if (fail) continue;
      if (!best || relaxed < best.relaxed) best = { result, relaxed };
      if (relaxed === 0) break;
    }
    if (!best) {
      // Fallback: ignore the usage balance.
      const result = {};
      sets.forEach((t) => { const c = U.pick(candidates[t.id]); result[t.id] = { foils: c.foils.map((f) => f.id), vowel_rule_met: c.vowelOk }; });
      best = { result, relaxed: Object.values(result).filter((r) => !r.vowel_rule_met).length, unbalanced: true };
    }
    return best;
  }

  function testBlockOrder() {
    if (SRL_CONFIG.TEST_BLOCK_ORDER_MODE === 'counterbalanced') return U.shuffle(['word', 'face', 'incid']);
    return SRL_CONFIG.TEST_BLOCK_ORDER_FIXED.slice();
  }

  /* ---------- repeat6 ---------- */

  /* 12 trials: block 1 = the 6 scene sets in random order, block 2 = all 6 again in a new random order. Resampled until
   * (1) block 2 does not start with block 1's last scene set, (2) no more than 2 consecutive scenes of the same
   * condition anywhere in the 12 (across the block boundary too), (3) the last 2 trials are one known + one unfamiliar.
   * Each trial is a copy of its scene set (identical stimuli) plus presentation (1/2) and lag (blank for the first). */
  function famOrderRepeat6(sets) {
    for (let attempt = 0; attempt < 20000; attempt++) {
      const o = U.shuffle(sets).concat(U.shuffle(sets));
      if (o[6].id === o[5].id) continue;
      let ok = true;
      for (let i = 2; i < o.length; i++) {
        if (o[i].condition === o[i - 1].condition && o[i].condition === o[i - 2].condition) { ok = false; break; }
      }
      if (!ok || o[10].condition === o[11].condition) continue;
      const first = {};
      return o.map((s, i) => {
        const pres = first[s.id] ? 2 : 1;
        if (pres === 1) first[s.id] = i + 1;
        return Object.assign({}, s, { presentation: pres, lag: pres === 2 ? i + 1 - first[s.id] : null });
      });
    }
    throw new Error('Could not build familiarization order');
  }

  /* Word-test foils, repeat6: 3 foils per target from the other 5, each object a foil exactly 3 times, and at least one
   * foil from each condition (the unique12 hard rule). Randomized depth-first search. */
  function wordFoilsRepeat6(sets) {
    const combos = (arr) => {
      const out = [];
      for (let a = 0; a < arr.length; a++) for (let b = a + 1; b < arr.length; b++) for (let c = b + 1; c < arr.length; c++) out.push([arr[a], arr[b], arr[c]]);
      return out;
    };
    const cand = {};
    sets.forEach((t) => {
      cand[t.id] = combos(sets.filter((s) => s.id !== t.id)).filter((c) => c.some((s) => s.condition === 'known') && c.some((s) => s.condition === 'unfamiliar'));
    });
    const targets = U.shuffle(sets), use = {}, result = {};
    sets.forEach((s) => (use[s.id] = 0));
    const rec = (i) => {
      if (i === targets.length) return sets.every((s) => use[s.id] === 3);
      const t = targets[i];
      for (const c of U.shuffle(cand[t.id])) {
        if (!c.every((f) => use[f.id] < 3)) continue;
        c.forEach((f) => use[f.id]++);
        result[t.id] = { foils: c.map((f) => f.id), vowel_rule_met: null };
        if (rec(i + 1)) return true;
        c.forEach((f) => use[f.id]--);
      }
      return false;
    };
    if (!rec(0)) throw new Error('Could not build word-test foils');
    return { result, relaxed: 0 };
  }

  /* Target screen positions for n 4-AFC trials: every position once, then the rest on distinct random positions
   * (6 trials: each position once or twice), shuffled across trials. */
  function balancedPositions(n) {
    const all = [0, 1, 2, 3], extra = U.shuffle([0, 1, 2, 3]);
    for (let i = 0; all.length < n; i++) all.push(extra[i % 4]);
    return U.shuffle(all);
  }

  function designRepeat6(sets) {
    const byId = {}; sets.forEach((s) => (byId[s.id] = s));
    const fam = famOrderRepeat6(sets);
    const wf = wordFoilsRepeat6(sets);
    const blocks = testBlockOrder();
    const colors = Object.keys(DATA.incidental_colors);
    const tests = {};
    blocks.forEach((type) => {
      const order = U.shuffle(sets);
      if (type === 'word') {
        const pos = balancedPositions(order.length);
        tests[type] = order.map((s, i) => {
          const foils = U.shuffle(wf.result[s.id].foils), ids = [];
          let k = 0;
          for (let p = 0; p < 4; p++) ids.push(p === pos[i] ? s.id : foils[k++]);
          return { type, set: s, options: ids.map((id) => ({ id: byId[id].object_id, set_id: id, condition: byId[id].condition })),
            foils: wf.result[s.id].foils, vowel_rule_met: null };
        });
      } else if (type === 'face') {
        const left = U.shuffle([1, 1, 1, 0, 0, 0]); // target on the left in 3 trials, on the right in 3
        tests[type] = order.map((s, i) => {
          const t = { id: s.stranger.id, target: true }, f = { id: s.foil.id, target: false };
          return { type, set: s, options: left[i] ? [t, f] : [f, t] };
        });
      } else {
        tests[type] = order.map((s) => ({ type, set: s, options: U.shuffle(colors).map((c) => ({ id: c, target: c === s.incidental_color })) }));
      }
    });
    return { design_version: 'repeat6', sets, byId, fam, tests, blocks, word_foil_vowel_relaxed: '', word_foil_unbalanced: false };
  }

  /* Build the full design for one participant. list = 'A' | 'B'. */
  function design(list) {
    const colors = Object.keys(DATA.incidental_colors);
    const sets = rawSets().map((s) => {
      const known = (list === 'A') === (s.half === 1);
      return {
        id: s.id, half: s.half, word: s.word, object_id: s.object_id, incidental: s.incidental,
        incidental_label: DATA.incidental_types[s.incidental],
        incidental_color: U.pick(colors), // one colour per scene set, so a repeated scene shows the same colour
        stranger: s.stranger, foil: s.foil, foil_change: s.foil_change, greet_clip: s.greet_clip, label_clip: s.label_clip,
        condition: known ? 'known' : 'unfamiliar'
      };
    });
    if (DESIGN === 'repeat6') return designRepeat6(sets);
    const byId = {}; sets.forEach((s) => (byId[s.id] = s));
    const fam = famOrder(sets);
    const wf = wordFoils(sets);
    const blocks = testBlockOrder();
    const tests = {};
    blocks.forEach((type) => {
      tests[type] = U.shuffle(sets).map((s) => {
        if (type === 'word') {
          const options = U.shuffle([s.id].concat(wf.result[s.id].foils));
          return { type, set: s, options: options.map((id) => ({ id: byId[id].object_id, set_id: id, condition: byId[id].condition })),
            foils: wf.result[s.id].foils, vowel_rule_met: wf.result[s.id].vowel_rule_met };
        }
        if (type === 'face') {
          const opts = U.shuffle([{ id: s.stranger.id, target: true }, { id: s.foil.id, target: false }]);
          return { type, set: s, options: opts };
        }
        const opts = U.shuffle(colors).map((c) => ({ id: c, target: c === s.incidental_color }));
        return { type, set: s, options: opts };
      });
    });
    return { design_version: 'unique12', sets, byId, fam, tests, blocks, word_foil_vowel_relaxed: wf.relaxed, word_foil_unbalanced: !!wf.unbalanced };
  }

  const designVersion = () => DESIGN, strangerSet = () => SSET;
  return { load, data, clipIds, design, designVersion, strangerSet };
})();
