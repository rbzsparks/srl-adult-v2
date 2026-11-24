/* stimuli.js: loads stimuli/stimuli.json and builds every participant-level assignment (v3.0):
 * stranger set → strangers per scene set, background-object colours, familiarization order (6 scene sets, each shown
 * twice), and the three 4-AFC tests in the participant's test order. Names come from SRL.names (assigned in main.js). */
SRL.stimuli = (function () {
  const U = SRL.util;
  let DATA = null, SSET = null;

  async function load(base, strangerSet) {
    SSET = strangerSet;
    const res = await fetch(base + SRL_CONFIG.STIMULI_JSON + '?v=' + encodeURIComponent(SRL_CONFIG.VERSION), { cache: 'no-cache' });
    if (!res.ok) throw new Error('Could not load stimuli.json (' + res.status + ')');
    DATA = await res.json();
    if (!DATA.stranger_sets[SSET]) throw new Error('Unknown stranger set ' + SSET);
    return DATA;
  }
  const data = () => DATA;
  const strangerSet = () => SSET;
  // The participant's 6 strangers, in scene-set order.
  const strangers = () => DATA.stranger_sets[SSET].map((e) => e.stranger);

  /* Audio. First load: narrator prompts, the 6 voice samples. After the voice is chosen: that voice's clips. */
  function narratorClipIds() {
    const ids = [];
    DATA.scene_sets.forEach((s) => ids.push('test_word_' + s.word, 'test_incid_' + s.incidental));
    SRL.names.allStrangerNames().forEach((n) => ids.push('test_identity_' + SRL.names.clipKey(n)));
    SRL_CONFIG.VOICES.forEach((v) => ids.push('sel_' + v.id));
    return ids;
  }
  function voiceClipIds(voice, names) {
    const ids = [];
    names.forEach((n) => ids.push('greet_' + SRL.names.clipKey(n) + '_' + voice));
    DATA.scene_sets.forEach((s) => ids.push('label_' + s.word + '_' + voice));
    SRL_CONFIG.AUDIO_CHECK_WORDS.forEach((w) => ids.push('check_' + w + '_' + voice));
    return ids;
  }

  /* 12 trials: block 1 = the 6 scene sets in random order, block 2 = all 6 again in a new random order, resampled until
   * block 2 does not start with block 1's last scene set. Each trial is a copy of its scene set plus presentation (1/2)
   * and lag (blank for the first). */
  function famOrder(sets) {
    for (let attempt = 0; attempt < 1000; attempt++) {
      const o = U.shuffle(sets).concat(U.shuffle(sets));
      if (o[6].id === o[5].id) continue;
      const first = {};
      return o.map((s, i) => {
        const pres = first[s.id] ? 2 : 1;
        if (pres === 1) first[s.id] = i + 1;
        return Object.assign({}, s, { presentation: pres, lag: pres === 2 ? i + 1 - first[s.id] : null });
      });
    }
    throw new Error('Could not build familiarization order');
  }

  /* Foils for a 4-AFC test over the 6 scene sets: 3 foils per target from the other 5, each scene set a foil exactly
   * 3 times. Randomized depth-first search. Used for the word test (objects) and the identity test (strangers). */
  function foils(sets) {
    const combos = (arr) => {
      const out = [];
      for (let a = 0; a < arr.length; a++) for (let b = a + 1; b < arr.length; b++) for (let c = b + 1; c < arr.length; c++) out.push([arr[a], arr[b], arr[c]]);
      return out;
    };
    const targets = U.shuffle(sets), use = {}, result = {};
    sets.forEach((s) => (use[s.id] = 0));
    const rec = (i) => {
      if (i === targets.length) return sets.every((s) => use[s.id] === 3);
      const t = targets[i];
      const cands = U.shuffle(combos(sets.filter((s) => s.id !== t.id)));
      for (let k = 0; k < cands.length; k++) {
        const c = cands[k];
        if (!c.every((f) => use[f.id] < 3)) continue;
        c.forEach((f) => use[f.id]++);
        result[t.id] = c.map((f) => f.id);
        if (rec(i + 1)) return true;
        c.forEach((f) => use[f.id]--);
      }
      return false;
    };
    if (!rec(0)) throw new Error('Could not build test foils');
    return result;
  }

  /* Target screen positions for n 4-AFC trials: every position once, then the rest on distinct random positions
   * (6 trials: each position once or twice), shuffled across trials. */
  function balancedPositions(n) {
    const all = [0, 1, 2, 3], extra = U.shuffle([0, 1, 2, 3]);
    for (let i = 0; all.length < n; i++) all.push(extra[i % 4]);
    return U.shuffle(all);
  }

  // Background-object colours: every colour once, two of them twice, shuffled over the 6 scene sets.
  function colourAssignment(n) {
    const cols = Object.keys(DATA.incidental_colors);
    const pool = cols.concat(U.shuffle(cols).slice(0, n - cols.length));
    return U.shuffle(pool);
  }

  /* Full design for one participant. order = test order, e.g. ['colour', 'word', 'identity']; nameOf = {strId: name}. */
  function design(order, nameOf) {
    const E = DATA.stranger_sets[SSET], cols = colourAssignment(DATA.scene_sets.length);
    const sets = DATA.scene_sets.map((s, i) => ({
      id: s.id, word: s.word, object_id: s.object_id, incidental: s.incidental,
      incidental_label: DATA.incidental_types[s.incidental], incidental_color: cols[i],
      stranger: E[i].stranger, stranger_name: nameOf[E[i].stranger.id]
    }));
    const byId = {}; sets.forEach((s) => (byId[s.id] = s));
    const fam = famOrder(sets);
    const colours = Object.keys(DATA.incidental_colors), nColour = SRL_CONFIG.COLOUR_CHOICES === 2 ? 2 : 4;
    const tests = {};
    order.forEach((type) => {
      const trials = U.shuffle(sets);
      if (type === 'word' || type === 'identity') {
        const f = foils(sets), pos = balancedPositions(trials.length);
        tests[type] = trials.map((s, i) => {
          const fs = U.shuffle(f[s.id]), ids = [];
          let k = 0;
          for (let p = 0; p < 4; p++) ids.push(p === pos[i] ? s.id : fs[k++]);
          return { type, set: s, options: ids.map((id) => ({ set_id: id, id: type === 'word' ? byId[id].object_id : byId[id].stranger.id, target: id === s.id })) };
        });
      } else {
        tests[type] = trials.map((s) => {
          const others = U.shuffle(colours.filter((c) => c !== s.incidental_color)).slice(0, nColour - 1);
          return { type, set: s, options: U.shuffle([s.incidental_color].concat(others)).map((c) => ({ id: c, target: c === s.incidental_color })) };
        });
      }
    });
    return { sets, byId, fam, tests, blocks: order.slice() };
  }

  return { load, data, strangerSet, strangers, narratorClipIds, voiceClipIds, design };
})();
