Qualtrics.SurveyEngine.addOnload(function () {
  /* Loads the externally hosted experiment (GitHub Pages). Edit BASE_URL / VERSION here if they change. */
  var q = this;
  q.hideNextButton();
  if (q.hidePreviousButton) { q.hidePreviousButton(); }
  var BASE_URL = 'https://rbzsparks.github.io/srl-adult-v2/experiment/';
  var VERSION = '3.1.0';
  var params = {
    PROLIFIC_PID: "${e://Field/PROLIFIC_PID}", STUDY_ID: "${e://Field/STUDY_ID}", SESSION_ID: "${e://Field/SESSION_ID}",
    condition: "${e://Field/condition}", stranger_set: "${e://Field/stranger_set}", test_order: "${e://Field/test_order}", control_target: "${e://Field/control_target}", debug: "${e://Field/debug}", name_label: "${e://Field/name_label}", binding: "${e://Field/binding}", checkins: "${e://Field/checkins}", ResponseID: "${e://Field/ResponseID}"
  };
  function fail(e) {
    var c = q.getQuestionContainer ? q.getQuestionContainer() : document.body;
    c.innerHTML = '<p style="font-size:18px;line-height:1.5">Sorry, the study could not load. Please check your internet connection and reload this page. ' +
      'If this keeps happening, please contact the researchers through Prolific.</p>';
  }
  var s = document.createElement('script');
  s.src = BASE_URL + 'js/loader.js?v=' + VERSION;
  s.onload = function () {
    window.SRL_LOAD({ base: BASE_URL, mode: 'qualtrics', params: params, version: VERSION,
      finish: function () { q.clickNextButton(); }, onError: fail });
  };
  s.onerror = fail;
  document.head.appendChild(s);
});
