/* names.js: stranger names, the matching-task foil name, and the clash checks (docs/V2_SPEC.md §8).
 * PRIVACY: the typed name is compared in memory only. What is returned (and recorded) is list names and counts:
 * which list names were swapped, never the typed name. */
SRL.names = (function () {
  const U = SRL.util, C = () => SRL_CONFIG;

  // A list name clashes with the typed name when it is the same (ignoring case), within the edit distance, or shares the
  // first letters. Both the full typed name and its first word are checked.
  function clashesTyped(name, typed) {
    if (!typed) return false;
    const n = name.toLowerCase(), t = typed.toLowerCase().trim(), parts = [t, t.split(/\s+/)[0]];
    const k = C().NAME_CLASH_PREFIX, d = C().NAME_CLASH_MAX_EDIT;
    for (let i = 0; i < parts.length; i++) {
      const x = parts[i];
      if (!x) continue;
      if (n === x || U.levenshtein(n, x) <= d) return true;
      if (x.length >= k && n.slice(0, k) === x.slice(0, k)) return true;
    }
    return false;
  }

  /* S.knownName = typed name (known) or control name; S.control; S.controlOnset (control only).
   * rng: function () -> [0, 1). Returns { byStranger: {strId: name}, foilName, swaps, swapped } */
  function assign(S, strangers, rng) {
    const typed = S.control ? null : S.knownName;
    const ok = (name, onset) => !clashesTyped(name, typed) && !(S.control && onset === S.controlOnset);
    const list = C().STRANGER_NAMES, used = {}, names = [], swapped = [];
    list.forEach((e) => { if (ok(e.name, e.onset)) used[e.name] = true; });
    list.forEach((e) => {
      if (ok(e.name, e.onset)) { names.push(e.name); return; }
      // Its own backup first, then the other backups in list order.
      const cands = [e].concat(list.filter((x) => x !== e)).map((x) => ({ name: x.backup, onset: x.backup_onset }));
      let pick = null;
      for (let i = 0; i < cands.length && !pick; i++) if (!used[cands[i].name] && ok(cands[i].name, cands[i].onset)) pick = cands[i].name;
      if (!pick) throw new Error('names: no backup left');
      used[pick] = true; names.push(pick); swapped.push(e.name + '>' + pick);
    });
    // Shuffle the 6 names over the 6 strangers.
    const order = names.slice();
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const x = order[i]; order[i] = order[j]; order[j] = x; }
    const byStranger = {};
    strangers.forEach((s, i) => (byStranger[s.id] = order[i]));
    let foilName = null;
    const foils = C().FOIL_NAMES;
    for (let i = 0; i < foils.length && !foilName; i++) if (!clashesTyped(foils[i], typed)) foilName = foils[i];
    if (!foilName) throw new Error('names: no foil name left');
    if (foilName !== foils[0]) swapped.push(foils[0] + '>' + foilName);
    return { byStranger, foilName, swaps: swapped.length, swapped };
  }

  // All names that can ever be used (audio preparation and checks).
  const allStrangerNames = () => C().STRANGER_NAMES.reduce((a, e) => a.concat([e.name, e.backup]), []);
  const clipKey = (name) => name.toLowerCase();

  return { assign, clashesTyped, allStrangerNames, clipKey };
})();
