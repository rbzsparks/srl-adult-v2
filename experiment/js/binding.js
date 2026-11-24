/* binding.js: linking the avatar to the person (PERSON_BINDING_SETUP.md) and the person check-ins during
 * familiarization (PERSON_CHECKINS.md). Every step treats the known avatar and the unfamiliar avatar the same:
 * same screen time, same layout and size, same number of matching trials and check-in questions.
 *
 * PRIVACY: the typed name (S.knownName) and the recall notes (S.notes) live only in memory. Nothing here returns,
 * logs or stores them: data objects hold labels ('known' / 'unfamiliar'), option text, counts and times only.
 * The notes are deleted from memory by main.js as soon as the last designer visit is over.
 * Control condition (v2.4): S.knownName holds the assigned name (CONTROL_NAMES; recorded as control_name, as it is not
 * personal) and S.targetSpec the avatar to copy. */
SRL.binding = (function () {
  const U = SRL.util, UI = SRL.ui, P = SRL.people, C = () => SRL_CONFIG;
  const esc = U.escapeHtml;
  const auto = (S, fn, ms) => { if (S.auto) setTimeout(fn, ms || 150); };
  // Two animation frames: the browser has painted the new content before a reaction-time clock starts.
  const painted = () => new Promise((r) => U.frame(() => U.frame(r)));
  const median = (a) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); };
  // Test hook for tools/privacy_check.html: the autopilot types these instead of its defaults (debug + auto only).
  const autoText = () => window.SRL_AUTOPILOT_TEXT || {};

  // One avatar with its name beneath. Same size and position for both people on every screen that uses it.
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

  /* ---------- §0 Contact frequency: two questions on one screen ---------- */
  async function contact(el, S) {
    const nm = esc(S.knownName), opts = C().CONTACT_FREQ;   // listed from most to least often; coded 7 .. 1
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

  /* ---------- §1 Recall prompts. The notes go to S.notes (memory only); only counts are returned. ---------- */
  const RECALL_Q = (nm) => ['Where were you?', `What was ${nm} doing or wearing?`, `What does ${nm}'s face look like when they smile or laugh?`];
  const RECALL_SHORT = ['Where', 'Doing / wearing', 'Smiling / laughing'];
  async function recall(el, S) {
    const t0 = U.now(), nm = esc(S.knownName);
    const p1 = UI.page(el, `<h1>Picture ${nm}</h1>
      <p class="srl-lead bd-pause">Take a moment to picture the last time you saw <b>${nm}</b>: where you were and what they were like.</p>
      <div class="srl-actions"><button class="srl-btn" id="go">Continue</button></div>`);
    await delayedButton(p1, 8000, S, true);
    const qs = RECALL_Q(nm);
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
    const n = S.notes || [];
    if (!n.some((x) => x)) return '';
    return `<div class="dz-notes"><div class="dz-notes-h">Your notes (not saved)</div>${n.map((x, i) => (x ? `<p><b>${RECALL_SHORT[i]}:</b> ${esc(x)}</p>` : '')).join('')}</div>`;
  }

  /* ---------- Control condition: the avatar to copy ---------- */
  // Two avatars side by side with a label above each (control: the target and the participant's copy).
  const pairLabeled = (a, la, b, lb, w) => `<div class="bd-pair">${[[a, la], [b, lb]].map(([s, l]) => `<div class="bd-fig"><div class="bd-lab">${l}</div>` +
    `<div class="bd-av" style="width:${w}px;height:${Math.round(w * 1.2)}px">${P.svg(s, { attrs: `width="${w}" height="${Math.round(w * 1.2)}"`, label: 'avatar' })}</div></div>`).join('')}</div>`;
  async function copyIntro(el, S) {
    const t0 = U.now();
    const pg = UI.page(el, `<h1>Copy this avatar</h1><div class="bd-center">
      <div class="bd-fig"><div class="bd-av" style="width:250px;height:300px">${P.svg(S.targetSpec, { attrs: 'width="250" height="300"', label: 'avatar to copy' })}</div></div>
      <p class="srl-lead bd-say">Next you'll make a simple cartoon avatar. Your task is to make it look as much like this one as you can. This avatar will stay on screen while you work.</p>
      <div class="srl-actions bd-actions-c"><button class="srl-btn" id="go">Start</button></div></div>`);
    await delayedButton(pg, 3000, S);
    return { copy_intro_ms: Math.round(U.now() - t0) };
  }

  /* ---------- §2 Revision offer (after a likeness rating of 4 or lower) ---------- */
  async function revisionOffer(el, S, spec) {
    const pg = UI.page(el, `<div class="bd-center">${S.control ? pairLabeled(S.targetSpec, 'Avatar to copy', spec, 'Your avatar', 200) : figure(spec, S.knownName, 220)}
      <p class="srl-lead">${S.control ? 'Would you like to adjust your avatar to look more like the one you copied? You can make changes once.' : 'Would you like to adjust the avatar? You can make changes once.'}</p>
      <div class="srl-actions bd-actions-c"><button class="srl-btn srl-btn-secondary" id="keep">Keep as is</button><button class="srl-btn" id="adj">Adjust</button></div></div>`);
    auto(S, () => pg.querySelector('#adj').click());
    return new Promise((resolve) => {
      pg.querySelector('#adj').onclick = () => resolve(true);
      pg.querySelector('#keep').onclick = () => resolve(false);
    });
  }

  /* ---------- §2 Confirmation and §3 introduction: identical layout for both people ---------- */
  async function personScreen(el, S, spec, name, text, btnLabel) {
    const t0 = U.now();
    const pg = UI.page(el, `<div class="bd-center">${figure(spec, name)}<p class="srl-lead bd-say">${text}</p>
      <div class="srl-actions bd-actions-c"><button class="srl-btn" id="go">${btnLabel}</button></div></div>`);
    await delayedButton(pg, 3000, S);
    return Math.round(U.now() - t0);
  }
  // Control: the copy is given its name here, for the first time.
  const confirm = async (el, S) => ({ confirm_ms: await personScreen(el, S, S.knownSpec, S.knownName, S.control
    ? `From here on, this avatar is <b>${esc(S.knownName)}</b>.`
    : `From here on, this avatar is <b>${esc(S.knownName)}</b>. Whenever you see it, picture ${esc(S.knownName)}.`, `OK, this is ${esc(S.knownName)}`) });
  const introduce = async (el, S) => ({ jordan_intro_ms: await personScreen(el, S, S.unfamiliarSpec, S.unfamiliarName,
    `This is <b>${esc(S.unfamiliarName)}</b>. You haven't met ${esc(S.unfamiliarName)} before.`, `OK, this is ${esc(S.unfamiliarName)}`) });

  /* ---------- §4 Avatar–name matching (after Sui, He & Humphreys, 2012) ---------- */
  const MATCH_TYPES = { kk: ['known', 'known'], uu: ['unfamiliar', 'unfamiliar'], ku: ['known', 'unfamiliar'], uk: ['unfamiliar', 'known'] };
  // Random order with no more than 3 of one type in a row and no more than 4 of one correct answer in a row.
  function matchOrder(rng, perType) {
    const base = [];
    Object.keys(MATCH_TYPES).forEach((t) => { for (let i = 0; i < perType; i++) base.push(t); });
    const isMatch = (t) => t === 'kk' || t === 'uu';
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
    const nm = esc(S.knownName), un = esc(S.unfamiliarName);
    // Key reminder laid out like the keyboard: F always on the left, J on the right, whichever one means "matches".
    const keys = `<p class="bd-keys"><span><b>F</b> = ${fMatch ? 'matches' : "doesn't match"}</span><span><b>J</b> = ${fMatch ? "doesn't match" : 'matches'}</span></p>`;
    const pg = UI.page(el, `<h1>Matching names</h1>
      <p class="srl-lead">You'll see a person with a name below them. Press <b>${keyFor(true)}</b> if the name matches the person and <b>${keyFor(false)}</b> if it doesn't. Be quick and accurate.</p>
      <div class="bd-pair">${figure(S.knownSpec, S.knownName, 150)}${figure(S.unfamiliarSpec, S.unfamiliarName, 150)}</div>
      <p class="srl-note">These are ${nm} and ${un}. Put your fingers on the <b>F</b> and <b>J</b> keys.</p>${keys}
      <div class="srl-actions"><button class="srl-btn" id="go">Start</button></div>`);
    auto(S, () => pg.querySelector('#go').click());
    await UI.onClick(pg.querySelector('#go'));

    const order = matchOrder(S.rng2, T.MATCH_TRIALS_PER_TYPE);
    const maxRt = T.MATCH_MAX_RT_MS;
    el.innerHTML = `<div class="srl-page bd-match"><div class="bd-mstage"></div>
      ${keys}</div>`;
    const stage = el.querySelector('.bd-mstage');
    const trials = [];
    for (let i = 0; i < order.length; i++) {
      const type = order[i], [av, nmL] = MATCH_TYPES[type], match = av === nmL ? 1 : 0;
      stage.innerHTML = '<div class="bd-fix">+</div>';
      await U.sleep(S.auto ? 20 : 500);
      stage.innerHTML = figure(av === 'known' ? S.knownSpec : S.unfamiliarSpec, nmL === 'known' ? S.knownName : S.unfamiliarName, 220);
      await painted();
      const t0 = U.now(), cancelRef = {};
      if (S.auto) setTimeout(() => cancelRef.cancel && cancelRef.cancel(), 30);
      const k = await UI.waitKey(['KeyF', 'KeyJ'], { timeout: maxRt, cancelRef });
      const key = k.auto ? keyFor(match) : k.key === 'KeyF' ? 'F' : k.key === 'KeyJ' ? 'J' : '';
      const rt = k.timedOut ? null : Math.round(k.time - t0);
      const correct = !k.timedOut && key === keyFor(match) ? 1 : 0;
      trials.push({ trial: i + 1, type, avatar: av, name: nmL, match, key, correct, rt_ms: rt, timed_out: k.timedOut ? 1 : 0 });
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
    out.match_flag = acc < T.MATCH_FLAG_BELOW ? 1 : 0;
    return out;
  }

  /* ---------- Check-ins (PERSON_CHECKINS.md) ---------- */
  const CHECKIN_Q = {
    feel: { q: (n) => `How do you think ${n} is feeling these days?`, opts: ['Not great', 'Okay', 'Good', 'Great', 'Not sure'] },
    evening: { q: (n) => `Would ${n} rather spend a free evening at home or out somewhere?`, opts: ['At home', 'Out somewhere', 'Not sure'] },
    dayoff: { q: (n) => `With a day off tomorrow, would ${n} plan it or play it by ear?`, opts: ['Plan it', 'Play it by ear', 'Not sure'] }
  };
  // Latin square over the 3 check-in positions; one row per participant.
  const CHECKIN_ORDERS = [['feel', 'evening', 'dayoff'], ['evening', 'dayoff', 'feel'], ['dayoff', 'feel', 'evening']];

  async function askPerson(el, S, qid, who) {
    const Q = CHECKIN_Q[qid], name = who === 'known' ? S.knownName : S.unfamiliarName;
    const pg = UI.page(el, `<h1 class="bd-ci-h">Quick question. Your best guess is fine.</h1>
      <div class="bd-ci">${figure(who === 'known' ? S.knownSpec : S.unfamiliarSpec, name, 230)}
        <div class="bd-ci-q"><p class="srl-lead">${Q.q('<b>' + esc(name) + '</b>')}</p>
        <div class="bd-ci-opts">${Q.opts.map((o, i) => `<button type="button" class="bd-ci-btn" data-i="${i}">${esc(o)}</button>`).join('')}</div></div></div>`);
    await painted();
    const t0 = U.now();
    auto(S, () => pg.querySelectorAll('.bd-ci-btn')[Math.floor(S.rng2() * Q.opts.length)].click(), 60);
    const i = await new Promise((resolve) => pg.querySelectorAll('.bd-ci-btn').forEach((b) => (b.onclick = () => resolve(+b.dataset.i))));
    return { resp: Q.opts[i], rt: Math.round(U.now() - t0) };
  }

  async function checkin(el, S, k, afterTrial) {
    const qid = S.checkinOrder[k - 1], first = S.rng2() < 0.5 ? 'known' : 'unfamiliar';
    const second = first === 'known' ? 'unfamiliar' : 'known';
    const a = await askPerson(el, S, qid, first);
    el.innerHTML = ''; await U.sleep(S.auto ? 20 : 300);
    const b = await askPerson(el, S, qid, second);
    const r = { [first]: a, [second]: b };
    const p = 'checkin_' + k + '_';
    const out = { [p + 'qid']: qid, [p + 'first']: first, [p + 'after_trial']: afterTrial,
      [p + 'known_resp']: r.known.resp, [p + 'known_rt_ms']: r.known.rt, [p + 'unf_resp']: r.unfamiliar.resp, [p + 'unf_rt_ms']: r.unfamiliar.rt };
    [first, second].forEach((who, j) => S.checkinRows.push({ checkin: k, after_trial: afterTrial, qid, person: who, order_in_pair: j + 1, response: r[who].resp, rt_ms: r[who].rt }));
    el.innerHTML = '';
    await U.sleep(500);   // blank before the next scene
    return out;
  }

  /* ---------- §6 Rating after the scenes ---------- */
  async function represent(el, S) {
    const nm = esc(S.knownName), anchors = { 1: 'Not at all', 7: 'Completely' };
    el.innerHTML = `<div class="srl-page dz-like">
      <h1>While watching the scenes, how much did the avatar feel like ${nm}?</h1>
      <div class="dz-like-wrap"><div class="dz-preview dz-preview-sm">${P.svg(S.knownSpec, { attrs: 'width="240" height="288"' })}</div>
        <div class="dz-like-scale"><div class="dz-like-row">${[1, 2, 3, 4, 5, 6, 7].map((k) => `<button type="button" class="dz-like-btn" data-k="${k}"><b>${k}</b><span>${anchors[k] || ''}</span></button>`).join('')}</div>
        <p class="srl-note">1 = not at all, 7 = completely.</p></div></div>
      <div class="srl-actions"><button class="srl-btn" id="go" disabled>Continue</button></div></div>`;
    const t0 = U.now(); let val = null;
    el.querySelectorAll('.dz-like-btn').forEach((b) => (b.onclick = () => {
      val = +b.dataset.k; el.querySelectorAll('.dz-like-btn').forEach((x) => x.classList.toggle('sel', x === b)); el.querySelector('#go').disabled = false;
    }));
    auto(S, () => { el.querySelector('[data-k="6"]').click(); el.querySelector('#go').click(); });
    await UI.onClick(el.querySelector('#go'));
    return { represent_rating: val, represent_rt_ms: Math.round(U.now() - t0) };
  }

  return { contact, recall, notesPanel, copyIntro, pairLabeled, revisionOffer, confirm, introduce, matching, matchOrder, checkin, represent, CHECKIN_Q, CHECKIN_ORDERS, RECALL_Q };
})();
