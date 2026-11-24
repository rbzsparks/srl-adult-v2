/* main.js: builds the jsPsych timeline and runs the experiment (v3.0, docs/V2_SPEC.md).
 * Known:   intro → name → relationship → closeness → contact (2 questions) → duration → picture + notes* → designer →
 *          voice (+ voice closeness) → likeness (+ one-time revision*) → confirmation → matching* → audio check →
 *          scene instructions → "get ready" → 12 scenes (check-ins* after 3, 6, 9) → "felt like" → delay task →
 *          3 tests in the assigned order → end.
 * Control: intro → "you'll create a person named Sam" → picture + notes* (imagine) → the rest as above.
 * (* = can be switched off: config, or binding=0/1 / checkins=0/1 per participant)
 * start(opts): opts = { base, mode: 'qualtrics'|'local', params: {...}, finish: function } */
SRL.main = (function () {
  const U = SRL.util, UI = SRL.ui;

  // One generic jsPsych plugin: each step is an async function (display_element) => data.
  const SrlStep = (function (jspsych) {
    const info = {
      name: 'srl-step', version: '1.0.0',
      parameters: { stage: { type: jspsych.ParameterType.STRING, default: '' }, run: { type: jspsych.ParameterType.FUNCTION, default: undefined } },
      data: {}
    };
    class Plugin {
      constructor(jsPsych) { this.jsPsych = jsPsych; }
      trial(display_element, trial) {
        const t0 = U.now();
        Promise.resolve().then(() => trial.run(display_element)).then((d) => {
          display_element.innerHTML = '';
          this.jsPsych.finishTrial(Object.assign({ stage: trial.stage, step_ms: Math.round(U.now() - t0) }, d || {}));
        }).catch((err) => {
          console.error(err);
          if (SRL.main._onFatal) SRL.main._onFatal(err, trial.stage);
        });
      }
    }
    Plugin.info = info;
    return Plugin;
  })(window.jsPsychModule);

  // "colour>word>identity" (also accepts - or , as separators) -> ['colour', 'word', 'identity'], or null if invalid.
  function parseOrder(v) {
    if (!v) return null;
    const o = String(v).toLowerCase().split(/[>\-,|\s]+/).filter((x) => x);
    const ok = o.length === 3 && ['word', 'identity', 'colour'].every((t) => o.indexOf(t) >= 0);
    return ok ? o : null;
  }

  async function start(opts) {
    const C = SRL_CONFIG, params = opts.params || {};
    const debug = params.debug === '1' || params.debug === 'true';
    const S = {
      params, mode: opts.mode, debug, auto: debug && params.auto === '1',
      p: {}, fam: [], tests: [], events: [], filler2Trials: [], matchTrials: [], checkinRows: [], saveStatus: {},
      sessionKey: Date.now().toString(36), finished: false
    };
    window.SRL_STATE_FOR_DEBUG = debug ? S : undefined;
    S.timing = Object.assign({}, C.TIMING, debug ? C.DEBUG_TIMING : {});
    S.showName = params.name_label === '0' ? false : params.name_label === '1' ? true : C.SHOW_NAME_LABEL !== false;
    const tStart = U.now();
    S.p.js_start_epoch_ms = Date.now();

    // Assignment from the Qualtrics randomizer (or the URL locally). Anything missing: random here, flagged.
    S.condition = C.CONDITIONS.indexOf(params.condition) >= 0 ? params.condition : null;
    S.strangerSet = C.STRANGER_SETS.indexOf(params.stranger_set) >= 0 ? params.stranger_set : null;
    let order = parseOrder(params.test_order);
    S.p.assign_fallback = (!S.condition || !S.strangerSet || !order) ? 1 : 0;
    const seed = (crypto.getRandomValues(new Uint32Array(1))[0] >>> 0) || 1;
    U.seed(seed);
    if (!S.condition) S.condition = U.pick(C.CONDITIONS);
    if (!S.strangerSet) S.strangerSet = U.pick(C.STRANGER_SETS);
    if (!order) order = U.pick(C.TEST_ORDERS).slice();
    S.control = S.condition === 'control';
    S.order = order;
    // Separate random streams from the same recorded seed, so the binding steps and the name draws never shift the
    // draws that build the scene design.
    S.rng2 = SRL.people.rng((seed ^ 0x5BD1E995) >>> 0);
    const rng3 = SRL.people.rng((seed ^ 0x27D4EB2F) >>> 0);
    const ov = (v) => (v === '0' ? false : v === '1' ? true : null);
    const bOv = ov(params.binding), cOv = ov(params.checkins);
    S.steps = {
      recall: bOv !== null ? bOv : C.RECALL_ENABLED !== false,
      revision: bOv !== null ? bOv : C.REVISION_ENABLED !== false,
      matching: bOv !== null ? bOv : C.MATCHING_ENABLED !== false,
      checkins: cOv !== null ? cOv : C.CHECKINS_ENABLED !== false
    };
    S.matchKeymap = S.rng2() < 0.5 ? 'F=match' : 'J=match';
    S.checkinOrder = SRL.binding.CHECKIN_ORDERS[Math.floor(S.rng2() * SRL.binding.CHECKIN_ORDERS.length)];
    if (S.control) {
      const cn = C.CONTROL_NAMES[Math.floor(rng3() * C.CONTROL_NAMES.length)];
      S.knownName = cn.name; S.controlOnset = cn.onset;
      S.p.control_name = cn.name;
    }
    Object.assign(S.p, {
      condition: S.condition, stranger_set: S.strangerSet, test_order: order.join('>'),
      pos_word: order.indexOf('word') + 1, pos_identity: order.indexOf('identity') + 1, pos_colour: order.indexOf('colour') + 1,
      recall_enabled: S.steps.recall ? 1 : 0, revision_enabled: S.steps.revision ? 1 : 0, matching_enabled: S.steps.matching ? 1 : 0,
      checkins_enabled: S.steps.checkins ? 1 : 0, steps_source: bOv !== null || cOv !== null ? 'override' : 'config',
      checkin_order: S.steps.checkins ? S.checkinOrder.join('>') : '',
      seed, exp_version: C.VERSION, qualtrics_engine: C.QUALTRICS_ENGINE, filler_task: C.FILLER_TASK, colour_choices: C.COLOUR_CHOICES,
      surprise_test: C.SURPRISE_TEST ? 1 : 0, mouseview_on: C.MOUSEVIEW ? 1 : 0, debug: debug ? 1 : 0,
      name_label_shown: S.showName ? 1 : 0,
      browser: U.browserInfo(), screen_w: screen.width, screen_h: screen.height,
      window_w: window.innerWidth, window_h: window.innerHeight, fullscreen_exits: 0, tab_switches: 0,
      reload_pre_fam: 0, reloaded_post_fam: 0, reload_stage: '', js_error: '',
      prolific_pid: params.PROLIFIC_PID || '', study_id: params.STUDY_ID || '', session_id: params.SESSION_ID || ''
    });

    const canvas = UI.mount();
    // Event logging: fullscreen exits and tab switches (counts + timestamps).
    const ev = (type) => S.events.push({ t: Math.round(U.now() - tStart), type });
    const onFs = () => {
      const fs = UI.isFullscreen(); ev(fs ? 'fullscreen_enter' : 'fullscreen_exit');
      if (!fs && S.running) { S.p.fullscreen_exits++; UI.showBanner(true); } else UI.showBanner(false);
    };
    const onVis = () => { ev('visibility_' + document.visibilityState); if (document.visibilityState === 'hidden' && S.running) S.p.tab_switches++; };
    document.addEventListener('fullscreenchange', onFs); document.addEventListener('webkitfullscreenchange', onFs);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('error', (e) => { S.p.js_error = String((e && e.message) || e).slice(0, 200); });

    // Loading screen + preload (narrator prompts and the 6 voice samples; the chosen voice's clips load later).
    UI.page(canvas, '<h1>Loading…</h1><p class="srl-lead" id="ld">Preparing the study. This takes a few seconds.</p><div class="srl-timer"><div style="width:0%"></div></div>');
    const ld = canvas.querySelector('.srl-timer > div');
    try {
      await SRL.stimuli.load(opts.base, S.strangerSet);
      const errs = await SRL.audio.preload(opts.base, SRL.stimuli.narratorClipIds(), (d, n) => (ld.style.width = (100 * d / n) + '%'));
      S.p.audio_load_errors = errs.length;
    } catch (e) {
      S.p.js_error = 'load: ' + e.message;
      UI.page(canvas, `<h1>Sorry, the study could not load</h1><p class="srl-lead">Please check your internet connection and reload the page. If this keeps happening, please contact the researchers through Prolific.</p>`);
      return;
    }

    let jsPsych = null;
    const finish = async (reason) => {
      if (S.finished) return; S.finished = true; S.running = false;
      SRL.progress.stage('done'); SRL.progress.guard(false);
      S.p.total_ms = Math.round(U.now() - tStart);
      S.p.js_end_epoch_ms = Date.now();
      S.p.finish_reason = reason || 'complete';
      S.p.fam_fast_advance_count = S.fam.filter((r) => r.view_ms !== null && r.view_ms < S.timing.SPACE_ENABLE_AFTER_LABEL + 300 && !r.timed_out).length;
      S.p.fam_timeout_count = S.fam.filter((r) => r.timed_out).length;
      S.p.audio_simulated_scenes = S.fam.filter((r) => r.audio_simulated).length;
      S.p.audio_load_errors = SRL.audio.errors().length;
      try {
        if (jsPsych) jsPsych.data.addProperties(Object.fromEntries(SRL.data.fields().participant.map((k) => [k, S.p[k] === undefined ? null : S.p[k]])));
        await SRL.data.finalSave(S, jsPsych || { data: { get: () => ({ csv: () => '' }) } });
      } catch (e) {
        console.error(e);
        S.p.js_error = ('save: ' + e.message).slice(0, 200);
        try { if (S.mode === 'qualtrics') SRL.data.setQualtrics({ js_error: S.p.js_error, reloaded_post_fam: S.p.reloaded_post_fam }); } catch (e2) { /* nothing more we can do */ }
      }
      const pg = UI.page(canvas, S.mode === 'qualtrics'
        ? '<h1>Thank you!</h1><p class="srl-lead">This part is finished. Click <b>Continue</b> to answer a few final questions.</p><div class="srl-actions"><button class="srl-btn" id="go">Continue</button></div>'
        : '<h1>Done (local run)</h1><p class="srl-lead">Data were saved (debug: downloaded / dev server). See the console for the field object.</p><div class="srl-actions"><button class="srl-btn" id="go">Close</button></div>');
      if (S.auto) setTimeout(() => pg.querySelector('#go').click(), 300);
      await UI.onClick(pg.querySelector('#go'));
      UI.exitFullscreen();
      document.removeEventListener('fullscreenchange', onFs); document.removeEventListener('webkitfullscreenchange', onFs);
      document.removeEventListener('visibilitychange', onVis);
      UI.unmount();
      if (opts.finish) opts.finish(S.p);
    };
    SRL.main._onFatal = (err, stage) => { S.p.js_error = ('step ' + stage + ': ' + (err && err.message)).slice(0, 200); finish('error'); };

    // Reload handling.
    const prog = SRL.progress.init(params);
    S.p.reload_pre_fam = prog.reload_pre_fam || 0;
    if (prog.mode === 'post_fam_reload') {
      S.p.reloaded_post_fam = 1; S.p.reload_stage = prog.stage;
      const pg = UI.page(canvas, `<h1>The page was reloaded</h1><p class="srl-lead">It looks like the page was reloaded. This study can't be restarted, but you'll still be paid. Please continue.</p>
        <div class="srl-actions"><button class="srl-btn" id="go">Continue</button></div>`);
      if (S.auto) setTimeout(() => pg.querySelector('#go').click(), 300);
      await UI.onClick(pg.querySelector('#go'));
      S.finished = false;
      await finish('reloaded_post_fam');
      return;
    }
    if (debug) UI.debug(`DEBUG | ${S.condition}${S.control ? ' (' + S.knownName + ')' : ''} | set ${S.strangerSet} | ${order.join('>')} | seed ${seed}`);

    S.running = true;
    SRL.progress.guard(true);
    canvas.innerHTML = '';
    jsPsych = initJsPsych({ display_element: canvas, on_finish: () => finish('complete') });
    if (debug) S.jsPsychJson = () => jsPsych.data.get().json();   // debug only: read by tools/privacy_check.html

    const sec = (name) => (ms) => (S.p['t_' + name + '_ms'] = (S.p['t_' + name + '_ms'] || 0) + ms);
    const step = (stage, section, fn) => ({
      type: SrlStep, stage,
      run: async (el) => {
        const t0 = U.now();
        const d = await fn(el);
        sec(section)(Math.round(U.now() - t0));
        return d;
      }
    });
    const keep = (d, keys) => { keys.forEach((k) => { if (d[k] !== undefined) S.p[k] = d[k]; }); return d; };
    const all = (d) => { Object.assign(S.p, d); return d; };   // these steps return only fields from fields.js
    const B = SRL.binding, Sc = SRL.screens;
    // Start the hair bitmaps for a scene's two figures (as the scene draws them); resolves when both are ready.
    const prerenderScene = (sc) => [SRL.people.prerender(sc.stranger, -1), SRL.people.prerender(S.knownSpec, 1)];

    const timeline = [
      step('intro', 'intro', async (el) => keep(await Sc.intro(el, S), ['window_small_prompt', 'window_w', 'window_h']))
    ].concat(S.control ? [
      step('control_intro', 'setup', async (el) => all(await B.controlIntro(el, S)))
    ] : [
      step('name', 'setup', async (el) => keep(await Sc.nameEntry(el, S), ['name_length', 'name_flagged_title', 'name_suspect'])),
      step('relationship', 'setup', async (el) => keep(await Sc.relationship(el, S), ['relationship_type', 'is_kin'])),
      step('closeness', 'setup', async (el) => all(await B.closeness(el, S))),
      step('contact', 'setup', async (el) => all(await B.contact(el, S))),
      step('duration', 'setup', async (el) => keep(await Sc.duration(el, S), ['duration']))
    ], [
      step('recall', 'recall', async (el) => (S.steps.recall ? all(await B.recall(el, S)) : {})),
      step('designer', 'designer', async (el) => {
        const d = await SRL.designer.run(el, S);
        S.knownSpec = d.spec;
        if (!S.steps.revision) S.notes = null;   // the notes leave memory once the last designer visit is over
        const keys = ['designer_edits', 'designer_resets', 'designer_tabs_visited'].concat(SRL.designer.TABS.map((t) => 't_designer_' + t.id + '_ms'), SRL.designer.TABS.map((t) => 'designer_edits_' + t.id));
        const out = {};
        keys.forEach((k) => { S.p[k] = d[k]; out[k] = d[k]; });
        return out;
      }),
      step('voice', 'voice', async (el) => {
        // Names first (the typed name is known by now), then the design that uses them, then the voice.
        const nm = SRL.names.assign(S, SRL.stimuli.strangers(), rng3);
        S.foilName = nm.foilName;
        S.design = SRL.stimuli.design(order, nm.byStranger);
        all({ name_swaps: nm.swaps, swapped_names: nm.swapped.join('|'), foil_name: nm.foilName,
          name_face_map: SRL.stimuli.strangers().map((s) => s.id + '=' + nm.byStranger[s.id]).join(';') });
        S.p.fam_order = S.design.fam.map((s) => s.id).join('|');
        S.p.incidental_colors = S.design.sets.map((s) => s.id + ':' + s.incidental_color).join('|');
        S.p.aoi_norm = SRL.scene.AOI_NORM;
        const d = all(await B.voice(el, S));
        S.voice = d.voice_id;
        // The chosen voice's clips load in the background; the audio check waits for them.
        const names = S.design.sets.map((s) => s.stranger_name);
        S.voiceLoad = SRL.audio.preload(opts.base, SRL.stimuli.voiceClipIds(S.voice, names));
        return d;
      }),
      step('likeness', 'designer', async (el) => {
        const a = await SRL.designer.likeness(el, S, S.knownSpec);
        Object.assign(S.p, { likeness_1: a.likeness_rating, likeness_rating: a.likeness_rating, likeness_rt_ms: a.likeness_rt_ms });
        if (S.steps.revision) {
          S.p.revised = 0;
          S.p.revision_offered = a.likeness_rating <= C.REVISION_MAX_RATING ? 1 : 0;
          if (S.p.revision_offered && await B.revisionOffer(el, S, S.knownSpec)) {
            S.p.revised = 1;
            const d2 = await SRL.designer.run(el, S, { start: S.knownSpec, revision: true });
            S.knownSpec = d2.spec;
            Object.assign(S.p, { designer_ms_2: d2.designer_ms, designer_edits_2: d2.designer_edits });
            const b = await SRL.designer.likeness(el, S, S.knownSpec);
            Object.assign(S.p, { likeness_2: b.likeness_rating, likeness_rating: b.likeness_rating });
          }
        }
        S.notes = null;   // the notes leave memory once the last designer visit is over
        const out = {};
        ['likeness_1', 'likeness_rt_ms', 'revision_offered', 'revised', 'likeness_2', 'likeness_rating', 'designer_ms_2', 'designer_edits_2']
          .forEach((k) => { if (S.p[k] !== undefined) out[k] = S.p[k]; });
        return out;
      }),
      step('confirm', 'binding', async (el) => {
        // The foil avatar (matching task only) is generated from the FINAL avatar (after any revision).
        const u = SRL.avatarRules.unfamiliar(S.knownSpec, S.p.seed, C);
        S.foilSpec = u.spec;
        all({ avatar: SRL.people.vecString(S.knownSpec), foil_avatar: SRL.people.vecString(u.spec), foil_changes: u.changes.join('|'),
          foil_k: u.K, foil_identity_dist: +u.distance.toFixed(3) });
        return all(await B.confirm(el, S));
      }),
      step('matching', 'matching', async (el) => (S.steps.matching ? all(await B.matching(el, S)) : {})),
      step('audio_check', 'audio_check', async (el) => {
        await S.voiceLoad;
        return keep(await Sc.audioCheck(el, S), ['audio_check_pass', 'audio_check_attempts']);
      }),
      step('fam_instructions', 'fam', async (el) => { SRL.progress.stage('fam'); S.design.fam.forEach(prerenderScene); return Sc.famInstructions(el, S); }),
      step('filler1', 'filler1', (el) => SRL.fillers.getReady(el, S, S.timing.FILLER1))
    ]);
    // The 12 scenes are added when the timeline reaches them (the design exists only after the voice step).
    timeline.push({
      timeline: [step('fam_scene', 'fam', async (el) => {
        const i = S.fam.length, sc = S.design.fam[i];
        await Promise.race([Promise.all(prerenderScene(sc)), U.sleep(2500)]);
        const ctx = { avatarSpec: S.knownSpec, avatarName: S.knownName, voice: S.voice, timing: S.timing, debug: S.debug, auto: S.auto, showName: S.showName };
        const r = await SRL.scene.run(el, sc, ctx);
        Object.assign(r, { serial_position: i + 1, presentation: sc.presentation, lag: sc.lag });
        S.fam.push(r);
        return r;
      }), {
        timeline: [step('checkin', 'checkin', async (el) => {
          const k = C.CHECKIN_AFTER_TRIALS.indexOf(S.fam.length);
          return all(await B.checkin(el, S, k + 1, S.fam.length));
        })],
        // Check-ins after the configured trials (never after the last one), once SPACE has ended the scene.
        conditional_function: () => S.steps.checkins && C.CHECKIN_AFTER_TRIALS.indexOf(S.fam.length) >= 0 && S.fam.length < 12
      }],
      loop_function: () => S.fam.length < 12
    });
    timeline.push(step('represent', 'represent', async (el) => {
      SRL.progress.stage('post_fam');
      return all(await B.represent(el, S));
    }));
    timeline.push(step('filler2', 'filler2', async (el) => {
      const d = C.FILLER_TASK === 'arithmetic'
        ? await SRL.fillers.arithmetic(el, S, S.timing.FILLER2, S.timing.FILLER2_DEADLINE)
        : await SRL.fillers.parity(el, S, S.timing.FILLER2, S.timing.PARITY_SOA);
      S.filler2Trials = d.filler2_trials;
      const out = {};
      Object.keys(d).forEach((k) => { if (k !== 'filler2_trials') { S.p[k] = d[k]; out[k] = d[k]; } });
      // Incremental backup after familiarization + the delay task.
      SRL.data.dataPipe(S, 'after_fam', SRL.data.fullJson(S)).then((r) => (S.saveStatus.datapipe_after_fam = r));
      return out;
    }));
    timeline.push(step('test_intro', 'test', async (el) => {
      SRL.progress.stage('test');
      return Sc.message(el, S, 'Questions about the scenes', '<p class="srl-lead">Now we\'ll ask you some questions about the scenes you saw.</p>');
    }));
    order.forEach((type, bi) => {
      timeline.push(step('test_block_intro', 'test', (el) => SRL.tests.blockIntro(el, S, type, bi)));
      for (let k = 0; k < 6; k++) {
        timeline.push(step('test', 'test', async (el) => {
          const r = await SRL.tests.trial(el, S, S.design.tests[type][k]);
          r.block_index = bi + 1;
          S.tests.push(r);
          return r;
        }));
      }
      timeline.push(step('test_block_end', 'test', async () => {
        SRL.data.dataPipe(S, 'after_test_' + type, SRL.data.fullJson(S)).then((r) => (S.saveStatus['datapipe_after_' + type] = r));
        return {};
      }));
    });

    await jsPsych.run(timeline);
  }

  return { start, _onFatal: null };
})();
