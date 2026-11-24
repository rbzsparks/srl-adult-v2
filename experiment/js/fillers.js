/* fillers.js
 * Filler 1: "Get ready" screen with a countdown (TIMING.FILLER1), shown after the scene instructions; the first scene starts automatically.
 * Filler 2 (the delay after the scenes, TIMING.FILLER2), one of (config FILLER_TASK):
 *   parity (default): self-paced two-digit numbers, F = odd, J = even; each number stays up until a key press, at most
 *     TIMING.PARITY_MAX_MS; the pressed key lights up (no right/wrong feedback). parity_flag = accuracy among answered < PARITY_FLAG_ACC or misses >= PARITY_FLAG_MISSES.
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

  /* Odd/even numbers 10-99: parity chosen at random but never more than 4 of one parity in a row, and never the same
   * number twice in a row. */
  function parityNumbers(n) {
    const nums = [];
    let run = 0;
    for (let i = 0; i < n; i++) {
      let odd = U.randInt(2);
      if (i && run >= 4 && odd === nums[i - 1] % 2) odd = 1 - odd;
      run = i && odd === nums[i - 1] % 2 ? run + 1 : 1;
      let x;
      do { x = 10 + 2 * U.randInt(45) + odd; } while (i && x === nums[i - 1]);
      nums.push(x);
    }
    return nums;
  }

  /* Self-paced odd/even (v3.0.4). Each number stays up until F or J is pressed, for at most maxMs (no response = a miss).
   * The pressed key lights up briefly (an acknowledgement, not right/wrong feedback), then the next number appears.
   * The task ends after ms; a number cut off by the end is not counted. Later presses on the same number are ignored. */
  async function parity(el, S, ms, maxMs) {
    const sec = Math.round(ms / 1000), ACK = 250, GAP = 150;
    await SRL.screens.message(el, S, 'Odd or even?',
      `<p class="srl-lead">Now a short number task.</p>
       <p>Numbers will appear one at a time. Press <b>F</b> if the number is <b>odd</b> and <b>J</b> if it is <b>even</b>.
       As soon as you answer, the next number appears. If you don't answer within ${Math.round(maxMs / 1000)} seconds, the next one appears anyway.</p>
       <p>Answer as quickly and accurately as you can. Put your fingers on the <b>F</b> and <b>J</b> keys. The task ends automatically after ${sec} seconds.</p>`, 'Start');
    const pg = UI.page(el, `<h1>Odd or even?</h1><div class="srl-timer"><div></div></div>
      <div class="ar-eq pa-num"></div>
      <p class="bd-keys pa-keys"><span data-k="F"><b>F</b> = odd</span><span data-k="J"><b>J</b> = even</span></p>`);
    const box = pg.querySelector('.pa-num'), keyEl = (k) => pg.querySelector(`.pa-keys [data-k="${k}"]`);
    const nums = parityNumbers(Math.ceil(ms / (ACK + GAP)) + 1), trials = [];
    let cur = null, wake = null;
    const respond = (k) => {
      if (!cur || cur.resp !== null) return;
      cur.resp = k; cur.rt_ms = Math.round(U.now() - cur.t0);
      keyEl(k).classList.add('hit');
      if (wake) wake();
    };
    const onKey = (e) => {
      const k = e.code === 'KeyF' ? 'F' : e.code === 'KeyJ' ? 'J' : null;
      if (!k) return;
      e.preventDefault();
      respond(k);
    };
    window.addEventListener('keydown', onKey, true);
    const tStart = U.now(), tEnd = tStart + ms;
    const stopTotal = shrink(pg.querySelector('.srl-timer > div'), ms);
    const waitUntil = (t) => new Promise((r) => { const id = setTimeout(() => { wake = null; r(); }, Math.max(0, t - U.now())); wake = () => { clearTimeout(id); wake = null; r(); }; });
    for (let i = 0; i < nums.length && U.now() < tEnd; i++) {
      const x = nums[i];
      cur = { i: i + 1, number: x, odd: x % 2, resp: null, rt_ms: null, t0: U.now() };
      box.textContent = String(x);
      if (S.auto && U.random() < 0.95) {
        const c = cur, right = U.random() < 0.9;
        setTimeout(() => { if (cur === c) respond((c.odd === 1) === right ? 'F' : 'J'); }, 300 + U.randInt(500));
      }
      const deadline = Math.min(cur.t0 + maxMs, tEnd);
      await waitUntil(deadline);
      const c = cur;
      cur = null;
      // A number the task's end cut off before its deadline (and before an answer) is not counted.
      if (c.resp === null && deadline >= tEnd && tEnd - c.t0 < maxMs) break;
      trials.push({ trial: c.i, number: x, odd: c.odd, resp: c.resp, rt_ms: c.rt_ms, missed: c.resp === null ? 1 : 0,
        correct: c.resp !== null && (c.resp === 'F') === (c.odd === 1) ? 1 : 0 });
      if (c.resp !== null) await U.sleep(Math.max(0, Math.min(ACK, tEnd - U.now())));
      box.textContent = '';
      pg.querySelectorAll('.pa-keys .hit').forEach((e) => e.classList.remove('hit'));
      await U.sleep(Math.max(0, Math.min(GAP, tEnd - U.now())));
    }
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
