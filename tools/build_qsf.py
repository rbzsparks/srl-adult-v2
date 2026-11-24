"""Build qualtrics/survey.qsf (importable Qualtrics survey) from experiment/js/fields.js and config.js (v3.0).

Survey flow:
  1. Embedded Data: PROLIFIC_PID, STUDY_ID, SESSION_ID, debug (from URL) + every field the experiment writes
  2. Device check block (JS) -> Branch: device_ok = 0 -> message + End of Survey (redirect SCREENOUT_CODE)
  3. Consent block -> Branch: declined -> message + End of Survey (redirect NOCONSENT_CODE; Prolific path "Request a return")
  4. Nested randomizers, each evenly presented (24 leaves):
       condition (known / control)
         -> stranger_set (X / Y): a separate randomizer inside each condition
           -> test_order (all 6 orders of word / identity / colour): a separate randomizer inside each condition x set
     Each inner randomizer keeps its own counts, so set is balanced within condition and order within condition x set.
     The control group also has a 6-way randomizer for control_target (the fixed avatar to copy), evenly presented.
  5. Experiment block (one question whose JS loads the experiment from BASE_URL; Next button hidden)
  6. Post-test questions, demographics, debrief
  7. End of Survey: redirect to Prolific completion URL

Usage:
  python tools/build_qsf.py [--base-url https://rbzsparks.github.io/srl-adult-v2/experiment/] [--engine legacy|nste]
                            [--completion-code CODE] [--screenout-code CODE] [--noconsent-code CODE] [--out PATH]
  With real Prolific codes, pass --out to a folder outside the repo (the repo is public).
"""
import argparse
import json
import os
import random
import re
import string

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
EXP = os.path.join(ROOT, 'experiment')


def load_fields():
    txt = open(os.path.join(EXP, 'js', 'fields.js'), encoding='utf-8').read()
    start = txt.index('{', txt.index('window.SRL_FIELDS'))
    return json.loads(txt[start: txt.rindex('}') + 1])


def all_field_names(f):
    out = list(f['participant'])
    for i in range(1, f['fam_count'] + 1):
        out += [f"{f['fam_prefix']}{i:02d}_{k}" for k in f['fam_per_scene']]
    for t in f['test_types']:
        for sid in f['scene_set_ids']:
            out += [f'test_{t}_{sid}_{k}' for k in f['test_per_trial']]
    out += [f"{f['json_prefix']}{i}" for i in range(1, f['json_chunks'] + 1)]
    return out + f['json_meta']


def config_value(name):
    txt = open(os.path.join(EXP, 'config.js'), encoding='utf-8').read()
    m = re.search(name + r":\s*'([^']*)'", txt) or re.search(name + r':\s*(\d+)', txt)
    return m.group(1) if m else None


def rid(prefix, n=15):
    return prefix + ''.join(random.choice(string.ascii_letters + string.digits) for _ in range(n))


EXPERIMENT_JS = r"""Qualtrics.SurveyEngine.addOnload(function () {
  /* Loads the externally hosted experiment (GitHub Pages). Edit BASE_URL / VERSION here if they change. */
  var q = this;
  q.hideNextButton();
  if (q.hidePreviousButton) { q.hidePreviousButton(); }
  var BASE_URL = '__BASE_URL__';
  var VERSION = '__VERSION__';
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
"""

DEVICE_JS = r"""Qualtrics.SurveyEngine.addOnload(function () {
  /* Device check before consent: desktop/laptop with a screen of at least __W__ x __H__ (either orientation).
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
  var bigEnough = Math.max(pw, ph) >= __W__ && Math.min(pw, ph) >= __H__;
  var reason = mobileUA || iPadOS ? 'mobile' : (!bigEnough ? 'small_screen' : '');
  var set = function (k, v) { __SET__(k, String(v)); };
  set('device_ok', reason ? 0 : 1);
  set('device_reason', reason);
  set('device_screen', pw + 'x' + ph + ' px (' + sw + 'x' + sh + ' at scale ' + Math.round(dpr * 100) / 100 + ')');
  set('device_window', window.innerWidth + 'x' + window.innerHeight);
  set('device_pointer', pointer);
  setTimeout(function () { q.clickNextButton(); }, 400);
});
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--base-url', default='https://rbzsparks.github.io/srl-adult-v2/experiment/')
    ap.add_argument('--engine', choices=['legacy', 'nste'], default='legacy')
    ap.add_argument('--completion-code', default=config_value('COMPLETION_CODE') or 'COMPLETION_CODE')
    ap.add_argument('--screenout-code', default=config_value('SCREENOUT_CODE') or 'SCREENOUT_CODE')
    ap.add_argument('--noconsent-code', default=config_value('NOCONSENT_CODE') or 'NOCONSENT_CODE')
    ap.add_argument('--out', default='')
    a = ap.parse_args()
    a.out = a.out or os.path.join(ROOT, 'qualtrics', 'survey.qsf')
    random.seed(20261113)
    base = a.base_url if a.base_url.endswith('/') else a.base_url + '/'
    version = config_value('VERSION') or '1.0.0'
    est = config_value('ESTIMATED_MINUTES') or '17'
    W, H = config_value('MIN_SCREEN_W') or '1024', config_value('MIN_SCREEN_H') or '650'
    pre = '__js_' if a.engine == 'nste' else ''
    setter = 'Qualtrics.SurveyEngine.setJSEmbeddedData' if a.engine == 'nste' else 'Qualtrics.SurveyEngine.setEmbeddedData'

    SID = 'SV_' + rid('', 15)
    elements = []
    questions = []
    qn = [0]

    def q(payload, tag):
        qn[0] += 1
        qid = f'QID{qn[0]}'
        base_p = {'QuestionText': '', 'DataExportTag': tag, 'QuestionType': 'DB', 'Selector': 'TB',
                  'Configuration': {'QuestionDescriptionOption': 'UseText'}, 'QuestionDescription': tag,
                  'ChoiceOrder': [], 'Validation': {'Settings': {'Type': 'None'}}, 'GradingData': [], 'Language': [],
                  'NextChoiceId': 4, 'NextAnswerId': 1, 'QuestionID': qid, 'DataVisibility': {'Private': False, 'Hidden': False}}
        base_p.update(payload)
        questions.append({'SurveyID': SID, 'Element': 'SQ', 'PrimaryAttribute': qid, 'SecondaryAttribute': tag,
                          'TertiaryAttribute': None, 'Payload': base_p})
        return qid

    def mc(text, tag, choices, horizontal=False, force=True, text_entry=None):
        ch = {str(i + 1): {'Display': c} for i, c in enumerate(choices)}
        if text_entry:
            ch[str(text_entry)]['TextEntry'] = 'true'
        return q({'QuestionText': text, 'QuestionType': 'MC', 'Selector': 'SAHR' if horizontal else 'SAVR', 'SubSelector': 'TX',
                  'Choices': ch, 'ChoiceOrder': [str(i + 1) for i in range(len(choices))], 'NextChoiceId': len(choices) + 1,
                  'Validation': {'Settings': {'ForceResponse': 'ON' if force else 'OFF', 'ForceResponseType': 'ON', 'Type': 'None'}}}, tag)

    likert = ['Strongly disagree', 'Somewhat disagree', 'Neither agree nor disagree', 'Somewhat agree', 'Strongly agree']

    # ---- Blocks ----
    blocks = []

    def block(desc, qids, btype='Standard'):
        bid = rid('BL_')
        blocks.append({'Type': btype, 'Description': desc, 'ID': bid,
                       'BlockElements': [{'Type': 'Question', 'QuestionID': x} for x in qids], 'Options': {'BlockLocking': 'false', 'RandomizeQuestions': 'false', 'BlockVisibility': 'Expanded'}})
        return bid

    q_dev = q({'QuestionText': 'Checking your device…', 'QuestionJS': DEVICE_JS.replace('__W__', W).replace('__H__', H).replace('__SET__', setter)}, 'device_check')
    b_dev = block('Device check', [q_dev], 'Default')
    q_devmsg = q({'QuestionText': f'<p>Sorry, this study needs a <b>desktop or laptop computer</b> with a screen of at least {W} × {H} pixels.</p>'
                                  '<p>Click the arrow to return to Prolific.</p>'
                                  f'<p style="font-size:12px;color:#777">Technical details: ${{e://Field/{pre}device_reason}} · screen ${{e://Field/{pre}device_screen}}</p>'}, 'device_screenout_msg')
    b_devmsg = block('Device screen-out message', [q_devmsg])

    q_cons_text = q({'QuestionText': '<p><b>[PLACEHOLDER: IRB-APPROVED CONSENT TEXT]</b></p>'
                                     f'<p>This study takes about <b>{est} minutes</b>. It requires <b>sound</b> (headphones or speakers) and a desktop or laptop computer.</p>'
                                     '<p>You\'ll make a simple cartoon avatar. Some participants design it to look like someone they know, first '
                                     'typing that person\'s first name and some brief notes about them, and choose a voice for it; others copy an '
                                     'avatar we show them, of a person we name, with brief notes about how they picture that person. Any name and '
                                     'notes you type are not saved.</p>'
                                     '<p>[Purpose, procedures, risks, benefits, compensation, confidentiality, voluntary participation, contact information.]</p>'}, 'consent_text')
    q_cons = mc('Do you agree to take part in this study?', 'consent', ['I agree to take part', 'I do not agree'])
    b_cons = block('Consent', [q_cons_text, q_cons])
    # Prolific requires non-consenting participants to be redirected to a completion path ("No consent" -> Request a return).
    q_decl = q({'QuestionText': '<p>You chose not to take part. Thank you for your time.</p>'
                                '<p>Click the arrow to go back to Prolific, which will ask you to <b>return</b> this study.</p>'}, 'declined_msg')
    b_decl = block('Declined consent', [q_decl])

    q_exp = q({'QuestionText': '<div id="srl-loading" style="font-size:18px">Loading the study… This can take a few seconds.</div>',
               'QuestionJS': EXPERIMENT_JS.replace('__BASE_URL__', base).replace('__VERSION__', version)}, 'experiment')
    b_exp = block('Experiment (JS)', [q_exp])

    q_exp_test = mc('Before the memory questions, did you expect to be tested on what you saw?', 'expected_test', ['Yes', 'No', 'Not sure'])
    q_strategy = q({'QuestionText': 'Did you use any strategy to remember things? (optional)', 'QuestionType': 'TE', 'Selector': 'ESTB',
                    'Configuration': {'QuestionDescriptionOption': 'UseText', 'InputWidth': 600, 'InputHeight': 90}, 'DefaultChoices': False}, 'strategy')
    q_ex1 = mc('The scenes were easy to follow.', 'exp_easy', likert, horizontal=True)
    q_ac1 = mc('To show that you are reading carefully, please select "Strongly disagree" for this item.', 'attention_check_1', likert, horizontal=True)
    q_ex2 = mc('The sound in the scenes was clear.', 'exp_sound', likert, horizontal=True)
    q_ac2 = mc('Please select "Somewhat agree" for this item.', 'attention_check_2', likert, horizontal=True)
    q_tech = q({'QuestionText': 'Did you have any technical problems (for example with sound, video, or full screen)? (optional)', 'QuestionType': 'TE', 'Selector': 'ESTB',
                'Configuration': {'QuestionDescriptionOption': 'UseText', 'InputWidth': 600, 'InputHeight': 70}, 'DefaultChoices': False}, 'tech_problems')
    b_post = block('Post-test questions', [q_exp_test, q_strategy, q_ex1, q_ac1, q_ex2, q_ac2, q_tech])

    q_age = q({'QuestionText': 'What is your age (in years)?', 'QuestionType': 'TE', 'Selector': 'SL',
               'Configuration': {'QuestionDescriptionOption': 'UseText', 'InputWidth': 120}, 'DefaultChoices': False,
               'Validation': {'Settings': {'ForceResponse': 'ON', 'ForceResponseType': 'ON', 'Type': 'ContentType', 'ContentType': 'ValidNumber',
                                           'ValidDateType': 'DateWithFormat', 'ValidPhoneType': 'ValidUSPhone', 'ValidZipType': 'ValidUSZip',
                                           'ValidNumber': {'Min': '18', 'Max': '110', 'NumDecimals': '0'}}}}, 'age')
    q_gender = mc('What is your gender?', 'gender', ['Woman', 'Man', 'Non-binary', 'Prefer to self-describe:', 'Prefer not to say'], text_entry=4)
    b_demo = block('Demographics [confirm list with IRB]', [q_age, q_gender])
    q_debrief = q({'QuestionText': '<p><b>[PLACEHOLDER: IRB-APPROVED DEBRIEF TEXT]</b></p>'
                                   '<p>[Explain the purpose: whether watching someone you know (compared with a person you imagined) changes what '
                                   'people remember about the strangers they meet: their names, the words taught to them, and background details. '
                                   'Explain the surprise memory test. Contact information.]</p>'
                                   '<p>Click the arrow to finish and return to Prolific.</p>'}, 'debrief')
    b_debrief = block('Debrief', [q_debrief])
    block('Trash / Unused Questions', [], 'Trash')

    # ---- Flow ----
    fl = [1]

    def fid():
        fl[0] += 1
        return f'FL_{fl[0]}'

    def ed(fields, values=None):
        values = values or {}
        return {'Type': 'EmbeddedData', 'FlowID': fid(), 'EmbeddedData': [
            ({'Description': k, 'Type': 'Custom', 'Field': k, 'VariableType': 'String', 'DataVisibility': [], 'AnalyzeText': False, 'Value': values[k]}
             if k in values else
             {'Description': k, 'Type': 'Recipient', 'Field': k, 'VariableType': 'String', 'DataVisibility': [], 'AnalyzeText': False})
            for k in fields]}

    def blk(b):
        return {'Type': 'Block', 'ID': b, 'FlowID': fid(), 'Autofill': []}

    def end(url=None):
        e = {'Type': 'EndSurvey', 'FlowID': fid()}
        if url:
            e.update({'EndingType': 'Advanced', 'Options': {'Advanced': 'true', 'SurveyTermination': 'Redirect', 'EOSRedirectURL': url}})
        return e

    prolific = 'https://app.prolific.com/submissions/complete?cc='
    f = load_fields()
    exp_fields = [pre + n for n in all_field_names(f)]
    device_fields = [pre + n for n in ['device_ok', 'device_reason', 'device_screen', 'device_window', 'device_pointer']]
    # binding / checkins: optional per-participant switches (blank = config); set them in a pilot copy of the survey.
    declared = (['PROLIFIC_PID', 'STUDY_ID', 'SESSION_ID', 'debug', 'name_label', 'binding', 'checkins', 'condition', 'stranger_set', 'test_order', 'control_target']
                + device_fields + exp_fields)
    # condition / stranger_set / test_order are written by the randomizers; the experiment writes them back.
    declared = list(dict.fromkeys(declared))

    branch_dev = {'Type': 'Branch', 'FlowID': fid(), 'Description': 'New Branch',
                  'BranchLogic': {'0': {'0': {'LogicType': 'EmbeddedField', 'LeftOperand': pre + 'device_ok', 'Operator': 'EqualTo', 'RightOperand': '0',
                                              '_HiddenExpression': False, 'Type': 'Expression',
                                              'Description': f'<span class="ConjDesc">If</span> <span class="LeftOpDesc">{pre}device_ok</span> <span class="OpDesc">Is Equal to</span> <span class="RightOpDesc"> 0 </span>'},
                                        'Type': 'If'}, 'Type': 'BooleanExpression'},
                  'Flow': [blk(b_devmsg), end(prolific + a.screenout_code)]}
    branch_cons = {'Type': 'Branch', 'FlowID': fid(), 'Description': 'New Branch',
                   'BranchLogic': {'0': {'0': {'LogicType': 'Question', 'QuestionID': q_cons, 'QuestionIsInLoop': 'no',
                                               'ChoiceLocator': f'q://{q_cons}/SelectableChoice/2', 'Operator': 'Selected',
                                               'QuestionIDFromLocator': q_cons, 'LeftOperand': f'q://{q_cons}/SelectableChoice/2', 'Type': 'Expression',
                                               'Description': '<span class="ConjDesc">If</span> <span class="QuestionDesc">consent</span> <span class="LeftOpDesc">I do not agree</span> <span class="OpDesc">Is Selected</span> '},
                                         'Type': 'If'}, 'Type': 'BooleanExpression'},
                   'Flow': [blk(b_decl), end(prolific + a.noconsent_code)]}
    def group(desc, flow):
        return {'Type': 'Group', 'FlowID': fid(), 'Description': desc, 'Flow': flow}

    def randomizer(children):
        return {'Type': 'BlockRandomizer', 'FlowID': fid(), 'SubSet': '1', 'EvenPresentation': True, 'Flow': children}

    orders = ['word>identity>colour', 'word>colour>identity', 'identity>word>colour',
              'identity>colour>word', 'colour>word>identity', 'colour>identity>word']
    leaves = 0
    cond_children = []
    for cond in ['known', 'control']:
        set_children = []
        for ss in ['X', 'Y']:
            order_children = [ed(['test_order'], {'test_order': o}) for o in orders]
            leaves += len(order_children)
            set_children.append(group(f'{cond} / set {ss}', [ed(['stranger_set'], {'stranger_set': ss}), randomizer(order_children)]))
        flow = [ed(['condition'], {'condition': cond}), randomizer(set_children)]
        if cond == 'control':
            # The 6 fixed copy targets, balanced across control participants (not crossed with set x order).
            flow.append(randomizer([ed(['control_target'], {'control_target': str(k)}) for k in range(1, 7)]))
        cond_children.append(group(f'condition {cond}', flow))
    assign = randomizer(cond_children)

    flow = [ed(declared), blk(b_dev), branch_dev, blk(b_cons), branch_cons, assign, blk(b_exp), blk(b_post), blk(b_demo), blk(b_debrief),
            end(prolific + a.completion_code)]
    flow_el = {'SurveyID': SID, 'Element': 'FL', 'PrimaryAttribute': 'Survey Flow', 'SecondaryAttribute': None, 'TertiaryAttribute': None,
               'Payload': {'Type': 'Root', 'FlowID': 'FL_1', 'Flow': flow, 'Properties': {'Count': fl[0], 'RemovedFieldsets': []}}}

    options = {'SurveyID': SID, 'Element': 'SO', 'PrimaryAttribute': 'Survey Options', 'SecondaryAttribute': None, 'TertiaryAttribute': None,
               'Payload': {'BackButton': 'false', 'SaveAndContinue': 'true', 'SurveyProtection': 'PublicSurvey', 'BallotBoxStuffingPrevention': 'false',
                           'NoIndex': 'Yes', 'SecureResponseFiles': 'true', 'SurveyExpiration': 'None', 'SurveyTermination': 'Redirect',
                           'EOSRedirectURL': prolific + a.completion_code, 'Header': '', 'Footer': '', 'ProgressBarDisplay': 'None',
                           'PartialData': '+1 week', 'ValidationMessage': '', 'PreviousButton': '', 'NextButton': ' → ',
                           'SurveyTitle': 'Social relevance study', 'SkinLibrary': '', 'SkinType': 'templated', 'Skin': '',
                           'NewScoring': 1, 'CustomStyles': [], 'QuestionsPerPage': '', 'PageTransition': 'None',
                           'AvailableLanguages': {'EN': []}, 'ProtectSelectionIds': True}}
    blocks_el = {'SurveyID': SID, 'Element': 'BL', 'PrimaryAttribute': 'Survey Blocks', 'SecondaryAttribute': None, 'TertiaryAttribute': None, 'Payload': blocks}
    rs_el = {'SurveyID': SID, 'Element': 'RS', 'PrimaryAttribute': rid('RS_'), 'SecondaryAttribute': 'Default Response Set', 'TertiaryAttribute': None, 'Payload': None}
    qc_el = {'SurveyID': SID, 'Element': 'QC', 'PrimaryAttribute': 'Survey Question Count', 'SecondaryAttribute': str(len(questions)), 'TertiaryAttribute': None, 'Payload': None}

    qsf = {'SurveyEntry': {'SurveyID': SID, 'SurveyName': 'Social relevance study v2 (Prolific)', 'SurveyDescription': None, 'SurveyOwnerID': 'UR_placeholder',
                           'SurveyBrandID': 'placeholder', 'DivisionID': None, 'SurveyLanguage': 'EN', 'SurveyActiveResponseSet': rs_el['PrimaryAttribute'],
                           'SurveyStatus': 'Inactive', 'SurveyStartDate': '0000-00-00 00:00:00', 'SurveyExpirationDate': '0000-00-00 00:00:00',
                           'SurveyCreationDate': '2026-11-24 00:00:00', 'CreatorID': 'UR_placeholder', 'LastModified': '2026-11-24 00:00:00',
                           'LastAccessed': '0000-00-00 00:00:00', 'LastActivated': '0000-00-00 00:00:00', 'Deleted': None},
           'SurveyElements': [blocks_el, flow_el, options, rs_el, qc_el] + questions}
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    with open(a.out, 'w', encoding='utf-8') as fh:
        json.dump(qsf, fh, ensure_ascii=False, indent=1)
    # Also write the two JS snippets as plain files (for pasting manually if the import has problems).
    jsdir = os.path.dirname(a.out)
    open(os.path.join(jsdir, 'experiment_question.js'), 'w', encoding='utf-8').write(EXPERIMENT_JS.replace('__BASE_URL__', base).replace('__VERSION__', version))
    open(os.path.join(jsdir, 'device_check_question.js'), 'w', encoding='utf-8').write(DEVICE_JS.replace('__W__', W).replace('__H__', H).replace('__SET__', setter))
    with open(os.path.join(jsdir, 'embedded_data_fields.txt'), 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(declared) + '\n')
    print(f'wrote {a.out}: {len(questions)} questions, {len(blocks)} blocks, {leaves} randomizer leaves (2 x 2 x 6), '
          f'{len(declared)} embedded-data fields, engine={a.engine}')


if __name__ == '__main__':
    main()
