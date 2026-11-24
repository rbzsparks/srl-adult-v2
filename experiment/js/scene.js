/* scene.js: one familiarization scene (v3.0: the designed avatar is the talker in every scene).
 * Layout (stage px, 1000×625): the avatar enters on the left, turned three-quarters toward the stranger, with its name
 * beneath (SHOW_NAME_LABEL); the stranger stands on the right, turned toward the avatar (the stranger's name is never
 * shown); novel object on a low table between them, below eye level, so a look at the object reads differently from a
 * look at the partner; the background (colour-test) object on a wall shelf, top right, above the stranger's head and
 * never covered. Gaze is aimed at the actual position of its target (look()).
 * Timeline: avatar slides in → "Hi, [stranger]!" → stranger smiles, raises eyebrows and waves → "Look! It's a X! A X!"
 * with the avatar's gaze sequence; the stranger's eyes follow to the object → stranger nods → SPACE enabled 1 s after
 * the label ends → auto-advance 15 s after. Identical in both conditions; only the avatar, its name and voice differ. */
SRL.scene = (function () {
  const U = SRL.util;
  const W = 1000, H = 625;
  const POS = {
    talker: { x: 60, y: 224, w: 280, h: 336, startX: -330 },
    listener: { x: 660, y: 224, w: 280, h: 336 },
    object: { x: 440, y: 392, w: 120, h: 120 },
    incidental: { x: 776, y: 52, w: 108, h: 108 },   // 1.5x pilot 1, resting on the shelf (top at y 160)
    name: { x: 200, y: 603 }
  };
  // Areas of interest on the final frame, normalized to the stage (0-1).
  const AOI = {
    avatar_face: [120, 270, 290, 466],
    object: [435, 387, 565, 517],
    stranger_face: [710, 270, 880, 466],
    incidental: [770, 46, 890, 166]
  };
  const AOI_NORM = {};
  Object.keys(AOI).forEach((k) => { const a = AOI[k]; AOI_NORM[k] = [a[0] / W, a[1] / H, a[2] / W, a[3] / H].map((v) => +v.toFixed(4)); });

  /* Gaze aimed at the real target: the eyes turn fully toward it horizontally and move down in proportion to the angle,
   * and the head pitches toward it by about 0.55 of the angle (rot, degrees) with a small drop (nod). */
  const EYE = (pos, facing) => [pos.x + (100 + facing * 10) * pos.w / 200, pos.y + 104 * pos.h / 240];
  function look(from, facing, tx, ty) {
    const vx = tx - from[0], vy = ty - from[1], deg = Math.atan2(vy, Math.abs(vx)) * 180 / Math.PI;
    return { gaze: [Math.sign(vx), U.clamp(Math.sin(deg * Math.PI / 180) * 3.2, -1, 1)], rot: facing * U.clamp(deg * 0.55, -8, 12), nod: U.clamp(deg * 0.18, -1.5, 4) };
  }
  const OBJ_C = [POS.object.x + POS.object.w / 2, POS.object.y + POS.object.h / 2];
  const T_EYE = EYE(POS.talker, 1), L_EYE = EYE(POS.listener, -1);
  const GAZE = {
    talker: { listener: look(T_EYE, 1, L_EYE[0], L_EYE[1]), object: look(T_EYE, 1, OBJ_C[0], OBJ_C[1]) },
    listener: { ahead: { gaze: [-0.3, 0], rot: 0, nod: 0 }, talker: look(L_EYE, -1, T_EYE[0], T_EYE[1]), object: look(L_EYE, -1, OBJ_C[0], OBJ_C[1]) }
  };

  function build(el, sc, ctx) {
    const P = SRL.people, O = SRL.objects;
    const colorHex = SRL.stimuli.data().incidental_colors[sc.incidental_color];
    const pAttr = (p, x) => `x="${x}" y="${p.y}" width="${p.w}" height="${p.h}"`;
    el.innerHTML = `<div class="srl-scene">
      <svg class="srl-stage" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="${W}" height="470" fill="#F1EBE1"/>
        <rect x="0" y="466" width="${W}" height="6" fill="#D6C7B0"/>
        <rect x="0" y="472" width="${W}" height="88" fill="#E2D5C1"/>
        <path d="M778 169 L778 188 L796 169 Z M882 169 L882 188 L864 169 Z" fill="#9A7752"/>
        <rect x="750" y="160" width="160" height="9" rx="2" fill="#B08A64"/>
        <g class="sc-incidental">${O.incidentalSvg(sc.incidental, colorHex, `x="${POS.incidental.x}" y="${POS.incidental.y}" width="${POS.incidental.w}" height="${POS.incidental.h}"`)}</g>
        <g class="sc-listener">${P.svg(sc.stranger, { facing: -1, cacheHair: true, hands: true, attrs: pAttr(POS.listener, POS.listener.x) })}</g>
        <g class="sc-talker">${P.svg(ctx.avatarSpec, { facing: 1, cacheHair: true, attrs: pAttr(POS.talker, POS.talker.startX) })}</g>
        <rect x="452" y="548" width="96" height="12" rx="4" fill="#8A6644"/>
        <rect x="489" y="524" width="22" height="28" fill="#8A6644"/>
        <rect x="410" y="510" width="180" height="15" rx="6" fill="#A07A55"/>
        <g class="sc-object">${O.novelSvg(sc.object_id, `x="${POS.object.x}" y="${POS.object.y}" width="${POS.object.w}" height="${POS.object.h}"`)}</g>
        <rect x="0" y="560" width="${W}" height="65" fill="#FBF8F3"/>
        <rect x="0" y="560" width="${W}" height="1.5" fill="#E3DACB"/>
        ${ctx.showName === false ? '' : `<text x="${POS.name.x}" y="${POS.name.y}" text-anchor="middle" class="sc-name">${U.escapeHtml(ctx.avatarName)}</text>`}
        <text x="500" y="600" text-anchor="middle" class="sc-prompt" visibility="hidden">Press SPACE to continue</text>
      </svg>
      <div class="srl-mouseview" hidden></div>
    </div>`;
    const svg = el.querySelector('svg.srl-stage');
    const talkerSvg = el.querySelector('.sc-talker svg');
    return {
      svg, talkerSvg,
      talker: new P.PersonRig(talkerSvg, ctx.avatarSpec, 1),
      listener: new P.PersonRig(el.querySelector('.sc-listener svg'), sc.stranger, -1),
      objectG: el.querySelector('.sc-object'),
      prompt: el.querySelector('.sc-prompt'),
      mv: el.querySelector('.srl-mouseview')
    };
  }

  function setObject(g, dy, s) {
    const cx = POS.object.x + POS.object.w / 2, cy = POS.object.y + POS.object.h;
    g.setAttribute('transform', `translate(0 ${dy}) translate(${cx} ${cy}) scale(${s}) translate(${-cx} ${-cy})`);
  }

  /* MouseView spotlight + AOI dwell (only when SRL_CONFIG.MOUSEVIEW). */
  function startMouseView(st) {
    const dwell = { none: 0 };
    Object.keys(AOI).forEach((k) => (dwell[k] = 0));
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
        const hit = Object.keys(AOI).filter((k) => pos.x >= AOI[k][0] && pos.x <= AOI[k][2] && pos.y >= AOI[k][1] && pos.y <= AOI[k][3])[0];
        dwell[hit || 'none'] += dt;
      }
      U.frame(loop);
    };
    U.frame(loop);
    return () => { running = false; window.removeEventListener('mousemove', move); const out = {}; Object.keys(dwell).forEach((k) => (out['dwell_' + k + '_ms'] = Math.round(dwell[k]))); return out; };
  }

  /* ctx: { avatarSpec, avatarName, voice, timing, debug, auto, showName } */
  async function run(el, sc, ctx) {
    const T = ctx.timing;
    const st = build(el, sc, ctx);
    const t0 = U.now();
    const stopMV = SRL_CONFIG.MOUSEVIEW ? startMouseView(st) : null;
    const greetClip = 'greet_' + SRL.names.clipKey(sc.stranger_name) + '_' + ctx.voice, labelClip = 'label_' + sc.word + '_' + ctx.voice;
    if (ctx.debug) SRL.ui.debug(`${sc.id} (${sc.presentation}) | ${sc.stranger.id} = ${sc.stranger_name} | ${sc.word} | ${sc.incidental}/${sc.incidental_color} | voice ${ctx.voice}`);
    const A = st.talker, L = st.listener;
    A.set(Object.assign({ smile: 0.3 }, GAZE.talker.listener));
    L.set(Object.assign({ smile: 0.2 }, GAZE.listener.ahead));
    setObject(st.objectG, -8, 1);

    // 1. The avatar enters (slide + small walking bob); the stranger turns to look at them.
    await U.tween(T.AVATAR_ENTER, (t) => {
      st.talkerSvg.setAttribute('x', U.lerp(POS.talker.startX, POS.talker.x, t));
      A.set({ bounce: Math.abs(Math.sin(t * Math.PI * 3)) * 4 });
      if (t > 0.5) L.set(GAZE.listener.talker);
    }, U.easeOut);
    A.set({ bounce: 0 });
    await U.sleep(T.AFTER_ENTER_PAUSE);

    // 2. Greeting: "Hi, [stranger]!" with lip-sync and a slight head bob.
    const tg = U.now();
    const greet = await SRL.audio.play(greetClip, {
      onAmp: (a) => { const e = (U.now() - tg) / 1000; A.set({ mouth: a, nod: GAZE.talker.listener.nod + Math.sin(e * 7) * 0.7 }); }
    });
    A.set({ mouth: 0, nod: GAZE.talker.listener.nod });

    // 3. The stranger responds: smile, eyebrow raise, small head tilt and bounce, and a wave (hand up, two swings, down).
    const base = GAZE.listener.talker;
    await U.tween(T.RESPONSE, (t) => {
      const up = Math.min(1, t * 4), down = t > 0.8 ? (t - 0.8) * 5 : 0;
      const handUp = U.clamp(t / 0.18, 0, 1) * (1 - U.clamp((t - 0.82) / 0.18, 0, 1));
      const swing = t > 0.18 && t < 0.82 ? Math.sin((t - 0.18) / 0.64 * Math.PI * 4) * 14 : 0;
      L.set({ smile: U.lerp(0.2, 1, up), brow: up - down, rot: base.rot - 4 * (up - down), bounce: Math.sin(Math.min(1, t * 2) * Math.PI) * 5,
        hand: handUp, handRot: swing });
    }, (x) => x);
    L.set({ brow: 0, rot: base.rot, bounce: 0, smile: 0.8, hand: 0, handRot: 0 });
    await U.sleep(T.BEFORE_LABEL_PAUSE);

    // 4. Label: "Look! It's a X! A X!" with the gaze sequence driven by the clip's pause structure; the stranger's eyes
    //    follow the avatar's gaze to the object.
    let labelOnset = null;
    const label = await SRL.audio.play(labelClip, {
      onAmp: (a) => A.set({ mouth: a }),
      onSegment: (i) => {
        if (i === 0) {
          labelOnset = U.now();
          A.to(GAZE.talker.object, 160);
          U.tween(T.OBJECT_PULSE, (t) => setObject(st.objectG, U.lerp(-8, 0, t), 1 + 0.05 * Math.sin(t * Math.PI)));
          setTimeout(() => L.to(GAZE.listener.object, 160), T.JOINT_ATTENTION_LAG);
        } else if (i === 1) A.to(GAZE.talker.listener, 160);
        else if (i === 2) A.to(GAZE.talker.object, 160);
      }
    });
    const tLabelEnd = U.now();
    A.set(Object.assign({ mouth: 0 }, GAZE.talker.object));

    // 5. The stranger nods twice while looking at the object and smiling.
    const nb = GAZE.listener.object.nod;
    U.tween(560, (t) => L.set({ nod: nb + Math.abs(Math.sin(t * Math.PI * 2)) * 2.6, smile: 1 }), (x) => x).then(() => L.set({ nod: nb }));

    // 6. SPACE enabled 1 s after the label ends; auto-advance 15 s after.
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
    const info = SRL.audio.info(labelClip) || {};
    return Object.assign({
      scene_set_id: sc.id, stranger_id: sc.stranger.id, stranger_name: sc.stranger_name, word: sc.word, object_id: sc.object_id,
      incidental_type: sc.incidental, incidental_color: sc.incidental_color,
      view_ms: viewMs, timed_out: key.timedOut ? 1 : 0,
      label_audio_ms: label.duration_ms, greet_audio_ms: greet.duration_ms,
      label_onset_to_end_ms: labelOnset ? Math.round(tLabelEnd - labelOnset) : null,
      label_segments_s: (info.segments || []).map((x) => +x.toFixed(3)).join('|'),
      label_segment_source: info.segSource || '',
      audio_simulated: (label.simulated || greet.simulated) ? 1 : 0,
      scene_total_ms: totalMs
    }, mv);
  }

  return { run, AOI_NORM, POS, GAZE };
})();
