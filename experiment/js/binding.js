/* binding.js: linking the avatar to the person it stands for (v3.0, docs/V2_SPEC.md §3-5), the check-ins during the
 * scenes, and the "felt like" rating. Known and control participants go through the same screens with the same
 * minimum times; only the wording differs (the typed name vs the assigned control name).
 *
 * PRIVACY: the typed name (S.knownName in the known condition) and the notes (S.notes) live only in memory. Nothing here
 * returns, logs or stores them: data objects hold labels, option text, counts and times only. The notes are deleted
 * from memory by main.js as soon as the last designer visit is over. The control name is not personal and is recorded. */
SRL.binding = (function () {
  const U = SRL.util, UI = SRL.ui, P = SRL.people, C = () => SRL_CONFIG;
  const esc = U.escapeHtml;
  const auto = (S, fn, ms) => { if (S.auto) setTimeout(fn, ms || 150); };
  // Two animation frames: the browser has painted the new content before a reaction-time clock starts.
  const painted = () => new Promise((r) => U.frame(() => U.frame(r)));
  const median = (a) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); };
  // Test hook for tools/privacy_check.html: the autopilot types these instead of its defaults (debug + auto only).
  const autoText = () => window.SRL_AUTOPILOT_TEXT || {};

  // One avatar with its name beneath.
  const figure = (spec, name, size) => {
    const w = size || 250, h = Math.round(w * 1.2);
    return `<div class="bd-fig"><div class="bd-av" style="width:${w}px;height:${h}px">${P.svg(spec, { attrs: `width="${w}" height="${h}"`, label: 'avatar' })}</div>
      <div class="bd-name">${esc(name)}</div></div>`;
  };

  // The page's button appears after ms (show=false), or is visible but disabled until then (show=true).
  async function delayedButton(pg, ms, S, show) {
    const btn = pg.querySelector('#go');
    if (show) btn.disabled = true; else btn.style.visibility = 'hidden';
    await U.sleep(S.auto ? 50 : ms);
    btn.disabled = false; btn.style.visibility = 'visible';
    auto(S, () => btn.click(), 100);
    await UI.onClick(btn);
  }

  // A 1-7 scale with anchors at the ends. Returns { value, rt }.
  async function scale7(el, S, title, html, anchors, autoVal, onPage) {
    const pg = UI.page(el, `<h1>${title}</h1>${html || ''}
      <div class="bd-scale">${[1, 2, 3, 4, 5, 6, 7].map((k) => `<button type="button" class="dz-like-btn" data-k="${k}"><b>${k}</b><span>${anchors[k] || ''}</span></button>`).join('')}</div>
      <div class="srl-actions"><button class="srl-btn" id="go" disabled>Continue</button></div>`, { cls: 'bd-scale-page' });
    if (onPage) onPage(pg);
    await painted();
    const t0 = U.now(); let val = null;
    pg.querySelectorAll('.dz-like-btn').forEach((b) => (b.onclick = () => {
      val = +b.dataset.k; pg.querySelectorAll('.dz-like-btn').forEach((x) => x.classList.toggle('sel', x === b)); pg.querySelector('#go').disabled = false;
    }));
    auto(S, () => { pg.querySelector(`[data-k="${autoVal || 5}"]`).click(); pg.querySelector('#go').click(); });
    await UI.onClick(pg.querySelector('#go'));
    return { value: val, rt: Math.round(U.now() - t0) };
  }

  /* ---------- Known: closeness (1-7) and contact frequency ---------- */
  async function closeness(el, S) {
    const a = await scale7(el, S, 'Closeness', `<p class="srl-lead">${C().CLOSENESS_Q.replace('{name}', esc(S.knownName))}</p>`, C().CLOSENESS_ANCHORS, 7);
    return { closeness: a.value, closeness_rt_ms: a.rt };
  }

  async function contact(el, S) {
    const nm = esc(S.knownName), opts = C().CONTACT_FREQ;
    const group = (name, q, extra) => `<div class="bd-q"><div class="bd-qhead"><p class="bd-qtext">${q}</p>${extra || ''}</div><div class="bd-radios">${opts.map((o, i) =>
      `<label class="srl-radio"><input type="radio" name="${name}" value="${opts.length - i}"> <span>${esc(o)}</span></label>`).join('')}</div></div>`;
    const pg = UI.page(el, `<h1>How often</h1><div class="bd-two">
      ${group('inperson', `How often do you see <b>${nm}</b> in person?`)}
      ${group('remote', `How often do you talk with <b>${nm}</b> in other ways (texting, messaging, phone or video calls)?`,
        `<p class="srl-note bd-clar">Count only messages or calls between you and ${nm} directly, including group chats where you message each other. Don't count just seeing their posts on social media.</p>`)}
      </div><div class="srl-actions"><button class="srl-btn" id="go" disabled>Continue</button></div>`, { cls: 'bd-contact' });
    const btn = pg.querySelector('#go');
    const val = (n) => { const r = pg.querySelector(`input[name="${n}"]:checked`); return r ? +r.value : null; };
    pg.querySelectorAll('input').forEach((r) => (r.onchange = () => (btn.disabled = !(val('inperson') && val('remote')))));
    auto(S, () => { pg.querySelectorAll('input[name="inperson"]')[1].click(); pg.querySelectorAll('input[name="remote"]')[0].click(); btn.click(); });
    await UI.onClick(btn);
    const a = val('inperson'), b = val('remote');
    return { contact_inperson: a, contact_remote: b, contact_max: Math.max(a, b) };
  }

  /* ---------- Control: the person the avatar will be ---------- */
  async function controlIntro(el, S) {
    const t0 = U.now(), nm = esc(S.knownName);
    const pg = UI.page(el, `<h1>Someone named ${nm}</h1>
      <p class="srl-lead">In this study you'll create a person named <b>${nm}</b>.</p>
      <p>You'll picture what ${nm} might be like, make a simple cartoon avatar of them, and choose a voice for them.</p>
      <div class="srl-actions"><button class="srl-btn" id="go">Continue</button></div>`);
    await delayedButton(pg, 3000, S, true);
    return { control_intro_ms: Math.round(U.now() - t0) };
  }

  /* ---------- Picture + notes. Known: recall; control: imagine. Notes go to S.notes (memory only). ---------- */
  const NOTES_Q = (S, nm) => (S.control
    ? [`Where might you run into ${nm}?`, `What might ${nm} be doing or wearing?`, `What does ${nm}'s face look like when they smile or laugh?`]
    : ['Where were you?', `What was ${nm} doing or wearing?`, `What does ${nm}'s face look like when they smile or laugh?`]);
  const NOTES_SHORT = ['Where', 'Doing / wearing', 'Smiling / laughing'];
  async function recall(el, S) {
    const t0 = U.now(), nm = esc(S.knownName);
    const p1 = UI.page(el, `<h1>Picture ${nm}</h1>
      <p class="srl-lead bd-pause">${S.control
        ? `Picture what <b>${nm}</b> might be like: where you might run into them, what they might wear, what their smile is like.`
        : `Take a moment to picture the last time you saw <b>${nm}</b>: where you were and what they were like.`}</p>
      <div class="srl-actions"><button class="srl-btn" id="go">Continue</button></div>`);
    await delayedButton(p1, 8000, S, true);
    const qs = NOTES_Q(S, nm);
    const pg = UI.page(el, `<h1>A few notes about ${nm}</h1>
      ${qs.map((q, i) => `<label class="bd-note"><span>${q}</span><textarea id="n${i}" maxlength="150" rows="2" autocomplete="off" spellcheck="false" autocorrect="off" autocapitalize="off"></textarea></label>`).join('')}
      <p class="srl-note">These notes stay in your browser, help you build the avatar, and are never saved or sent anywhere.</p>
      <div class="srl-actions"><span class="srl-note" id="hint">Write something in at least one box to continue.</span><button class="srl-btn" id="go" disabled>Continue</button></div>`, { cls: 'bd-recall' });
    const boxes = [0, 1, 2].map((i) => pg.querySelector('#n' + i)), btn = pg.querySelector('#go');
    const any = () => boxes.some((b) => b.value.trim().length > 0);
    boxes.forEach((b) => b.addEventListener('input', () => { btn.disabled = !any(); pg.querySelector('#hint').style.visibility = any() ? 'hidden' : 'visible'; }));
    boxes[0].focus();
    auto(S, () => {
      const t = autoText().notes || ['At the park', 'A green jacket', 'Crinkly eyes'];
      boxes.forEach((b, i) => (b.value = t[i] || ''));
      btn.disabled = false; btn.click();
    }, 200);
    await UI.onClick(btn);
    S.notes = boxes.map((b) => b.value.trim().slice(0, 150));
    const out = { recall_ms: Math.round(U.now() - t0) };
    S.notes.forEach((n, i) => (out['recall_chars_' + (i + 1)] = n.length));
    boxes.forEach((b) => (b.value = ''));
    el.innerHTML = '';
    return out;
  }
  // Side panel for the designer.
  function notesPanel(S) {
    const n = S.notes || [], lab = NOTES_SHORT;
    if (!n.some((x) => x)) return '';
    return `<div class="dz-notes"><div class="dz-notes-h">Your notes (not saved)</div>${n.map((x, i) => (x ? `<p><b>${lab[i]}:</b> ${esc(x)}</p>` : '')).join('')}</div>`;
  }

  /* ---------- Voice selector (+ voice closeness, known only) ---------- */
  async function voice(el, S) {
    const nm = esc(S.knownName), voices = U.shuffle(C().VOICES.map((v) => v.id));
    const pg = UI.page(el, `<h1>${S.control ? `Choose a voice for ${nm}` : `Which voice sounds most like ${nm}?`}</h1>
      <div class="vc-wrap">${figure(S.knownSpec, S.knownName, 200)}
        <div class="vc-main"><p class="srl-lead">${S.control
          ? `Listen to each voice, then choose the one you'd like ${nm} to have.`
          : `Listen to each voice, then choose the one that sounds most like ${nm}. None will be exact; pick the closest.`}</p>
          <div class="vc-list">${voices.map((v, i) => `<div class="vc-row" data-v="${v}"><button type="button" class="srl-btn srl-btn-secondary vc-play">▶ Voice ${i + 1}</button>
            <label class="srl-radio"><input type="radio" name="vc" value="${v}" disabled> <span>Choose voice ${i + 1}</span></label></div>`).join('')}</div>
          <p class="srl-note" id="hint">Play every voice at least once to continue. You can replay them.</p></div></div>
      <div class="srl-actions"><button class="srl-btn" id="go" disabled>Continue</button></div>`, { cls: 'vc-page' });
    const t0 = U.now(), played = {}, plays = {};
    let busy = false;
    const go = pg.querySelector('#go');
    const update = () => {
      const all = voices.every((v) => played[v]), sel = pg.querySelector('input[name="vc"]:checked');
      pg.querySelector('#hint').style.visibility = all ? 'hidden' : 'visible';
      go.disabled = !(all && sel);
    };
    pg.querySelectorAll('.vc-row').forEach((row) => {
      const v = row.dataset.v, btn = row.querySelector('.vc-play');
      btn.onclick = async () => {
        if (busy) return;
        busy = true; pg.querySelectorAll('.vc-play').forEach((b) => (b.disabled = true)); row.classList.add('playing');
        await SRL.audio.unlock();
        plays[v] = (plays[v] || 0) + 1;
        await SRL.audio.play('sel_' + v);
        played[v] = true; row.querySelector('input').disabled = false;
        row.classList.remove('playing'); pg.querySelectorAll('.vc-play').forEach((b) => (b.disabled = false)); busy = false;
        update();
      };
      row.querySelector('input').onchange = update;
    });
    if (S.auto) {
      (async () => {
        for (const v of voices) { pg.querySelector(`.vc-row[data-v="${v}"] .vc-play`).click(); await U.sleep(30); while (busy) await U.sleep(30); }
        pg.querySelector(`input[value="${voices[0]}"]`).click(); update(); go.click();
      })();
    }
    await UI.onClick(go);
    const chosen = pg.querySelector('input[name="vc"]:checked').value;
    const out = { voice_id: chosen, voice_order: voices.join('|'), voice_plays: voices.map((v) => plays[v] || 0).reduce((a, b) => a + b, 0),
      voice_select_ms: Math.round(U.now() - t0) };
    if (!S.control) {
      const a = await scale7(el, S, 'The voice', `<p class="srl-lead">How close is this voice to <b>${nm}</b>'s?</p>
        <div class="srl-actions srl-left"><button class="srl-btn srl-btn-secondary" id="replay">▶ Play the voice again</button></div>`,
      { 1: 'Not at all close', 7: 'Very close' }, 4,
      (p) => { const b = p.querySelector('#replay'); b.onclick = async () => { b.disabled = true; await SRL.audio.play('sel_' + chosen); b.disabled = false; }; });
      out.voice_closeness = a.value; out.voice_closeness_rt_ms = a.rt;
    }
    return out;
  }

  /* ---------- Revision offer (after a likeness rating of 4 or lower) ---------- */
  async function revisionOffer(el, S, spec) {
    const pg = UI.page(el, `<div class="bd-center">${figure(spec, S.knownName, 220)}
      <p class="srl-lead">Would you like to adjust the avatar? You can make changes once.</p>
      <div class="srl-actions bd-actions-c"><button class="srl-btn srl-btn-secondary" id="keep">Keep as is</button><button class="srl-btn" id="adj">Adjust</button></div></div>`);
    auto(S, () => pg.querySelector('#adj').click());
    return new Promise((resolve) => {
      pg.querySelector('#adj').onclick = () => resolve(true);
      pg.querySelector('#keep').onclick = () => resolve(false);
    });
  }

  /* ---------- Confirmation ---------- */
  async function confirm(el, S) {
    const t0 = U.now(), nm = esc(S.knownName);
    const pg = UI.page(el, `<div class="bd-center">${figure(S.knownSpec, S.knownName)}<p class="srl-lead bd-say">From here on, this avatar is <b>${nm}</b>.
      ${S.control ? '' : `Whenever you see it, picture ${nm}.`}</p>
      <div class="srl-actions bd-actions-c"><button class="srl-btn" id="go">OK, this is ${nm}</button></div></div>`);
    await delayedButton(pg, 3000, S);
    return { confirm_ms: Math.round(U.now() - t0) };
  }

  /* ---------- Avatar-name matching (after Sui, He & Humphreys, 2012) ----------
   * k = the designed avatar / its name, f = the foil avatar / the foil name. kk and ff match; kf and fk don't. */
  const MATCH_TYPES = { kk: ['k', 'k'], ff: ['f', 'f'], kf: ['k', 'f'], fk: ['f', 'k'] };
  // Random order with no more than 3 of one type in a row and no more than 4 of one correct answer in a row.
  function matchOrder(rng, perType) {
    const base = [];
    Object.keys(MATCH_TYPES).forEach((t) => { for (let i = 0; i < perType; i++) base.push(t); });
    const isMatch = (t) => t === 'kk' || t === 'ff';
    for (let tries = 0; tries < 10000; tries++) {
      const a = base.slice();
      for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const x = a[i]; a[i] = a[j]; a[j] = x; }
      let ok = true, runT = 1, runM = 1;
      for (let i = 1; i < a.length && ok; i++) {
        runT = a[i] === a[i - 1] ? runT + 1 : 1;
        runM = isMatch(a[i]) === isMatch(a[i - 1]) ? runM + 1 : 1;
        if (runT > 3 || runM > 4) ok = false;
      }
      if (ok) return a;
    }
    throw new Error('matching order: no valid order found');
  }

  async function matching(el, S) {
    const T = C(), fMatch = S.matchKeymap === 'F=match';
    const keyFor = (m) => (m ? (fMatch ? 'F' : 'J') : (fMatch ? 'J' : 'F'));
    const nm = esc(S.knownName), fn = esc(S.foilName);
    const spec = (w) => (w === 'k' ? S.knownSpec : S.foilSpec), name = (w) => (w === 'k' ? S.knownName : S.foilName);
    // Key reminder laid out like the keyboard: F always on the left, J on the right, whichever one means "matches".
    const keys = `<p class="bd-keys"><span><b>F</b> = ${fMatch ? 'matches' : "doesn't match"}</span><span><b>J</b> = ${fMatch ? "doesn't match" : 'matches'}</span></p>`;
    const pg = UI.page(el, `<h1>Matching names</h1>
      <p class="srl-lead">You'll see a person with a name below them. Press <b>${keyFor(true)}</b> if the name matches the person and <b>${keyFor(false)}</b> if it doesn't. Be quick and accurate.</p>
      <div class="bd-pair">${figure(S.knownSpec, S.knownName, 150)}${figure(S.foilSpec, S.foilName, 150)}</div>
      <p class="srl-note">These are ${nm} and ${fn}. Put your fingers on the <b>F</b> and <b>J</b> keys.</p>${keys}
      <div class="srl-actions"><button class="srl-btn" id="go">Start</button></div>`);
    auto(S, () => pg.querySelector('#go').click());
    await UI.onClick(pg.querySelector('#go'));

    const order = matchOrder(S.rng2, T.MATCH_TRIALS_PER_TYPE);
    el.innerHTML = `<div class="srl-page bd-match"><div class="bd-mstage"></div>${keys}</div>`;
    const stage = el.querySelector('.bd-mstage');
    const trials = [];
    for (let i = 0; i < order.length; i++) {
      const type = order[i], [av, nmL] = MATCH_TYPES[type], match = av === nmL ? 1 : 0;
      stage.innerHTML = '<div class="bd-fix">+</div>';
      await U.sleep(S.auto ? 20 : 500);
      stage.innerHTML = figure(spec(av), name(nmL), 220);
      await painted();
      const t0 = U.now(), cancelRef = {};
      if (S.auto) setTimeout(() => cancelRef.cancel && cancelRef.cancel(), 30);
      const k = await UI.waitKey(['KeyF', 'KeyJ'], { timeout: T.MATCH_MAX_RT_MS, cancelRef });
      const key = k.auto ? keyFor(match) : k.key === 'KeyF' ? 'F' : k.key === 'KeyJ' ? 'J' : '';
      const rt = k.timedOut ? null : Math.round(k.time - t0);
      const correct = !k.timedOut && key === keyFor(match) ? 1 : 0;
      trials.push({ trial: i + 1, type, avatar: av === 'k' ? 'avatar' : 'foil', name: nmL === 'k' ? 'avatar' : 'foil', match, key, correct, rt_ms: rt, timed_out: k.timedOut ? 1 : 0 });
      stage.innerHTML = `<div class="bd-fb ${correct ? 'ok' : 'bad'}">${k.timedOut ? 'Too slow' : correct ? 'Correct' : 'Incorrect'}</div>`;
      await U.sleep(S.auto ? 20 : 400);
      stage.innerHTML = '';
      await U.sleep(S.auto ? 10 : 300);
    }
    S.matchTrials = trials;
    const out = { match_keymap: S.matchKeymap };
    Object.keys(MATCH_TYPES).forEach((t) => {
      const tt = trials.filter((r) => r.type === t);
      out['match_acc_' + t] = +(tt.filter((r) => r.correct).length / tt.length).toFixed(3);
      out['match_rt_med_' + t] = median(tt.filter((r) => r.correct).map((r) => r.rt_ms));
    });
    const acc = trials.filter((r) => r.correct).length / trials.length;
    out.match_acc_total = +acc.toFixed(3);
    out.match_n_timeout = trials.filter((r) => r.timed_out).length;
    out.match_no_response = out.match_n_timeout === trials.length ? 1 : 0;
    out.match_flag = acc < T.MATCH_FLAG_BELOW ? 1 : 0;
    return out;
  }

  /* ---------- Check-ins: one question about the avatar person ---------- */
  const CHECKIN_Q = {
    feel: { q: (n) => `How do you think ${n} is feeling these days?`, opts: ['Not great', 'Okay', 'Good', 'Great', 'Not sure'] },
    evening: { q: (n) => `Would ${n} rather spend a free evening at home or out somewhere?`, opts: ['At home', 'Out somewhere', 'Not sure'] },
    dayoff: { q: (n) => `With a day off tomorrow, would ${n} plan it or play it by ear?`, opts: ['Plan it', 'Play it by ear', 'Not sure'] }
  };
  // Latin square over the 3 check-in positions; one row per participant.
  const CHECKIN_ORDERS = [['feel', 'evening', 'dayoff'], ['evening', 'dayoff', 'feel'], ['dayoff', 'feel', 'evening']];

  async function checkin(el, S, k, afterTrial) {
    const qid = S.checkinOrder[k - 1], Q = CHECKIN_Q[qid];
    const pg = UI.page(el, `<h1 class="bd-ci-h">Quick question. Your best guess is fine.</h1>
      <div class="bd-ci">${figure(S.knownSpec, S.knownName, 230)}
        <div class="bd-ci-q"><p class="srl-lead">${Q.q('<b>' + esc(S.knownName) + '</b>')}</p>
        <div class="bd-ci-opts">${Q.opts.map((o, i) => `<button type="button" class="bd-ci-btn" data-i="${i}">${esc(o)}</button>`).join('')}</div></div></div>`);
    await painted();
    const t0 = U.now();
    auto(S, () => pg.querySelectorAll('.bd-ci-btn')[Math.floor(S.rng2() * Q.opts.length)].click(), 60);
    const i = await new Promise((resolve) => pg.querySelectorAll('.bd-ci-btn').forEach((b) => (b.onclick = () => resolve(+b.dataset.i))));
    const rt = Math.round(U.now() - t0), p = 'checkin_' + k + '_';
    S.checkinRows.push({ checkin: k, after_trial: afterTrial, qid, response: Q.opts[i], rt_ms: rt });
    el.innerHTML = '';
    await U.sleep(500);   // blank before the next scene
    return { [p + 'qid']: qid, [p + 'after_trial']: afterTrial, [p + 'resp']: Q.opts[i], [p + 'rt_ms']: rt };
  }

  /* ---------- After the scenes: one wording for both conditions (manipulation check) ---------- */
  async function represent(el, S) {
    const nm = esc(S.knownName);
    const a = await scale7(el, S, `While watching, how much did ${nm} feel like someone you know?`,
      `<div class="bd-center">${figure(S.knownSpec, S.knownName, 170)}</div>`, { 1: 'Not at all', 7: 'Completely' }, S.control ? 2 : 6);
    return { represent_rating: a.value, represent_rt_ms: a.rt };
  }

  return { closeness, contact, controlIntro, recall, notesPanel, voice, revisionOffer, confirm, matching, matchOrder, checkin, represent,
    CHECKIN_Q, CHECKIN_ORDERS };
})();
