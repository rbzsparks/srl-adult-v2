/* tests.js: the three surprise 4-AFC memory tests (v3.0), in the participant's test order:
 *   word:     "Which one is the bosa?"  4 objects from the scenes
 *   identity: "Which one is Riley?"     4 strangers from the scenes (the other options are strangers the participant saw)
 *   colour:   "What color was the mug?" 4 colours (or 2, config COLOUR_CHOICES)
 * Prompts are spoken by the narrator and shown as text. RT is measured from option onset to click. */
SRL.tests = (function () {
  const U = SRL.util, UI = SRL.ui, P = SRL.people, O = SRL.objects;
  // Familiarization positions (1-12) of a scene set: [first showing, second showing]. A plain loop (Prototype.js).
  const famPos = (S, id) => { const out = []; for (let i = 0; i < S.design.fam.length; i++) if (S.design.fam[i].id === id) out.push(i + 1); return out; };
  const esc = U.escapeHtml;

  const BLOCK_INTRO = {
    word: 'Each question shows four objects from the scenes. Click the object that was given the name.',
    identity: 'Each question shows four people from the scenes. Click the person with the name you hear.',
    colour: 'Each question asks about an object that was on the shelf in one of the scenes. Click the color it was.'
  };

  async function blockIntro(el, S, type, idx) {
    return SRL.screens.message(el, S, `Questions: part ${idx + 1} of 3`, `<p class="srl-lead">${BLOCK_INTRO[type]}</p>
      <p>Each question is read aloud. Please answer as accurately as you can. If you're not sure, make your best guess.</p>`, 'Begin');
  }

  function optionHtml(t, opt) {
    if (t.type === 'word') return O.novelSvg(opt.id, 'width="170" height="170"');
    if (t.type === 'identity') return P.svg(SRL.stimuli.strangers().filter((x) => x.id === opt.id)[0], { attrs: 'width="190" height="228"' });
    return O.incidentalSvg(t.set.incidental, SRL.stimuli.data().incidental_colors[opt.id], 'width="130" height="130"');
  }
  const promptText = (t) => (t.type === 'word' ? `Which one is the <b>${esc(t.set.word)}</b>?`
    : t.type === 'identity' ? `Which one is <b>${esc(t.set.stranger_name)}</b>?` : `What color was the <b>${esc(t.set.incidental_label)}</b>?`);
  const clipId = (t) => (t.type === 'word' ? 'test_word_' + t.set.word
    : t.type === 'identity' ? 'test_identity_' + SRL.names.clipKey(t.set.stranger_name) : 'test_incid_' + t.set.incidental);

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
    const targetPos = t.options.findIndex((o) => o.target) + 1;
    if (S.debug) UI.debug(`${t.type} | ${s.id} | target pos ${targetPos}`);
    const t0 = U.now();
    let audioDone = false;
    SRL.audio.play(clipId(t)).then(() => (audioDone = true));
    const idx = await new Promise((resolve) => {
      pg.querySelectorAll('.ts-opt').forEach((b) => (b.onclick = () => resolve(+b.dataset.i)));
      if (S.auto) setTimeout(() => resolve(U.randInt(t.options.length)), 200);
    });
    const rt = Math.round(U.now() - t0);
    pg.querySelectorAll('.ts-opt')[idx].classList.add('sel');
    let conf = null;
    await U.sleep(150);
    if (SRL_CONFIG.CONFIDENCE_RATINGS) conf = await confidence(el, S);
    UI.debug('');
    el.innerHTML = '';
    await U.sleep(S.timing.TEST_ITI);
    const resp = t.options[idx], fp = famPos(S, s.id);
    return {
      test_type: t.type, scene_set_id: s.id, serial_position: fp[0] || null, serial_position_2: fp[1] || null,
      target_id: t.type === 'word' ? s.object_id : t.type === 'identity' ? s.stranger.id : s.incidental_color,
      target_name: t.type === 'identity' ? s.stranger_name : '',
      foil_ids: t.options.filter((o) => !o.target).map((o) => o.id).join('|'),
      option_order: t.options.map((o) => o.id).join('|'),
      target_position: targetPos, response_position: idx + 1, response_id: resp.id,
      correct: resp.target ? 1 : 0, rt_ms: rt, responded_before_prompt_end: audioDone ? 0 : 1,
      word: s.word, incidental_type: s.incidental, stranger_id: s.stranger.id, confidence: conf
    };
  }

  return { blockIntro, trial };
})();
