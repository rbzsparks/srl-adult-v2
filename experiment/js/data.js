/* data.js: all data saving lives here so the destination can be swapped.
 *  - Qualtrics embedded data (primary): wide fields + full_data_json_1..N chunks.
 *      engine 'legacy': Qualtrics.SurveyEngine.setEmbeddedData(name, value)
 *      engine 'nste'  : Qualtrics.SurveyEngine.setJSEmbeddedData(name, value) → survey-flow field "__js_<name>" (UNTESTED)
 *  - DataPipe → OSF (secondary backup, incremental).
 *  - Local runs: download (or POST to the dev server with ?devsave=1).
 * PRIVACY: nothing here ever receives the typed name or the recall notes (tools/privacy_check.html tests this). */
SRL.data = (function () {
  const F = () => window.SRL_FIELDS;
  const pad = (n) => String(n).padStart(2, '0');

  function allFieldNames() {
    const f = F(), out = f.participant.slice();
    for (let i = 1; i <= f.fam_count; i++) f.fam_per_scene.forEach((k) => out.push(`${f.fam_prefix}${pad(i)}_${k}`));
    f.test_types.forEach((t) => f.scene_set_ids.forEach((id) => f.test_per_trial.forEach((k) => out.push(`test_${t}_${id}_${k}`))));
    for (let i = 1; i <= f.json_chunks; i++) out.push(f.json_prefix + i);
    return out.concat(f.json_meta);
  }

  /* Build the wide field object from the run state. */
  function wide(S) {
    const f = F(), w = {};
    f.participant.forEach((k) => { const v = S.p[k]; w[k] = v === undefined || v === null ? '' : v; });
    S.fam.forEach((r, i) => f.fam_per_scene.forEach((k) => (w[`${f.fam_prefix}${pad(i + 1)}_${k}`] = r[k] === undefined || r[k] === null ? '' : r[k])));
    S.tests.forEach((r) => {
      const base = `test_${r.test_type}_${r.scene_set_id}_`;
      w[base + 'choice'] = r.response_id; w[base + 'correct'] = r.correct; w[base + 'rt_ms'] = r.rt_ms;
      w[base + 'foils'] = r.foil_ids; w[base + 'position'] = r.target_position;
    });
    return w;
  }

  /* Qualtrics' classic layouts load Prototype.js, which adds Array.prototype.toJSON; JSON.stringify then turns
   * arrays into strings. Remove it for the duration of the call. */
  function stringify(obj, space) {
    const saved = Array.prototype.toJSON;
    if (saved) delete Array.prototype.toJSON;
    try { return JSON.stringify(obj, null, space); } finally { if (saved) Array.prototype.toJSON = saved; } // eslint-disable-line no-extend-native
  }

  /* Full trial-level backup as compact JSON, split into chunks for the 20 KB-per-value Qualtrics limit. */
  function fullJson(S) {
    return stringify({ v: SRL_CONFIG.VERSION, p: S.p, fam: S.fam, test: S.tests, filler2: S.filler2Trials,
      match: S.matchTrials, checkins: S.checkinRows, events: S.events });
  }
  function chunks(json) {
    const n = SRL_CONFIG.JSON_CHUNKS, size = SRL_CONFIG.JSON_CHUNK_CHARS, out = [];
    for (let i = 0; i < n; i++) out.push(json.slice(i * size, (i + 1) * size));
    return { parts: out, truncated: json.length > n * size ? 1 : 0, length: json.length };
  }

  function setQualtrics(fields) {
    const engine = SRL_CONFIG.QUALTRICS_ENGINE;
    const QSE = window.Qualtrics && window.Qualtrics.SurveyEngine;
    if (!QSE) throw new Error('Qualtrics.SurveyEngine not available');
    Object.keys(fields).forEach((k) => {
      const v = String(fields[k]);
      if (engine === 'nste') QSE.setJSEmbeddedData(k, v);
      else QSE.setEmbeddedData(k, v);
    });
  }

  async function dataPipe(S, label, payload) {
    const D = SRL_CONFIG.DATAPIPE;
    if (!D.ENABLED || S.debug || !D.EXPERIMENT_ID || D.EXPERIMENT_ID === 'DATAPIPE_EXPERIMENT_ID') return 'skipped';
    const id = (S.params.PROLIFIC_PID || 'nopid') + '_' + (S.params.ResponseID || S.sessionKey);
    try {
      const res = await fetch(D.URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: '*/*' },
        body: stringify({ experimentID: D.EXPERIMENT_ID, filename: `${id}_${label}.json`, data: payload }) });
      return res.ok ? 'ok' : 'http_' + res.status;
    } catch (e) { return 'error'; }
  }

  function download(name, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: type || 'text/plain' }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
  }
  async function devSave(path, text) {
    try { await fetch('/__save?path=' + encodeURIComponent(path), { method: 'POST', body: text }); } catch (e) { /* ignore */ }
  }

  /* Final save. Returns the field object that was written. */
  async function finalSave(S, jsPsych) {
    const fields = wide(S);
    const json = fullJson(S);
    const c = chunks(json);
    c.parts.forEach((p, i) => (fields[F().json_prefix + (i + 1)] = p));
    fields.full_data_json_n = c.length; fields.full_data_json_truncated = c.truncated;
    S.saveStatus.datapipe_final = await dataPipe(S, 'final', json);
    if (S.mode === 'qualtrics') {
      setQualtrics(fields);
    } else {
      const csv = jsPsych.data.get().csv();
      const tag = (S.params.PROLIFIC_PID || 'local') + '_' + S.condition + '_' + S.strangerSet + '_' + S.p.test_order.replace(/>/g, '-');
      if (S.params.devsave === '1') {
        await devSave(`sample_data/${tag}_trials.csv`, csv);
        await devSave(`sample_data/${tag}_qualtrics_fields.json`, stringify(fields, 1));
      } else if (S.debug) {
        download(`${tag}_trials.csv`, csv, 'text/csv');
        download(`${tag}_qualtrics_fields.json`, stringify(fields, 1), 'application/json');
      }
      console.log('[SRL] fields', fields);
    }
    return fields;
  }

  return { fields: F, allFieldNames, wide, fullJson, chunks, finalSave, dataPipe, setQualtrics, stringify };
})();
