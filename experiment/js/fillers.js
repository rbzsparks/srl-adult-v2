/* fillers.js
 * Filler 1: "Get ready" screen with a countdown (TIMING.FILLER1), shown after the scene instructions; the first scene starts automatically.
 * Filler 2 (the delay after the scenes, TIMING.FILLER2), one of (config FILLER_TASK):
 *   parity (v3.0, default): a two-digit number every TIMING.PARITY_SOA ms; F = odd, J = even; each number stays up until
 *     the next, no feedback. parity_flag = accuracy among answered < PARITY_FLAG_ACC or misses >= PARITY_FLAG_MISSES.
 *   arithmetic (pilot 1): verification ("7 + 5 = 13?") with a per-problem deadline (TIMING.FILLER2_DEADLINE); a problem
 *     not answered in time counts as an error. Below FILLER2_ENGAGEMENT_MIN sets filler2_low_engagement. */
SRL.fillers = (function () {
  const U = SRL.util, UI = SRL.ui;

  // Shrinks a bar from 100% to 0% over ms. Returns a stop function.
  function shrink(bar, ms, onTick) {
    const t0 = U.now();
    let stop = false;
    const loop = () => {
      if (stop) return;
      const left = U.clamp(1 - (U.now() - t0) / ms, 0, 1);
      bar.style.width = (100 * left) + '%';
      if (onTick) onTick(left * ms);
      U.frame(loop);
    };
    U.frame(loop);
    return () => (stop = true);
  }

  async function getReady(el, S, ms) {
    const pg = UI.page(el, `<div class="gr-wrap"><h1>Get ready</h1>
      <p class="srl-lead">The first scene starts in a moment.</p>
      <div class="gr-count"></div><div class="srl-timer gr-bar"><div></div></div></div>`);
    const count = pg.querySelector('.gr-count');
    const t0 = U.now();
    const stop = shrink(pg.querySelector('.gr-bar > div'), ms, (left) => (count.textContent = Math.max(1, Math.ceil(left / 1000))));
    await U.sleep(ms);
    stop();
    return { filler1_ms: Math.round(U.now() - t0) };
  }

  function problem() {
    let a, b;
    if (U.random() < 0.5) { a = 2 + U.randInt(8); b = 2 + U.randInt(8); }
    else { a = 11 + U.randInt(19); b = 2 + U.randInt(8); }
    const op = U.random() < 0.6 ? '+' : '−';
    if (op === '−' && b > a) [a, b] = [b, a];
    const ans = op === '+' ? a + b : a - b;
    const truth = U.random() < 0.5;
    let shown = ans;
    if (!truth) { const d = U.pick([-2, -1, 1, 2, 10, -10]); shown = ans + d; if (shown < 0) shown = ans + Math.abs(d); }
    return { a, b, op, ans, shown, truth: truth ? 1 : 0 };
  }

  async function arithmetic(el, S, ms, deadline) {
    const sec = Math.round(ms / 1000), dl = Math.round(deadline / 100) / 10;
    await SRL.screens.message(el, S, 'A short arithmetic task',
      `<p class="srl-lead">Now a short arithmetic task.</p>
       <p>You'll see equations like <b>7 + 5 = 13</b>. Press <b>Y</b> if the equation is correct, or <b>N</b> if it is wrong. (You can also click the buttons.)</p>
       <p>You have <b>${dl} seconds</b> for each equation; the bar under it shows the time left. Answer as quickly and accurately as you can.
       The task ends automatically after ${sec} seconds.</p>`, 'Start');
    const pg = UI.page(el, `<h1>Is it correct?</h1><div class="srl-timer"><div></div></div>
      <div class="ar-eq"></div><div class="ar-deadline"><div></div></div><p class="ar-msg">&nbsp;</p>
      <div class="srl-actions srl-center"><button class="srl-btn" id="y">Y: correct</button> <button class="srl-btn" id="n">N: wrong</button></div>`);
    const eq = pg.querySelector('.ar-eq'), dbar = pg.querySelector('.ar-deadline > div'), msg = pg.querySelector('.ar-msg');
    const stopTotal = shrink(pg.querySelector('.srl-timer > div'), ms);
    const tStart = U.now(), tEnd = tStart + ms;
    const trials = [];
    while (U.now() < tEnd) {
      const p = problem();
      eq.textContent = `${p.a} ${p.op} ${p.b} = ${p.shown}`;
      msg.innerHTML = '&nbsp;';
      const t0 = U.now();
      const stopBar = shrink(dbar, deadline);
      const resp = await new Promise((resolve) => {
        let done = false;
        const fin = (r) => { if (done) return; done = true; cleanup(); resolve(r); };
        const key = (e) => { const k = e.key.toLowerCase(); if (k === 'y' || k === 'n') { e.preventDefault(); fin(k); } };
        const cy = () => fin('y'), cn = () => fin('n');
        const tDead = setTimeout(() => fin('timeout'), deadline);
        const tOver = setTimeout(() => fin('end'), Math.max(0, tEnd - U.now()));
        const cleanup = () => {
          window.removeEventListener('keydown', key, true); pg.querySelector('#y').removeEventListener('click', cy); pg.querySelector('#n').removeEventListener('click', cn);
          clearTimeout(tDead); clearTimeout(tOver);
        };
        window.addEventListener('keydown', key, true);
        pg.querySelector('#y').addEventListener('click', cy); pg.querySelector('#n').addEventListener('click', cn);
        if (S.auto) {
          const r = U.random();
          if (r < 0.9) setTimeout(() => fin(r < 0.8 ? (p.truth ? 'y' : 'n') : (p.truth ? 'n' : 'y')), 300 + U.randInt(900));
        }
      });
      stopBar();
      if (resp === 'end') break; // the task ended mid-problem: not attempted
      const timedOut = resp === 'timeout';
      trials.push({ eq: `${p.a}${p.op}${p.b}=${p.shown}`, truth: p.truth, resp: timedOut ? null : resp, timed_out: timedOut ? 1 : 0,
        correct: !timedOut && (resp === 'y') === !!p.truth ? 1 : 0, rt_ms: timedOut ? null : Math.round(U.now() - t0) });
      eq.textContent = '';
      if (timedOut) msg.textContent = 'Too slow. Here is the next one.';
      await U.sleep(timedOut ? 700 : 200);
    }
    stopTotal();
    const n = trials.length, nCorrect = trials.reduce((s, t) => s + t.correct, 0);
    const acc = n ? nCorrect / n : null;
    const min = SRL_CONFIG.FILLER2_ENGAGEMENT_MIN;
    return {
      filler2_accuracy: acc === null ? null : +acc.toFixed(3),
      filler2_n_attempted: n,
      filler2_n_timeout: trials.reduce((s, t) => s + t.timed_out, 0),
      filler2_low_engagement: acc === null || acc < min ? 1 : 0,
      filler2_ms: Math.round(U.now() - tStart),
      filler2_trials: trials
    };
  }

  /* Odd/even. Numbers 10-99, half odd and half even in random order, no more than 4 of one parity in a row, and never
   * the same number twice in a row. The first F/J press per number counts; later presses are ignored. */
  function parityNumbers(n) {
    for (let tries = 0; tries < 1000; tries++) {
      const par = U.shuffle(Array(n).fill(0).map((_, i) => i % 2));
      let ok = true, run = 1;
      for (let i = 1; i < n && ok; i++) { run = par[i] === par[i - 1] ? run + 1 : 1; if (run > 4) ok = false; }
      if (!ok) continue;
      const nums = [];
      par.forEach((odd, i) => { let x; do { x = 10 + 2 * U.randInt(45) + odd; } while (i && x === nums[i - 1]); nums.push(x); });
      return nums;
    }
    throw new Error('parity: no valid sequence');
  }

  async function parity(el, S, ms, soa) {
    const sec = Math.round(ms / 1000), n = Math.floor(ms / soa);
    await SRL.screens.message(el, S, 'Odd or even?',
      `<p class="srl-lead">Now a short number task.</p>
       <p>A number will appear every 2 seconds. Press <b>F</b> if it is <b>odd</b> and <b>J</b> if it is <b>even</b>.
       The numbers keep coming whether or not you answer, so answer each one as quickly and accurately as you can.</p>
       <p>Put your fingers on the <b>F</b> and <b>J</b> keys. The task ends automatically after ${sec} seconds.</p>`, 'Start');
    const pg = UI.page(el, `<h1>Odd or even?</h1><div class="srl-timer"><div></div></div>
      <div class="ar-eq pa-num"></div>
      <p class="bd-keys"><span><b>F</b> = odd</span><span><b>J</b> = even</span></p>`);
    const box = pg.querySelector('.pa-num');
    const nums = parityNumbers(n), trials = [];
    let cur = null;
    const onKey = (e) => {
      if (!cur || cur.resp !== null) return;
      const k = e.code === 'KeyF' ? 'F' : e.code === 'KeyJ' ? 'J' : null;
      if (!k) return;
      e.preventDefault();
      cur.resp = k; cur.rt_ms = Math.round(U.now() - cur.t0);
    };
    window.addEventListener('keydown', onKey, true);
    const tStart = U.now();
    const stopTotal = shrink(pg.querySelector('.srl-timer > div'), n * soa);
    for (let i = 0; i < n; i++) {
      const x = nums[i];
      cur = { i: i + 1, number: x, odd: x % 2, resp: null, rt_ms: null, t0: U.now() };
      box.textContent = String(x);
      if (S.auto && U.random() < 0.95) {
        const c = cur, right = U.random() < 0.9;
        setTimeout(() => { if (c.resp === null) { c.resp = (c.odd === 1) === right ? 'F' : 'J'; c.rt_ms = 500; } }, 200);
      }
      // Each number is up for one SOA, timed from the task start so the schedule never drifts.
      await U.sleep(Math.max(0, tStart + (i + 1) * soa - U.now()));
      trials.push({ trial: cur.i, number: x, odd: cur.odd, resp: cur.resp, rt_ms: cur.rt_ms, missed: cur.resp === null ? 1 : 0,
        correct: cur.resp !== null && (cur.resp === 'F') === (cur.odd === 1) ? 1 : 0 });
    }
    cur = null;
    window.removeEventListener('keydown', onKey, true);
    stopTotal();
    const answered = trials.filter((t) => !t.missed), nCorrect = trials.reduce((s, t) => s + t.correct, 0);
    const acc = answered.length ? nCorrect / answered.length : null, misses = trials.length - answered.length;
    const rts = answered.map((t) => t.rt_ms).sort((a, b) => a - b), m = rts.length >> 1;
    const med = rts.length ? (rts.length % 2 ? rts[m] : Math.round((rts[m - 1] + rts[m]) / 2)) : null;
    return {
      parity_trials: trials.length, parity_correct: nCorrect, parity_misses: misses,
      parity_acc: acc === null ? null : +acc.toFixed(3), parity_rt_median: med,
      parity_flag: acc === null || acc < SRL_CONFIG.PARITY_FLAG_ACC || misses >= SRL_CONFIG.PARITY_FLAG_MISSES ? 1 : 0,
      filler2_ms: Math.round(U.now() - tStart), filler2_trials: trials
    };
  }

  return { getReady, arithmetic, parity };
})();
