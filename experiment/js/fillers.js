/* fillers.js
 * Filler 1: "Get ready" screen with a countdown (TIMING.FILLER1), shown after the scene instructions; the first scene starts automatically.
 * Filler 2: arithmetic verification ("7 + 5 = 13?") for TIMING.FILLER2, with a per-problem response deadline
 * (TIMING.FILLER2_DEADLINE) shown as a countdown bar. A problem not answered in time counts as an error.
 * Accuracy = correct / attempted; below FILLER2_ENGAGEMENT_MIN sets the engagement flag. */
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

  return { getReady, arithmetic };
})();
