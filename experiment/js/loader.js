/* loader.js: loads the experiment's CSS and scripts from a base URL, then starts it.
 * Used by both the Qualtrics question JS and the local index.html, so both run identical code.
 *   window.SRL_LOAD({ base, mode, params, finish, version, onError }) */
(function () {
  const FILES = [
    'config.js', 'lib/jspsych.js',
    'js/util.js', 'js/fields.js', 'js/people.js', 'js/avatar_rules.js', 'js/objects.js', 'js/stimuli.js', 'js/audio.js', 'js/ui.js',
    'js/scene.js', 'js/screens.js', 'js/binding.js', 'js/designer.js', 'js/fillers.js', 'js/tests.js', 'js/data.js', 'js/progress.js', 'js/main.js'
  ];
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.async = false;
      s.onload = resolve; s.onerror = () => reject(new Error('Failed to load ' + src));
      document.head.appendChild(s);
    });
  }
  window.SRL_LOAD = async function (opts) {
    const base = opts.base.endsWith('/') ? opts.base : opts.base + '/';
    const v = opts.version ? '?v=' + encodeURIComponent(opts.version) : '';
    try {
      const css = document.createElement('link');
      css.rel = 'stylesheet'; css.href = base + 'css/experiment.css' + v;
      document.head.appendChild(css);
      for (const f of FILES) await loadScript(base + f + v);
      await window.SRL.main.start(Object.assign({}, opts, { base }));
    } catch (e) {
      console.error(e);
      if (opts.onError) opts.onError(e);
    }
  };
})();
