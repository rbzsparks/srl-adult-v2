/* designer.js: "Make an avatar that looks like [name]" (known) or "Copy [name]'s avatar" (control, v3.1: one of 6 fixed
 * targets shown beside the preview, as in pilot 1), then the likeness rating. Both start from the same neutral face.
 * Six tabs in a fixed order (Skin → Face → Eyes → Nose & mouth → Hair → Extras), 16 sliders (0–1) plus categorical
 * options. Each tab has "Reset this section"; no randomize. The notes (memory only) are shown beside the preview.
 * Records: total and per-tab time, edits (a released slider or a clicked option) and resets, tabs visited. */
SRL.designer = (function () {
  const U = SRL.util, P = SRL.people;
  const esc = U.escapeHtml;

  const TABS = [
    { id: 'skin', label: 'Skin', keys: ['skinL', 'skinU'] },
    { id: 'face', label: 'Face', keys: ['faceW', 'jaw', 'age'] },
    { id: 'eyes', label: 'Eyes', keys: ['lid', 'eyeSize', 'eyeTilt', 'eyeSpacing', 'iris', 'browThick', 'browArch'] },
    { id: 'nosemouth', label: 'Nose & mouth', keys: ['noseW', 'noseL', 'lipFull', 'mouthW'] },
    { id: 'hair', label: 'Hair', keys: ['texture', 'length', 'hairStyle', 'hairColor', 'hairGray'] },
    { id: 'extras', label: 'Extras', keys: ['covering', 'coverColor', 'facial', 'glasses', 'freckles', 'shirt'] }
  ];
  const SLIDERS = {
    faceW: ['Face width', 'Narrower', 'Wider'], jaw: ['Jaw and chin', 'Narrow, pointed', 'Broad, square'],
    eyeSize: ['Eye size', 'Smaller', 'Larger'], eyeTilt: ['Eye tilt', 'Outer corners lower', 'Outer corners higher'], eyeSpacing: ['Eye spacing', 'Closer', 'Wider apart'],
    browThick: ['Eyebrow thickness', 'Thinner', 'Thicker'], browArch: ['Eyebrow shape', 'Straighter', 'More arched'],
    noseW: ['Nose width', 'Narrower', 'Wider'], noseL: ['Nose length', 'Shorter', 'Longer'], lipFull: ['Lips', 'Thinner', 'Fuller'], mouthW: ['Mouth width', 'Narrower', 'Wider'],
    hairColor: ['Hair colour', 'Black', 'Blonde'], hairGray: ['Grey hair', 'None', 'More grey'], freckles: ['Freckles', 'None', 'Many']
  };
  const LABELS = {
    age: { young: 'Young adult', middle: 'Middle-aged', older: 'Older adult' },
    lid: { double: 'Visible crease', hooded: 'Hooded', mono: 'No crease (monolid)' },
    texture: { straight: 'Straight', wavy: 'Wavy', curly: 'Curly', coily: 'Coily' },
    length: { short: 'Short', medium: 'Medium', long: 'Long' },
    facial: { none: 'None', stubble: 'Stubble', mustache: 'Mustache', beard: 'Short beard', fullbeard: 'Full beard' },
    glasses: { none: 'None', round: 'Round', rect: 'Rectangular' },
    covering: { none: 'None', hijab: 'Hijab', turban: 'Turban' }
  };
  const PREFERRED_STYLE = ['crop', 'shoulder', 'long', 'curly_short', 'coils_short', 'curly_mid', 'curly_long', 'braids'];

  /* opts.start: spec to start from (the revision visit starts from the current avatar; default the neutral face).
   * opts.revision: true on the one-time revision visit. The recall notes (S.notes, memory only) are shown in a side
   * panel under the preview when there are any. */
  async function run(el, S, opts) {
    opts = opts || {};
    const spec = Object.assign({}, opts.start || P.NEUTRAL);
    const stats = { edits: 0, resets: 0, tabMs: {}, tabEdits: {}, visited: new Set() };
    TABS.forEach((t) => { stats.tabMs[t.id] = 0; stats.tabEdits[t.id] = 0; });
    let tab = 0, tabT0 = U.now();
    const t0 = U.now();
    const notes = SRL.binding ? SRL.binding.notesPanel(S) : '';
    // Control: the avatar to copy stays beside the preview, at the same size, with the notes underneath.
    const tgt = S.control && S.targetSpec;
    const pw = tgt ? 196 : notes ? 230 : 290, ph = Math.round(pw * 1.2);
    const who = esc(S.knownName);
    const title = tgt ? (opts.revision ? 'Adjust your avatar' : `Copy ${who}'s avatar`) : (opts.revision ? 'Adjust the avatar of ' : 'Make an avatar that looks like ') + who;
    const goal = tgt ? `looks as much like ${who}'s avatar (on the left) as you can make it` : `looks as much like ${who} as you can make it`;
    const side = tgt
      ? `<div class="dz-copy"><div><div class="dz-cap">${who}'s avatar</div><div class="dz-preview dz-target" style="width:${pw}px;height:${ph}px">${P.svg(tgt, { attrs: `width="${pw}" height="${ph}"`, label: 'avatar to copy' })}</div></div>` +
        `<div><div class="dz-cap">Your avatar</div><div class="dz-preview" style="width:${pw}px;height:${ph}px"></div></div></div>${notes}`
      : `<div class="dz-preview" style="width:${pw}px;height:${ph}px"></div>${notes}`;
    el.innerHTML = `<div class="srl-page srl-designer">
      <h1>${title}</h1>
      <p class="dz-intro">${opts.revision
        ? `Change anything you like, in any section, then click <b>Done</b> in the last section.`
        : `Go through the six sections and adjust each one until the avatar ${goal}. You can go back to any section.`}</p>
      <div class="dz-wrap">
        <div class="dz-side">${side}</div>
        <div class="dz-main">
          <div class="dz-tabs" role="tablist">${TABS.map((t, i) => `<button type="button" class="dz-tab" data-t="${i}" role="tab">${i + 1}. ${t.label}</button>`).join('')}</div>
          <div class="dz-panel"></div>
        </div>
      </div>
      <div class="srl-actions dz-actions">
        <button type="button" class="srl-btn srl-btn-secondary" id="dz-reset">Reset this section</button>
        <span class="srl-note" id="dz-step"></span>
        <button type="button" class="srl-btn srl-btn-secondary" id="dz-back">Back</button>
        <button type="button" class="srl-btn" id="dz-next">Next</button>
      </div></div>`;
    const preview = el.querySelector('.dz-preview:not(.dz-target)'), panel = el.querySelector('.dz-panel');
    const btnNext = el.querySelector('#dz-next'), btnBack = el.querySelector('#dz-back');

    const drawPreview = () => { preview.innerHTML = P.svg(spec, { attrs: `width="${pw}" height="${ph}"`, label: 'avatar preview' }); };
    const edited = () => { stats.edits++; stats.tabEdits[TABS[tab].id]++; };
    const stylesNow = () => P.stylesFor(spec.texture, spec.length);
    function fixStyle() {
      const opts = stylesNow();
      if (!opts.includes(spec.hairStyle)) spec.hairStyle = PREFERRED_STYLE.find((s) => opts.includes(s)) || opts.find((s) => s !== 'bald') || opts[0];
    }
    const fixGray = () => { spec.hairGray = Math.min(spec.hairGray, P.GRAY_MAX[spec.age]); };

    // ---------- controls ----------
    const slider = (k, max) => {
      const [lab, lo, hi] = SLIDERS[k], m = max === undefined ? 1 : max;
      return `<div class="dz-row"><span class="dz-lab">${lab}</span><span class="dz-end">${lo}</span>
        <input type="range" class="dz-range${k === 'hairColor' ? ' dz-haircol' : ''}" data-k="${k}" min="0" max="${m}" step="0.01" value="${Math.min(spec[k], m)}" aria-label="${lab}">
        <span class="dz-end">${hi}</span></div>`;
    };
    const options = (k, list, labels) => `<div class="dz-row"><span class="dz-lab">${{ age: 'Age', texture: 'Hair texture', length: 'Hair length', facial: 'Facial hair', glasses: 'Glasses', covering: 'Head covering' }[k]}</span>
      <div class="dz-opts">${list.map((v) => `<button type="button" class="dz-tb${spec[k] === v ? ' sel' : ''}" data-k="${k}" data-v="${v}">${labels[v]}</button>`).join('')}</div></div>`;
    const swatches = (k, pal, lab) => `<div class="dz-row"><span class="dz-lab">${lab}</span><div class="dz-opts">${Object.keys(pal).map((v) =>
      `<button type="button" class="dz-sw${spec[k] === v ? ' sel' : ''}" style="background:${pal[v]}" data-k="${k}" data-v="${v}" aria-label="${v}"></button>`).join('')}</div></div>`;
    const thumbs = (k, list, render, lab, cls) => `<div class="dz-row dz-row-tall"><span class="dz-lab">${lab}</span><div class="dz-opts">${list.map((v) =>
      `<button type="button" class="dz-th ${cls || ''}${spec[k] === v ? ' sel' : ''}" data-k="${k}" data-v="${v}" aria-label="${v}">${render(v)}</button>`).join('')}</div></div>`;

    function panelHtml() {
      const id = TABS[tab].id;
      if (id === 'skin') return `<div class="dz-row dz-row-skin"><span class="dz-lab">Skin tone</span>
          <div class="dz-skinwrap"><div class="dz-skin-top">Lighter</div><div class="dz-skinbox"><canvas width="300" height="170" class="dz-skin"></canvas><div class="dz-skin-dot"></div></div>
          <div class="dz-skin-x"><span>Cooler (pinker)</span><span>Warmer (golden)</span><span>Olive</span></div><div class="dz-skin-top">Deeper</div></div></div>
          <p class="srl-note">Click or drag in the box. Up and down changes how light or deep the skin is; left and right changes its undertone.</p>`;
      if (id === 'face') return slider('faceW') + slider('jaw') + options('age', P.AGES, LABELS.age);
      if (id === 'eyes') return thumbs('lid', ['double', 'hooded', 'mono'], (v) => P.svg(Object.assign({}, spec, { lid: v, glasses: 'none' }), { viewBox: '56 84 88 38', attrs: 'width="92" height="40"' }) + `<span>${LABELS.lid[v]}</span>`, 'Eyelids', 'dz-th-eye') +
        slider('eyeSize') + slider('eyeTilt') + slider('eyeSpacing') + swatches('iris', P.IRIS, 'Eye colour') + slider('browThick') + slider('browArch');
      if (id === 'nosemouth') return slider('noseW') + slider('noseL') + slider('lipFull') + slider('mouthW');
      if (id === 'hair') {
        if (spec.covering !== 'none') return `<p class="srl-note dz-msg">Hair is hidden by the head covering (Extras section). Remove the covering there to choose a hair style.</p>` + slider('hairColor') + slider('hairGray', P.GRAY_MAX[spec.age]);
        return options('texture', P.TEXTURES, LABELS.texture) + options('length', P.LENGTHS, LABELS.length) +
          thumbs('hairStyle', stylesNow(), (v) => P.svg(Object.assign({}, spec, { hairStyle: v }), { viewBox: '10 0 180 190', attrs: 'width="58" height="61"' }) + `<span>${P.STYLES[v].label}</span>`, 'Style') +
          slider('hairColor') + slider('hairGray', P.GRAY_MAX[spec.age]);
      }
      return options('covering', P.COVERINGS, LABELS.covering) + (spec.covering !== 'none' ? swatches('coverColor', P.COVER, 'Covering colour') : '') +
        options('facial', P.FACIAL, LABELS.facial) + options('glasses', P.GLASSES, LABELS.glasses) + slider('freckles') + swatches('shirt', P.DESIGNER_SHIRTS, 'Shirt colour');
    }

    function drawSkin() {
      const cv = panel.querySelector('.dz-skin'); if (!cv) return;
      const ctx = cv.getContext('2d'), W = cv.width, H = cv.height, cell = 5;
      for (let x = 0; x < W; x += cell) for (let y = 0; y < H; y += cell) { ctx.fillStyle = P.skinHex(y / (H - cell), x / (W - cell)); ctx.fillRect(x, y, cell, cell); }
      const dot = panel.querySelector('.dz-skin-dot');
      const place = () => { dot.style.left = (spec.skinU * 100) + '%'; dot.style.top = (spec.skinL * 100) + '%'; dot.style.background = P.skinHex(spec.skinL, spec.skinU); };
      place();
      let dragging = false;
      const at = (e) => { const r = cv.getBoundingClientRect(); spec.skinU = U.clamp((e.clientX - r.left) / r.width, 0, 1); spec.skinL = U.clamp((e.clientY - r.top) / r.height, 0, 1); place(); drawPreview(); };
      cv.addEventListener('pointerdown', (e) => { dragging = true; cv.setPointerCapture(e.pointerId); at(e); });
      cv.addEventListener('pointermove', (e) => { if (dragging) at(e); });
      cv.addEventListener('pointerup', () => { if (dragging) { dragging = false; edited(); } });
    }

    function drawPanel() {
      panel.innerHTML = panelHtml();
      el.querySelectorAll('.dz-tab').forEach((b, i) => { b.classList.toggle('sel', i === tab); b.classList.toggle('seen', stats.visited.has(TABS[i].id)); });
      el.querySelector('#dz-step').textContent = `Section ${tab + 1} of ${TABS.length}`;
      btnBack.disabled = tab === 0;
      btnNext.textContent = tab === TABS.length - 1 ? 'Done' : 'Next';
      panel.querySelectorAll('.dz-range').forEach((r) => {
        if (r.dataset.k === 'hairColor') r.style.background = `linear-gradient(90deg, ${P.HAIR_STOPS.map(([v, c]) => `${c} ${v * 100}%`).join(', ')})`;
        r.addEventListener('input', () => { spec[r.dataset.k] = +r.value; drawPreview(); });
        r.addEventListener('change', edited);
      });
      panel.querySelectorAll('button[data-k]').forEach((b) => b.addEventListener('click', () => {
        const k = b.dataset.k;
        spec[k] = b.dataset.v;
        if (k === 'texture' || k === 'length') fixStyle();
        if (k === 'age') fixGray();
        edited(); drawPreview(); drawPanel();
      }));
      drawSkin();
    }

    function switchTab(i) {
      stats.tabMs[TABS[tab].id] += U.now() - tabT0; tabT0 = U.now();
      tab = i; stats.visited.add(TABS[tab].id); drawPanel();
    }
    el.querySelectorAll('.dz-tab').forEach((b) => (b.onclick = () => switchTab(+b.dataset.t)));
    btnBack.onclick = () => { if (tab > 0) switchTab(tab - 1); };
    el.querySelector('#dz-reset').onclick = () => {
      TABS[tab].keys.forEach((k) => (spec[k] = P.NEUTRAL[k]));
      if (TABS[tab].id === 'hair') fixStyle();
      fixGray(); stats.resets++; drawPreview(); drawPanel();
    };
    stats.visited.add(TABS[0].id);
    drawPreview(); drawPanel();

    await new Promise((resolve) => {
      btnNext.onclick = () => { if (tab < TABS.length - 1) switchTab(tab + 1); else resolve(); };
      if (S.auto && opts.revision) {
        // Autopilot (revision visit): one change, then through to Done.
        const tick = () => {
          if (tab === 4) { spec.hairColor = 0.15; edited(); drawPreview(); }
          const last = tab === TABS.length - 1;
          btnNext.click();
          if (!last) setTimeout(tick, 60);
        };
        setTimeout(tick, 150);
      } else if (S.auto) {
        // Autopilot: one change in each section, then Done.
        const steps = [() => { spec.skinL = 0.3; spec.skinU = 0.6; }, () => { spec.faceW = 0.6; spec.age = 'young'; }, () => { spec.lid = 'mono'; spec.eyeSize = 0.4; },
          () => { spec.lipFull = 0.6; }, () => { spec.texture = 'straight'; spec.length = 'medium'; spec.hairStyle = 'bangs'; spec.hairColor = 0; }, () => { spec.glasses = 'round'; }];
        let i = 0;
        const tick = () => { steps[i](); edited(); drawPreview(); i++; btnNext.click(); if (i < steps.length) setTimeout(tick, 60); };
        setTimeout(tick, 150);
      }
    });
    stats.tabMs[TABS[tab].id] += U.now() - tabT0;
    const out = { spec: Object.assign({}, spec), designer_ms: Math.round(U.now() - t0), designer_edits: stats.edits, designer_resets: stats.resets,
      designer_tabs_visited: stats.visited.size };
    TABS.forEach((t) => { out['t_designer_' + t.id + '_ms'] = Math.round(stats.tabMs[t.id]); out['designer_edits_' + t.id] = stats.tabEdits[t.id]; });
    return out;
  }

  /* Known: "How much does this avatar look like [name]?" Control: "How much does your avatar look like the one you
   * copied?", with both avatars shown above the scale (pilot 1). 1–7. */
  async function likeness(el, S, spec) {
    const anchors = { 1: 'Not at all', 4: 'Somewhat', 7: 'Very much' }, who = esc(S.knownName), tgt = S.control && S.targetSpec;
    const q = tgt ? 'How much does your avatar look like the one you copied?' : `How much does this avatar look like ${who}?`;
    const pics = tgt
      ? `<div class="dz-copy dz-copy-like"><div><div class="dz-cap">${who}'s avatar</div><div class="dz-preview dz-preview-xs">${P.svg(tgt, { attrs: 'width="180" height="216"' })}</div></div>` +
        `<div><div class="dz-cap">Your avatar</div><div class="dz-preview dz-preview-xs">${P.svg(spec, { attrs: 'width="180" height="216"' })}</div></div></div>`
      : `<div class="dz-preview dz-preview-sm">${P.svg(spec, { attrs: 'width="240" height="288"' })}</div>`;
    el.innerHTML = `<div class="srl-page dz-like">
      <h1>${q}</h1>
      <div class="dz-like-wrap${tgt ? ' dz-like-col' : ''}">${pics}
        <div class="dz-like-scale"><div class="dz-like-row">${[1, 2, 3, 4, 5, 6, 7].map((k) => `<button type="button" class="dz-like-btn" data-k="${k}"><b>${k}</b><span>${anchors[k] || ''}</span></button>`).join('')}</div>
        <p class="srl-note">Choose a number from 1 (not at all) to 7 (very much).</p></div></div>
      <div class="srl-actions"><button class="srl-btn" id="go" disabled>Continue</button></div></div>`;
    const t0 = U.now();
    let val = null;
    el.querySelectorAll('.dz-like-btn').forEach((b) => (b.onclick = () => {
      val = +b.dataset.k; el.querySelectorAll('.dz-like-btn').forEach((x) => x.classList.toggle('sel', x === b)); el.querySelector('#go').disabled = false;
    }));
    // Autopilot: 4 the first time (so the revision offer is exercised), 6 after a revision.
    if (S.auto) setTimeout(() => { el.querySelector(`[data-k="${S.p.revised ? 6 : 4}"]`).click(); el.querySelector('#go').click(); }, 150);
    await SRL.ui.onClick(el.querySelector('#go'));
    return { likeness_rating: val, likeness_rt_ms: Math.round(U.now() - t0) };
  }

  return { run, likeness, TABS };
})();
