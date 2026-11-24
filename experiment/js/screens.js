/* screens.js: setup and instruction screens. Each screen is async (el, S) => data object.
 * PRIVACY: the typed name lives only in S.knownName (memory). It is never put in any data object. */
SRL.screens = (function () {
  const U = SRL.util, UI = SRL.ui, C = () => SRL_CONFIG;
  const esc = U.escapeHtml;
  const nm = (S) => esc(S.knownName || 'this person');

  // Auto-pilot helper (debug + auto=1 only): click an element after a short delay.
  function auto(S, fn, ms) { if (S.auto) setTimeout(fn, ms || 120); }

  async function intro(el, S) {
    const pg = UI.page(el, `
      <h1>Welcome</h1>
      <p>In this part of the study you will:</p>
      <ol>
        <li>${S.control ? 'make a simple cartoon avatar by copying one we show you, and do a short matching task,'
          : 'answer a few questions about someone you know, make a simple cartoon avatar of them, and do a short matching task,'}</li>
        <li>watch short animated scenes,</li>
        <li>do a short arithmetic task, and answer some questions.</li>
      </ol>
      <p><b>Sound is required.</b> Please use headphones or speakers and keep them on throughout.</p>
      <p>The study runs in full screen. Please don't switch tabs or windows until you're finished.</p>
      <div class="srl-actions"><button class="srl-btn" id="go">Start (enter full screen)</button></div>`);
    const btn = pg.querySelector('#go');
    auto(S, () => btn.click());
    await UI.onClick(btn);
    UI.requestFullscreen();
    await SRL.audio.unlock();
    await U.sleep(700);
    const D = C().DEVICE;
    const small = window.innerWidth < D.WINDOW_PROMPT_W || window.innerHeight < D.WINDOW_PROMPT_H;
    if (small) {
      const p2 = UI.page(el, `<h1>Please make your window bigger</h1>
        <p>Your browser window is quite small (${window.innerWidth} × ${window.innerHeight}).
        Please maximize the window, or click <b>Full screen</b>, so the scenes are easy to see.</p>
        <div class="srl-actions"><button class="srl-btn srl-btn-secondary" id="fs">Full screen</button> <button class="srl-btn" id="go">Continue</button></div>`);
      p2.querySelector('#fs').onclick = () => UI.requestFullscreen();
      auto(S, () => p2.querySelector('#go').click());
      await UI.onClick(p2.querySelector('#go'));
    }
    return { window_small_prompt: small ? 1 : 0, fullscreen_after_start: UI.isFullscreen() ? 1 : 0,
      window_w: window.innerWidth, window_h: window.innerHeight, audio_state: SRL.audio.context().state };
  }

  function isTitle(name) {
    const n = name.toLowerCase().replace(/^my\s+/, '').replace(/[^a-z\s]/g, '').trim();
    const titles = C().FAMILY_TITLES;
    if (titles.indexOf(n) >= 0) return true;
    const first = n.split(/\s+/)[0];
    return ['aunt', 'auntie', 'uncle', 'grandma', 'grandpa', 'nana', 'cousin'].indexOf(first) >= 0 && n.split(/\s+/).length > 1 ? true : false;
  }
  function isSuspect(name) {
    const n = name.toLowerCase().replace(/\s/g, '');
    if (['asdf', 'qwer', 'qwerty', 'test', 'none', 'na', 'n/a', 'xxx', 'abc', 'name', 'anonymous', 'person', 'someone', 'idk', 'no'].indexOf(n) >= 0) return true;
    if (!/[aeiouy]/.test(n)) return true;
    if (/(.)\1\1/.test(n)) return true;
    return false;
  }

  async function nameEntry(el, S) {
    const prompt = C().CATEGORIES[S.category];
    const pg = UI.page(el, `
      <h1>Someone you know</h1>
      <p class="srl-lead">${prompt}</p>
      <p>${esc(C().NAME_INSTRUCTION)}</p>
      <p class="srl-note">This name is only used to personalize the study on your screen. It is not saved or sent anywhere.</p>
      <label class="srl-field">First name: <input type="text" id="nm" maxlength="20" autocomplete="off" spellcheck="false"></label>
      <p class="srl-error" id="err"></p>
      <div class="srl-actions"><button class="srl-btn" id="go">Continue</button></div>`);
    const input = pg.querySelector('#nm'), err = pg.querySelector('#err'), btn = pg.querySelector('#go');
    input.focus();
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') btn.click(); });
    let attempts = 0, flagged = 0, invalidCount = 0;
    if (S.auto) setTimeout(() => { input.value = (window.SRL_AUTOPILOT_TEXT || {}).name || 'Alex'; btn.click(); }, 150);
    for (;;) {
      await UI.onClick(btn);
      attempts++;
      const v = input.value.trim().replace(/\s+/g, ' ');
      if (v.length < 1 || v.length > 20 || !/^[\p{L}][\p{L} '’-]*$/u.test(v)) {
        invalidCount++;
        err.textContent = 'Please type a first name using letters only (up to 20 characters).';
        continue;
      }
      if (isTitle(v) && !flagged) {
        flagged = 1;
        err.textContent = 'Please enter their first name rather than a title. (If this is their name, click Continue again.)';
        continue;
      }
      S.knownName = v;
      return { name_length: v.length, name_flagged_title: flagged, name_valid: 1, name_invalid_attempts: invalidCount,
        name_attempts: attempts, name_suspect: isSuspect(v) ? 1 : 0 };
    }
  }

  async function choice(el, S, title, question, options, key, autoIdx) {
    const items = options.map((o, i) => `<label class="srl-radio"><input type="radio" name="c" value="${i}"> <span>${esc(o)}</span></label>`).join('');
    const pg = UI.page(el, `<h1>${title}</h1><p class="srl-lead">${question}</p><div class="srl-radios">${items}</div>
      <div class="srl-actions"><button class="srl-btn" id="go" disabled>Continue</button></div>`);
    const btn = pg.querySelector('#go');
    pg.querySelectorAll('input').forEach((r) => (r.onchange = () => (btn.disabled = false)));
    auto(S, () => { pg.querySelectorAll('input')[autoIdx || 0].click(); btn.click(); });
    await UI.onClick(btn);
    const idx = +pg.querySelector('input:checked').value;
    return { [key]: options[idx] };
  }

  async function relationship(el, S) {
    const d = await choice(el, S, 'How you know them', `How do you know <b>${nm(S)}</b>?`, C().RELATIONSHIP_TYPES, 'relationship_type', 0);
    d.is_kin = C().KIN_TYPES.indexOf(d.relationship_type) >= 0 ? 1 : 0;
    return d;
  }
  const duration = (el, S) => choice(el, S, 'How long', `How long have you known <b>${nm(S)}</b>?`, C().DURATION, 'duration', 1);

  function iosSvg(level, name) {
    // Seven pairs of circles with increasing overlap (Aron, Aron & Smollan, 1992).
    const dist = [62, 50, 40, 30, 21, 13, 6][level - 1];
    const r = 27, cy = 40, c1 = 70 - dist / 2 - 0, cx1 = 70 - dist / 2 - 0;
    const lab = name.length > 9 ? name.slice(0, 8) + '…' : name;
    return `<svg viewBox="0 0 140 80" width="112" height="64"><circle cx="${cx1 - 0}" cy="${cy}" r="${r}" fill="none" stroke="#333" stroke-width="1.6"/>
      <circle cx="${70 + dist / 2}" cy="${cy}" r="${r}" fill="none" stroke="#333" stroke-width="1.6"/>
      <text x="${cx1 - 8}" y="${cy + 4}" text-anchor="middle" font-size="10">Self</text>
      <text x="${70 + dist / 2 + 8}" y="${cy + 4}" text-anchor="middle" font-size="10">${esc(lab)}</text></svg>`;
  }
  async function ios(el, S) {
    const opts = [1, 2, 3, 4, 5, 6, 7].map((k) => `<button type="button" class="srl-ios" data-k="${k}">${iosSvg(k, S.knownName)}<span>${k}</span></button>`).join('');
    const pg = UI.page(el, `<h1>Closeness</h1>
      <p class="srl-lead">Which picture best describes your relationship with <b>${nm(S)}</b>?</p>
      <p class="srl-note">In each picture, one circle is you and the other is ${nm(S)}. Click the picture that fits best.</p>
      <div class="srl-ios-row">${opts}</div>
      <div class="srl-actions"><button class="srl-btn" id="go" disabled>Continue</button></div>`);
    const btn = pg.querySelector('#go'); let sel = null;
    pg.querySelectorAll('.srl-ios').forEach((b) => (b.onclick = () => {
      pg.querySelectorAll('.srl-ios').forEach((x) => x.classList.remove('sel'));
      b.classList.add('sel'); sel = +b.dataset.k; btn.disabled = false;
    }));
    auto(S, () => { pg.querySelectorAll('.srl-ios')[S.category === 'close' ? 5 : S.category === 'moderate' ? 3 : 1].click(); btn.click(); });
    await UI.onClick(btn);
    return { ios: sel };
  }

  async function audioCheck(el, S) {
    const words = C().AUDIO_CHECK_WORDS;
    let pass = 0, attempts = 0, plays = 0;
    const answers = [];
    for (let i = 0; i < words.length && !pass; i++) {
      attempts++;
      const pg = UI.page(el, `<h1>Sound check</h1>
        ${i === 0 ? '<p class="srl-lead">Please turn your sound on and set it to a comfortable level.</p>' : '<p class="srl-lead">That didn\'t match. Let\'s try a different word.</p>'}
        <p>Click <b>Play</b> to hear a word, then type the word you heard.</p>
        <div class="srl-actions srl-left"><button class="srl-btn srl-btn-secondary" id="play">▶ Play</button></div>
        <label class="srl-field">Word: <input type="text" id="ans" maxlength="30" autocomplete="off" spellcheck="false"></label>
        <div class="srl-actions"><button class="srl-btn" id="go" disabled>Continue</button></div>`);
      const play = pg.querySelector('#play'), ans = pg.querySelector('#ans'), go = pg.querySelector('#go');
      let played = false;
      play.onclick = async () => {
        await SRL.audio.unlock(); plays++; played = true; play.disabled = true;
        await SRL.audio.play('check_' + words[i]); play.disabled = false; go.disabled = !ans.value.trim();
      };
      ans.addEventListener('input', () => (go.disabled = !played || !ans.value.trim()));
      ans.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !go.disabled) go.click(); });
      if (S.auto) setTimeout(async () => { play.click(); await U.sleep(200); ans.value = words[i]; go.disabled = false; go.click(); }, 150);
      await UI.onClick(go);
      const a = ans.value.trim().toLowerCase();
      answers.push(a);
      if (U.levenshtein(a, words[i]) <= 1) pass = 1;
    }
    if (!pass) {
      const pg = UI.page(el, `<h1>Sound check</h1><p class="srl-lead">We couldn't confirm your sound. Please make sure your sound is on and turned up; the scenes include speech.</p>
        <div class="srl-actions"><button class="srl-btn" id="go">Continue</button></div>`);
      auto(S, () => pg.querySelector('#go').click());
      await UI.onClick(pg.querySelector('#go'));
    }
    return { audio_check_pass: pass, audio_check_attempts: attempts, audio_check_plays: plays, audio_check_answers: answers.join('|') };
  }

  async function message(el, S, title, html, btnLabel) {
    const pg = UI.page(el, `<h1>${title}</h1>${html}<div class="srl-actions"><button class="srl-btn" id="go">${btnLabel || 'Continue'}</button></div>`);
    auto(S, () => pg.querySelector('#go').click(), 200);
    await UI.onClick(pg.querySelector('#go'));
    return {};
  }

  const famInstructions = (el, S) => message(el, S, 'Watching scenes',
    `<p class="srl-lead">Next you'll watch short moments from <b>${nm(S)}</b>'s and <b>${esc(S.unfamiliarName)}</b>'s days, as they run into people they know. Imagine you're really watching ${nm(S)} and ${esc(S.unfamiliarName)}.</p>
     ${S.design && S.design.design_version === 'repeat6' ? '<p>Scenes may be shown more than once.</p>' : ''}
     ${S.steps && S.steps.checkins ? `<p>Every few scenes, we'll ask a quick question about ${nm(S)} and about ${esc(S.unfamiliarName)}. There are no right answers.</p>` : ''}
     <p>Please watch each scene carefully. When a scene is finished, press <b>SPACE</b> when you're ready to continue.</p>
     ${C().SURPRISE_TEST ? '' : '<p><b>Afterwards, we will test your memory for what you saw.</b></p>'}
     <p class="srl-note">Make sure your sound is on.</p>`, 'Start the scenes');

  return { intro, nameEntry, relationship, ios, duration, audioCheck, message, famInstructions, isTitle };
})();
