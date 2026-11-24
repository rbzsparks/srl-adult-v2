/* audio.js: Web Audio preload + playback.
 * Lip-sync is amplitude-driven: an RMS envelope is computed from each decoded file at load time and read at the
 * current playback position, so swapping in new recordings with the same filenames needs no other change.
 * Label clips are segmented ("Look!" | "It's a X!" | "A X!") by finding the two longest pauses in the file. */
SRL.audio = (function () {
  const U = SRL.util;
  const FRAME = 0.02; // 20 ms envelope frames
  let ctx = null;
  const clips = {};   // id -> { buffer, env, peak, duration, segments }
  const errors = [];
  let format = 'mp3';

  function context() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
    }
    return ctx;
  }
  async function unlock() {
    const c = context();
    if (c.state !== 'running') { try { await c.resume(); } catch (e) { /* ignore */ } }
    // Play a 1-sample silent buffer (iOS/Safari unlock idiom).
    const b = c.createBuffer(1, 1, 22050), s = c.createBufferSource();
    s.buffer = b; s.connect(c.destination); s.start(0);
    return c.state;
  }
  const running = () => ctx && ctx.state === 'running';

  function analyse(buffer) {
    const data = buffer.getChannelData(0), sr = buffer.sampleRate, n = Math.floor(FRAME * sr);
    const env = [];
    for (let i = 0; i < data.length; i += n) {
      let sum = 0; const end = Math.min(i + n, data.length);
      for (let j = i; j < end; j++) sum += data[j] * data[j];
      env.push(Math.sqrt(sum / Math.max(1, end - i)));
    }
    const peak = Math.max.apply(null, env.concat([1e-6]));
    // Pauses: runs of frames below 8% of peak, at least 100 ms long, not at the edges.
    const thr = peak * 0.08, gaps = [];
    let start = -1;
    env.forEach((v, i) => {
      if (v < thr) { if (start < 0) start = i; }
      else if (start >= 0) { if ((i - start) * FRAME >= 0.1 && start > 0) gaps.push({ start: start * FRAME, end: i * FRAME, len: (i - start) * FRAME }); start = -1; }
    });
    return { env, peak, gaps };
  }

  async function loadOne(base, id) {
    const exts = format === 'mp3' ? ['mp3', 'ogg'] : ['ogg', 'mp3'];
    let lastErr = null;
    for (const ext of exts) {
      try {
        const res = await fetch(base + SRL_CONFIG.AUDIO_DIR + id + '.' + ext + '?v=' + encodeURIComponent(SRL_CONFIG.VERSION));
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const arr = await res.arrayBuffer();
        const buffer = await new Promise((resolve, reject) => context().decodeAudioData(arr, resolve, reject));
        const a = analyse(buffer);
        let segs = a.gaps.slice().sort((x, y) => y.len - x.len).slice(0, 2).sort((x, y) => x.start - y.start).map((g) => g.end);
        let segSource = 'pauses';
        if (segs.length < 2) { segs = [0.3 * buffer.duration, 0.65 * buffer.duration]; segSource = 'proportional_fallback'; }
        clips[id] = { buffer, env: a.env, peak: a.peak, duration: buffer.duration, segments: [0].concat(segs), segSource, ext };
        return;
      } catch (e) { lastErr = e; }
    }
    errors.push(id + ': ' + (lastErr && lastErr.message));
    // Silent 1.5 s stand-in so the timeline still runs; recorded in audio_load_errors.
    clips[id] = { buffer: null, env: [], peak: 1, duration: 1.5, segments: [0, 0.5, 1.0], missing: true };
  }

  async function preload(base, ids, onProgress) {
    const probe = document.createElement('audio');
    format = probe.canPlayType('audio/mpeg') ? 'mp3' : 'ogg';
    let done = 0;
    const queue = ids.slice();
    const worker = async () => {
      while (queue.length) {
        const id = queue.shift();
        await loadOne(base, id);
        done++; if (onProgress) onProgress(done, ids.length);
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
    return errors.slice();
  }

  /* Play a clip. opts.onAmp(v 0..1) is called every frame; opts.onSegment(i) when segment i starts.
   * Resolves with { duration_ms, played_ms, simulated } when the clip ends. If audio is not running
   * (no gesture / muted autoplay), playback is simulated on a timer so the timeline is identical. */
  function play(id, opts) {
    opts = opts || {};
    const c = clips[id];
    return new Promise((resolve) => {
      if (!c) { resolve({ duration_ms: 0, played_ms: 0, simulated: true, missing: true }); return; }
      const simulated = !c.buffer || !running();
      let src = null, t0, startedAt = U.now();
      if (!simulated) {
        src = ctx.createBufferSource(); src.buffer = c.buffer;
        const gain = ctx.createGain(); gain.gain.value = 1;
        src.connect(gain); gain.connect(ctx.destination);
        t0 = ctx.currentTime; src.start();
      }
      const elapsed = () => (simulated ? (U.now() - startedAt) / 1000 : ctx.currentTime - t0);
      let seg = -1, finished = false;
      const finish = () => {
        if (finished) return; finished = true;
        if (opts.onAmp) opts.onAmp(0);
        resolve({ duration_ms: Math.round(c.duration * 1000), played_ms: Math.round(U.now() - startedAt), simulated: simulated, missing: !!c.missing });
      };
      const tick = () => {
        if (finished) return;
        const t = elapsed();
        while (seg + 1 < c.segments.length && t >= c.segments[seg + 1]) { seg++; if (opts.onSegment) opts.onSegment(seg); }
        if (opts.onAmp) {
          const i = Math.floor(t / FRAME);
          const v = c.env.length ? (c.env[Math.min(i, c.env.length - 1)] || 0) / c.peak : (Math.sin(t * 18) > 0 ? 0.6 : 0.1);
          opts.onAmp(U.clamp((v - 0.06) * 1.6, 0, 1));
        }
        if (t >= c.duration) { finish(); return; }
        U.frame(tick);
      };
      if (src) src.onended = () => setTimeout(finish, 0);
      U.frame(tick);
    });
  }

  const info = (id) => clips[id];
  return { context, unlock, running, preload, play, info, errors: () => errors.slice() };
})();
