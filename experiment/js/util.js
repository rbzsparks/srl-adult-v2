/* util.js: small helpers shared by every module. */
window.SRL = window.SRL || {};
SRL.util = (function () {
  // Seeded RNG (mulberry32) so every randomization can be reconstructed from the recorded seed.
  let _state = 1;
  function seed(s) { _state = (s >>> 0) || 1; }
  function random() {
    _state = (_state + 0x6D2B79F5) >>> 0;
    let t = _state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function randInt(n) { return Math.floor(random() * n); }
  function pick(arr) { return arr[randInt(arr.length)]; }
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = randInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function sample(arr, k) { return shuffle(arr).slice(0, k); }

  function levenshtein(a, b) {
    a = a.toLowerCase(); b = b.toLowerCase();
    const m = a.length, n = b.length;
    // Plain loop, not Array.from(…, fn): Qualtrics loads Prototype.js 1.7.1, whose Array.from ignores the mapping function.
    const d = [];
    for (let i = 0; i <= m; i++) d.push([i].concat(new Array(n).fill(0)));
    for (let j = 1; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    return d[m][n];
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const now = () => performance.now();
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  // Next animation frame, with a 50 ms timer fallback (rAF pauses when a page isn't being drawn, e.g. in a
  // throttled or background window). All motion is time-based, so timing never depends on frame rate.
  function frame(cb) {
    let done = false;
    const f = () => { if (done) return; done = true; cb(); };
    requestAnimationFrame(f); setTimeout(f, 50);
  }
  // Tween: fn(t in 0..1). Resolves when done.
  function tween(ms, fn, ease) {
    ease = ease || easeInOut;
    return new Promise((resolve) => {
      const t0 = now();
      function step() {
        const t = clamp((now() - t0) / ms, 0, 1);
        fn(ease(t));
        if (t < 1) frame(step); else resolve();
      }
      frame(step);
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function hexToRgb(h) { h = h.replace('#', ''); return [0, 2, 4].map((i) => parseInt(h.substr(i, 2), 16)); }
  function rgbToHex(rgb) { return '#' + rgb.map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('').toUpperCase(); }
  function mixHex(a, b, t) { const A = hexToRgb(a), B = hexToRgb(b); return rgbToHex(A.map((v, i) => lerp(v, B[i], t))); }

  function h(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }

  function browserInfo() {
    const ua = navigator.userAgent;
    let name = 'other';
    if (/Edg\//.test(ua)) name = 'edge'; else if (/OPR\//.test(ua)) name = 'opera';
    else if (/Firefox\//.test(ua)) name = 'firefox'; else if (/Chrome\//.test(ua)) name = 'chrome';
    else if (/Safari\//.test(ua)) name = 'safari';
    return name;
  }

  return { seed, random, randInt, pick, shuffle, sample, levenshtein, sleep, now, clamp, lerp, easeInOut, easeOut, frame, tween, escapeHtml, mixHex, h, browserInfo };
})();
