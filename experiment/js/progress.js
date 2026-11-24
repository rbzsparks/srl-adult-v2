/* progress.js: reload handling.
 * Stores ONLY a stage marker and a reload counter in localStorage, keyed by Prolific ID + study ID.
 * No responses and never the typed name.
 *   stage 'setup'  (setup, avatar, audio check): a reload restarts the JS block; reload_pre_fam += 1
 *   stage 'fam' | 'post_fam' | 'test' | 'done': a reload shows a message and skips to the post-test questions. */
SRL.progress = (function () {
  const POST = ['fam', 'post_fam', 'test', 'done'];
  let key = null;

  function init(params) {
    key = 'srl_progress_' + (params.PROLIFIC_PID || 'nopid') + '_' + (params.STUDY_ID || 'nostudy');
    if (params.reset === '1') clear();
    let prev = null;
    try { prev = JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { prev = null; }
    if (!prev) { write({ stage: 'setup', reload_pre_fam: 0 }); return { mode: 'fresh', reload_pre_fam: 0 }; }
    if (POST.indexOf(prev.stage) >= 0) return { mode: 'post_fam_reload', stage: prev.stage, reload_pre_fam: prev.reload_pre_fam || 0 };
    const n = (prev.reload_pre_fam || 0) + 1;
    write({ stage: 'setup', reload_pre_fam: n });
    return { mode: 'pre_fam_reload', reload_pre_fam: n };
  }
  function write(obj) { try { localStorage.setItem(key, JSON.stringify(obj)); } catch (e) { /* storage blocked: reload detection unavailable */ } }
  function stage(s) {
    let cur = {};
    try { cur = JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch (e) { cur = {}; }
    cur.stage = s; write(cur);
  }
  function clear() { try { localStorage.removeItem(key); } catch (e) { /* ignore */ } }

  const warn = (e) => { e.preventDefault(); e.returnValue = ''; return ''; };
  function guard(on) {
    if (on) window.addEventListener('beforeunload', warn);
    else window.removeEventListener('beforeunload', warn);
  }
  return { init, stage, clear, guard };
})();
