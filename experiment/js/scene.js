/* scene.js: one familiarization scene.
 * Layout (stage px, 1000×625): stranger left, turned three-quarters toward the person on the right; known/unfamiliar
 * person right, turned toward her, with their name beneath (SHOW_NAME_LABEL); novel object on a low table between
 * them, clearly below eye level, so a look at the object reads differently from a look at the partner; incidental
 * object on a wall shelf (top right). Gaze is aimed at the actual position of its target (look()).
 * Timeline: stranger slides in → greeting audio → nonverbal response → label audio with gaze sequence →
 * nods → SPACE enabled 1 s after label audio ends → auto-advance 15 s after label audio ends.
 * Motion and timing are identical in both conditions; only the right-hand avatar and its name differ. */
SRL.scene = (function () {
  const U = SRL.util;
  const W = 1000, H = 625;
  const POS = {
    stranger: { x: 60, y: 224, w: 280, h: 336, startX: -330 },
    other: { x: 660, y: 224, w: 280, h: 336 },
    object: { x: 440, y: 392, w: 120, h: 120 },
    incidental: { x: 794, y: 88, w: 72, h: 72 },
    name: { x: 800, y: 603 }
  };
  // Areas of interest on the final frame, normalized to the stage (0-1).
  const AOI = {
    stranger_face: [120, 270, 290, 466],
    object: [435, 387, 565, 517],
    other_face: [710, 270, 880, 466],
    incidental: [788, 84, 872, 166]
  };
  const AOI_NORM = {};
  Object.keys(AOI).forEach((k) => { const a = AOI[k]; AOI_NORM[k] = [a[0] / W, a[1] / H, a[2] / W, a[3] / H].map((v) => +v.toFixed(4)); });

  /* Gaze aimed at the real target: from the person's eye position (stage px) to the target, the eyes turn fully toward
   * it horizontally and move down in proportion to the angle (upper lids drop), and the head pitches toward it by about
   * 0.55 of the angle (rot, degrees) with a small drop (nod). A look at the partner is level. */
  const EYE = (pos, facing) => [pos.x + (100 + facing * 10) * pos.w / 200, pos.y + 104 * pos.h / 240];
  function look(from, facing, tx, ty) {
    const vx = tx - from[0], vy = ty - from[1], deg = Math.atan2(vy, Math.abs(vx)) * 180 / Math.PI;
    return { gaze: [Math.sign(vx), U.clamp(Math.sin(deg * Math.PI / 180) * 3.2, -1, 1)], rot: facing * U.clamp(deg * 0.55, -8, 12), nod: U.clamp(deg * 0.18, -1.5, 4) };
  }
  const OBJ_C = [POS.object.x + POS.object.w / 2, POS.object.y + POS.object.h / 2];
  const S_EYE = EYE(POS.stranger, 1), O_EYE = EYE(POS.other, -1);
  const GAZE = {
    stranger: { other: look(S_EYE, 1, O_EYE[0], O_EYE[1]), object: look(S_EYE, 1, OBJ_C[0], OBJ_C[1]) },
    other: { ahead: { gaze: [-0.3, 0], rot: 0, nod: 0 }, stranger: look(O_EYE, -1, S_EYE[0], S_EYE[1]), object: look(O_EYE, -1, OBJ_C[0], OBJ_C[1]) }
  };

  function build(el, sc, ctx) {
    const P = SRL.people, O = SRL.objects;
    const otherSpec = sc.condition === 'known' ? ctx.knownSpec : ctx.unfamiliarSpec;
    const otherName = sc.condition === 'known' ? ctx.knownName : ctx.unfamiliarName;
    const colorHex = SRL.stimuli.data().incidental_colors[sc.incidental_color];
    const pAttr = (p, x) => `x="${x}" y="${p.y}" width="${p.w}" height="${p.h}"`;
    el.innerHTML = `<div class="srl-scene">
      <svg class="srl-stage" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="${W}" height="470" fill="#F1EBE1"/>
        <rect x="0" y="466" width="${W}" height="6" fill="#D6C7B0"/>
        <rect x="0" y="472" width="${W}" height="88" fill="#E2D5C1"/>
        <path d="M792 169 L792 186 L808 169 Z M868 169 L868 186 L852 169 Z" fill="#9A7752"/>
        <rect x="760" y="160" width="140" height="9" rx="2" fill="#B08A64"/>
        <g class="sc-incidental">${O.incidentalSvg(sc.incidental, colorHex, `x="${POS.incidental.x}" y="${POS.incidental.y}" width="${POS.incidental.w}" height="${POS.incidental.h}"`)}</g>
        <g class="sc-other">${P.svg(otherSpec, { facing: -1, cacheHair: true, attrs: pAttr(POS.other, POS.other.x) })}</g>
        <g class="sc-stranger">${P.svg(sc.stranger, { facing: 1, cacheHair: true, attrs: pAttr(POS.stranger, POS.stranger.startX) })}</g>
        <rect x="452" y="548" width="96" height="12" rx="4" fill="#8A6644"/>
        <rect x="489" y="524" width="22" height="28" fill="#8A6644"/>
        <rect x="410" y="510" width="180" height="15" rx="6" fill="#A07A55"/>
        <g class="sc-object">${O.novelSvg(sc.object_id, `x="${POS.object.x}" y="${POS.object.y}" width="${POS.object.w}" height="${POS.object.h}"`)}</g>
        <rect x="0" y="560" width="${W}" height="65" fill="#FBF8F3"/>
        <rect x="0" y="560" width="${W}" height="1.5" fill="#E3DACB"/>
        ${ctx.showName === false ? '' : `<text x="${POS.name.x}" y="${POS.name.y}" text-anchor="middle" class="sc-name">${U.escapeHtml(otherName)}</text>`}
        <text x="330" y="600" text-anchor="middle" class="sc-prompt" visibility="hidden">Press SPACE to continue</text>
      </svg>
      <div class="srl-mouseview" hidden></div>
    </div>`;
    const svg = el.querySelector('svg.srl-stage');
    const strangerSvg = el.querySelector('.sc-stranger svg');
    const otherSvg = el.querySelector('.sc-other svg');
    return {
      svg, strangerSvg,
      stranger: new P.PersonRig(strangerSvg, sc.stranger, 1),
      other: new P.PersonRig(otherSvg, otherSpec, -1),
      objectG: el.querySelector('.sc-object'),
      prompt: el.querySelector('.sc-prompt'),
      mv: el.querySelector('.srl-mouseview'),
      otherName
    };
  }

  function setObject(g, dy, s) {
    const cx = POS.object.x + POS.object.w / 2, cy = POS.object.y + POS.object.h;
    g.setAttribute('transform', `translate(0 ${dy}) translate(${cx} ${cy}) scale(${s}) translate(${-cx} ${-cy})`);
  }

  /* MouseView spotlight + AOI dwell (only when SRL_CONFIG.MOUSEVIEW). */
  function startMouseView(st, el) {
    const dwell = { stranger_face: 0, object: 0, other_face: 0, incidental: 0, none: 0 };
    let pos = null, last = U.now(), running = true;
    const mv = st.mv; mv.hidden = false;
    const r = SRL_CONFIG.MOUSEVIEW_RADIUS * W;
    mv.style.backdropFilter = mv.style.webkitBackdropFilter = `blur(${SRL_CONFIG.MOUSEVIEW_BLUR_PX}px)`;
    const move = (e) => {
      const rect = st.svg.getBoundingClientRect();
      pos = { x: ((e.clientX - rect.left) / rect.width) * W, y: ((e.clientY - rect.top) / rect.height) * H };
      const m = `radial-gradient(circle ${r}px at ${pos.x}px ${pos.y}px, transparent 0, transparent ${r * 0.85}px, black ${r}px)`;
      mv.style.maskImage = mv.style.webkitMaskImage = m;
    };
    window.addEventListener('mousemove', move);
    const loop = () => {
      if (!running) return;
      const t = U.now(), dt = t - last; last = t;
      if (pos) {
        const hit = Object.keys(AOI).find((k) => pos.x >= AOI[k][0] && pos.x <= AOI[k][2] && pos.y >= AOI[k][1] && pos.y <= AOI[k][3]);
        dwell[hit || 'none'] += dt;
      }
      U.frame(loop);
    };
    U.frame(loop);
    return () => { running = false; window.removeEventListener('mousemove', move); const out = {}; Object.keys(dwell).forEach((k) => (out['dwell_' + k + '_ms'] = Math.round(dwell[k]))); return out; };
  }

  async function run(el, sc, ctx) {
    const T = ctx.timing;
    const st = build(el, sc, ctx);
    const t0 = U.now();
    const stopMV = SRL_CONFIG.MOUSEVIEW ? startMouseView(st, el) : null;
    if (ctx.debug) SRL.ui.debug(`${sc.id}${sc.presentation ? ' (' + sc.presentation + ')' : ''} | ${sc.condition} | name ${ctx.showName === false ? 'hidden' : 'shown'} | ${sc.stranger.id} | ${sc.word} | ${sc.incidental}/${sc.incidental_color} | list ${ctx.list}`);
    const S = st.stranger, Ot = st.other;
    S.set(Object.assign({ smile: 0.3 }, GAZE.stranger.other));
    Ot.set(Object.assign({ smile: 0.2 }, GAZE.other.ahead));
    setObject(st.objectG, -8, 1);

    // 1. Stranger enters (slide + small walking bob); other person turns to look at them.
    await U.tween(T.STRANGER_ENTER, (t) => {
      st.strangerSvg.setAttribute('x', U.lerp(POS.stranger.startX, POS.stranger.x, t));
      S.set({ bounce: Math.abs(Math.sin(t * Math.PI * 3)) * 4 });
      if (t > 0.5) Ot.set(GAZE.other.stranger);
    }, U.easeOut);
    S.set({ bounce: 0 });
    await U.sleep(T.AFTER_ENTER_PAUSE);

    // 2. Greeting: "Hi! Good to see you!" with lip-sync and a slight head bob.
    const tg = U.now();
    const greet = await SRL.audio.play(sc.greet_clip || 'greet_' + sc.id, {
      onAmp: (a) => { const e = (U.now() - tg) / 1000; S.set({ mouth: a, nod: GAZE.stranger.other.nod + Math.sin(e * 7) * 0.7 }); }
    });
    S.set({ mouth: 0, nod: GAZE.stranger.other.nod });

    // 3. Nonverbal response: smile, eyebrow raise, head tilt, small happy bounce.
    const resp = U.tween(T.RESPONSE, (t) => {
      const up = Math.min(1, t * 4), down = t > 0.75 ? (t - 0.75) * 4 : 0;
      Ot.set({ smile: U.lerp(0.2, 1, up), brow: up - down, rot: GAZE.other.stranger.rot - 4 * (up - down), bounce: Math.sin(Math.min(1, t * 2) * Math.PI) * 6 });
    }, (x) => x);
    await resp;
    Ot.set({ brow: 0, rot: GAZE.other.stranger.rot, bounce: 0, smile: 0.8 });
    await U.sleep(T.BEFORE_LABEL_PAUSE);

    // 4. Label: "Look! It's a X! A X!" with the gaze sequence driven by the clip's pause structure.
    const tl = U.now();
    let labelOnset = null;
    const label = await SRL.audio.play(sc.label_clip || 'label_' + sc.id, {
      onAmp: (a) => S.set({ mouth: a }),
      onSegment: (i) => {
        if (i === 0) {
          labelOnset = U.now();
          S.to(GAZE.stranger.object, 160);
          U.tween(T.OBJECT_PULSE, (t) => setObject(st.objectG, U.lerp(-8, 0, t), 1 + 0.05 * Math.sin(t * Math.PI)));
          setTimeout(() => Ot.to(GAZE.other.object, 160), T.JOINT_ATTENTION_LAG);
        } else if (i === 1) S.to(GAZE.stranger.other, 160);
        else if (i === 2) S.to(GAZE.stranger.object, 160);
      }
    });
    const tLabelEnd = U.now();
    S.set(Object.assign({ mouth: 0 }, GAZE.stranger.object));

    // 5. Other person nods twice while looking at the object and smiling.
    const base = GAZE.other.object.nod;
    U.tween(560, (t) => Ot.set({ nod: base + Math.abs(Math.sin(t * Math.PI * 2)) * 2.6, smile: 1 }), (x) => x).then(() => Ot.set({ nod: base }));

    // 6. SPACE enabled 1 s after label audio ends; auto-advance 15 s after.
    await U.sleep(T.SPACE_ENABLE_AFTER_LABEL);
    st.prompt.setAttribute('visibility', 'visible');
    const cancelRef = {};
    if (ctx.auto) setTimeout(() => cancelRef.cancel && cancelRef.cancel(), 150);
    const remaining = Math.max(0, T.AUTO_ADVANCE_AFTER_LABEL - (U.now() - tLabelEnd));
    const key = await SRL.ui.waitKey(['Space', ' '], { timeout: remaining, cancelRef });
    const viewMs = Math.round(key.time - tLabelEnd);
    const mv = stopMV ? stopMV() : {};
    const totalMs = Math.round(U.now() - t0);

    el.innerHTML = '';
    SRL.ui.debug('');
    await U.sleep(T.ISI);
    const info = SRL.audio.info(sc.label_clip || 'label_' + sc.id) || {};
    return Object.assign({
      scene_set_id: sc.id, condition: sc.condition, stranger_id: sc.stranger.id, word: sc.word, object_id: sc.object_id,
      incidental_type: sc.incidental, incidental_color: sc.incidental_color,
      view_ms: viewMs, timed_out: key.timedOut ? 1 : 0,
      label_audio_ms: label.duration_ms, greet_audio_ms: greet.duration_ms,
      label_onset_to_end_ms: labelOnset ? Math.round(tLabelEnd - labelOnset) : null,
      label_segments_s: (info.segments || []).map((x) => +x.toFixed(3)).join('|'),
      label_segment_source: info.segSource || '',
      audio_simulated: (label.simulated || greet.simulated) ? 1 : 0,
      scene_total_ms: totalMs,
      other_name_shown: sc.condition === 'unfamiliar' ? ctx.unfamiliarName : '[known name, not stored]'
    }, mv);
  }

  return { run, AOI_NORM, POS, GAZE };
})();
