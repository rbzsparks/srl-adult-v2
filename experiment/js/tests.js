/* tests.js: memory tests. Word (4-AFC objects), Face (2-AFC stranger vs matched foil), Incidental (4-AFC colors).
 * Prompts are spoken by the narrator and shown as text. RT is measured from option onset to click. */
SRL.tests = (function () {
  const U = SRL.util, UI = SRL.ui, P = SRL.people, O = SRL.objects;
  // Familiarization positions (1-12) of a scene set: [first showing, second showing (repeat6 only)].
  // A plain loop: Qualtrics' Prototype.js replaces Array.prototype.find.
  const famPos = (S, id) => { const out = []; for (let i = 0; i < S.design.fam.length; i++) if (S.design.fam[i].id === id) out.push(i + 1); return out; };
  const esc = U.escapeHtml;

  const BLOCK_INTRO = {
    word: 'Each question shows four objects from the scenes. Click the object that was given the name.',
    face: 'Each question shows two people. Click the person you saw in the scenes.',
    incid: 'Each question asks about an object that was on the shelf in one of the scenes. Click the color it was.'
  };

  async function blockIntro(el, S, type, idx) {
    return SRL.screens.message(el, S, `Questions: part ${idx + 1} of 3`, `<p class="srl-lead">${BLOCK_INTRO[type]}</p>
      <p>Each question is read aloud. Please answer as accurately as you can. If you're not sure, make your best guess.</p>`, 'Begin');
  }

  function optionHtml(trial, opt) {
    const s = trial.set;
    if (trial.type === 'word') return O.novelSvg(opt.id, 'width="170" height="170"');
    if (trial.type === 'face') {
      const spec = opt.target ? s.stranger : s.foil;
      return P.svg(spec, { attrs: 'width="220" height="264"' });
    }
    return O.incidentalSvg(s.incidental, SRL.stimuli.data().incidental_colors[opt.id], 'width="130" height="130"');
  }

  function promptText(trial) {
    if (trial.type === 'word') return `Which one is the <b>${esc(trial.set.word)}</b>?`;
    if (trial.type === 'face') return 'Which of these people did you see?';
    return `What color was the <b>${esc(trial.set.incidental_label)}</b>?`;
  }
  function clipId(trial) {
    if (trial.type === 'word') return 'test_word_' + trial.set.word;
    if (trial.type === 'face') return 'test_face';
    return 'test_incid_' + trial.set.incidental;
  }

  async function confidence(el, S) {
    const pg = UI.page(el, `<p class="srl-lead">How confident are you in that answer?</p>
      <div class="srl-actions srl-center">${[1, 2, 3, 4].map((k) => `<button class="srl-btn srl-btn-secondary" data-k="${k}">${k}${k === 1 ? ' (guessing)' : k === 4 ? ' (very sure)' : ''}</button>`).join(' ')}</div>`);
    return new Promise((resolve) => {
      pg.querySelectorAll('[data-k]').forEach((b) => (b.onclick = () => resolve(+b.dataset.k)));
      if (S.auto) setTimeout(() => pg.querySelector('[data-k="3"]').click(), 100);
    });
  }

  async function trial(el, S, t) {
    const s = t.set;
    const pg = UI.page(el, `<div class="ts-prompt">${promptText(t)}</div>
      <div class="ts-options ts-${t.type}">${t.options.map((o, i) => `<button type="button" class="ts-opt" data-i="${i}">${optionHtml(t, o)}</button>`).join('')}</div>`, { cls: 'srl-test' });
    if (S.debug) UI.debug(`${t.type} | ${s.id} | ${s.condition} | target pos ${t.options.findIndex((o) => (t.type === 'word' ? o.set_id === s.id : o.target)) + 1}`);
    const t0 = U.now();
    const audioP = SRL.audio.play(clipId(t));
    let audioDone = false; audioP.then(() => (audioDone = true));
    const idx = await new Promise((resolve) => {
      pg.querySelectorAll('.ts-opt').forEach((b) => (b.onclick = () => resolve(+b.dataset.i)));
      if (S.auto) setTimeout(() => resolve(U.randInt(t.options.length)), 200);
    });
    const rt = Math.round(U.now() - t0);
    pg.querySelectorAll('.ts-opt')[idx].classList.add('sel');
    const isTarget = (o) => (t.type === 'word' ? o.set_id === s.id : o.target);
    const targetPos = t.options.findIndex(isTarget) + 1;
    const resp = t.options[idx];
    let conf = null;
    await U.sleep(150);
    if (SRL_CONFIG.CONFIDENCE_RATINGS) conf = await confidence(el, S);
    UI.debug('');
    el.innerHTML = '';
    await U.sleep(S.timing.TEST_ITI);
    const foilOpts = t.options.filter((o) => !isTarget(o));
    const idOf = (o) => (t.type === 'face' ? (o.target ? s.stranger.id : s.foil.id) : o.id);
    return {
      test_type: t.type, scene_set_id: s.id, condition: s.condition, serial_position: famPos(S, s.id)[0] || null,
      serial_position_2: famPos(S, s.id)[1] || null,
      target_id: t.type === 'word' ? s.object_id : t.type === 'face' ? s.stranger.id : s.incidental_color,
      foil_ids: foilOpts.map(idOf).join('|'),
      foil_conditions: t.type === 'word' ? foilOpts.map((o) => o.condition).join('|') : '',
      foil_scene_sets: t.type === 'word' ? foilOpts.map((o) => o.set_id).join('|') : '',
      option_order: t.options.map(idOf).join('|'),
      target_position: targetPos, response_position: idx + 1, response_id: idOf(resp),
      correct: isTarget(resp) ? 1 : 0, rt_ms: rt, responded_before_prompt_end: audioDone ? 0 : 1,
      vowel_rule_met: t.type === 'word' ? (t.vowel_rule_met ? 1 : 0) : null,
      word: s.word, incidental_type: s.incidental, confidence: conf
    };
  }

  return { blockIntro, trial };
})();
