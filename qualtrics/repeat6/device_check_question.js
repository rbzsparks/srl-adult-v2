Qualtrics.SurveyEngine.addOnload(function () {
  /* Device check before consent: desktop/laptop with a screen of at least 1024 x 650 (either orientation).
   * Screen size is measured in physical pixels (CSS pixels x devicePixelRatio), so display scaling (e.g. Windows at
   * 125-175%) or browser zoom does not make an ordinary laptop screen look too small. */
  var q = this;
  q.hideNextButton();
  var ua = navigator.userAgent || '';
  var mobileUA = /Mobi|Android|iPhone|iPad|iPod|Tablet|Kindle|Silk|PlayBook|BlackBerry|Opera Mini/i.test(ua);
  var iPadOS = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  // Pointer type is recorded but does not screen anyone out: browsers (and Qualtrics' preview) report it unreliably,
  // e.g. a MacBook trackpad reported as "no fine pointer". Phones and tablets are caught by the user agent above.
  var mm = function (m) { return window.matchMedia ? window.matchMedia(m).matches : null; };
  var pointer = 'fine=' + mm('(any-pointer: fine)') + ' hover=' + mm('(any-hover: hover)') + ' touch=' + (navigator.maxTouchPoints || 0);
  var sw = screen.width, sh = screen.height, dpr = window.devicePixelRatio || 1;
  var pw = Math.round(sw * dpr), ph = Math.round(sh * dpr);
  var bigEnough = Math.max(pw, ph) >= 1024 && Math.min(pw, ph) >= 650;
  var reason = mobileUA || iPadOS ? 'mobile' : (!bigEnough ? 'small_screen' : '');
  var set = function (k, v) { Qualtrics.SurveyEngine.setEmbeddedData(k, String(v)); };
  set('device_ok', reason ? 0 : 1);
  set('device_reason', reason);
  set('device_screen', pw + 'x' + ph + ' px (' + sw + 'x' + sh + ' at scale ' + Math.round(dpr * 100) / 100 + ')');
  set('device_window', window.innerWidth + 'x' + window.innerHeight);
  set('device_pointer', pointer);
  setTimeout(function () { q.clickNextButton(); }, 400);
});
