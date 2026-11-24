/* ui.js: full-window overlay with a fixed 1000×625 logical canvas that scales to fit the window.
 * All screens render into the canvas, so layout and AOI coordinates are identical on every screen size. */
SRL.ui = (function () {
  const U = SRL.util;
  let viewport, canvas, debugEl, bannerEl, scale = 1;

  function mount() {
    viewport = U.h('<div class="srl-viewport"></div>');
    canvas = U.h('<div class="srl-canvas"></div>');
    debugEl = U.h('<div class="srl-debug" hidden></div>');
    bannerEl = U.h('<div class="srl-banner" hidden><span>Please return to full screen.</span> <button type="button">Full screen</button></div>');
    bannerEl.querySelector('button').onclick = () => requestFullscreen();
    viewport.appendChild(canvas); viewport.appendChild(debugEl); viewport.appendChild(bannerEl);
    document.body.appendChild(viewport);
    document.documentElement.classList.add('srl-active');
    window.addEventListener('resize', fit);
    fit();
    return canvas;
  }
  function unmount() {
    window.removeEventListener('resize', fit);
    if (viewport) viewport.remove();
    document.documentElement.classList.remove('srl-active');
  }
  function fit() {
    const W = SRL_CONFIG.STAGE_W, H = SRL_CONFIG.STAGE_H;
    scale = Math.min(window.innerWidth / W, window.innerHeight / H);
    canvas.style.transform = `translate(-50%, -50%) scale(${scale})`;
  }
  const getScale = () => scale;

  function requestFullscreen() {
    const el = document.documentElement;
    const fn = el.requestFullscreen || el.webkitRequestFullscreen;
    if (fn) { try { const p = fn.call(el); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignore */ } }
  }
  function exitFullscreen() {
    const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    if (!fsEl) return;
    const fn = document.exitFullscreen || document.webkitExitFullscreen;
    if (fn) { try { const p = fn.call(document); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignore */ } }
  }
  const isFullscreen = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  function showBanner(show) { if (bannerEl) bannerEl.hidden = !show; }

  function debug(text) {
    if (!debugEl) return;
    debugEl.hidden = !text; debugEl.textContent = text || '';
  }

  // Render a standard page into the given element. Returns the page root.
  function page(el, html, opts) {
    opts = opts || {};
    el.innerHTML = `<div class="srl-page ${opts.cls || ''}">${html}</div>`;
    return el.firstElementChild;
  }

  // Resolves when the button is clicked (or Enter pressed, if enter=true and button enabled).
  function onClick(btn) {
    return new Promise((resolve) => {
      const h = (e) => { if (btn.disabled) return; btn.removeEventListener('click', h); resolve(e); };
      btn.addEventListener('click', h);
    });
  }
  function waitKey(codes, opts) {
    opts = opts || {};
    return new Promise((resolve) => {
      let timer = null;
      const h = (e) => {
        if (codes.indexOf(e.code) < 0 && codes.indexOf(e.key) < 0) return;
        e.preventDefault();
        cleanup(); resolve({ key: e.code, time: U.now(), timedOut: false });
      };
      const cleanup = () => { window.removeEventListener('keydown', h, true); if (timer) clearTimeout(timer); };
      window.addEventListener('keydown', h, true);
      if (opts.timeout) timer = setTimeout(() => { cleanup(); resolve({ key: null, time: U.now(), timedOut: true }); }, opts.timeout);
      if (opts.cancelRef) opts.cancelRef.cancel = () => { cleanup(); resolve({ key: 'auto', time: U.now(), timedOut: false, auto: true }); };
    });
  }

  return { mount, unmount, fit, getScale, requestFullscreen, exitFullscreen, isFullscreen, showBanner, debug, page, onClick, waitKey };
})();
