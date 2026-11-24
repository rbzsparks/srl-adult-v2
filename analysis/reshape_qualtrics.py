"""Reshape a Qualtrics CSV export (wide embedded data) into long format: one row per trial.

Output columns follow EXPERIMENT_SPEC §6: participant-level columns repeated on every row, then
familiarization rows (phase = familiarization) and test rows (phase = test), plus the model coding:
    k = closeness   known scenes: ios - 1 (0-6); unfamiliar scenes: 0
    f = feature     word / face -> 'target'; incid -> 'incidental'
    correct (0/1)

Works with either export option ("Use numeric values" or "Use choice text"), with the 3-row Qualtrics header
(names / question text / ImportId JSON) or a plain 1-row header, and with legacy or NSTE (__js_-prefixed) fields.
Also reassembles full_data_json_1..N and checks it against the wide fields (prints mismatches).
The known and unfamiliar feature vectors (known_avatar / unfamiliar_avatar, "key=value;...") are unpacked into one
column per feature: known_<key> and unfam_<key> (keys from FEATURE_KEYS in experiment/js/people.js).

Both design versions (design_version = unique12 / repeat6; a blank value is read as unique12, the only version
before v2.2):
    familiarization rows: one per trial (12), with serial_position, and for repeat6 presentation (1/2) and lag
    test rows:            one per test trial (36 for unique12, 18 for repeat6); serial_position = the scene set's
                          first showing, serial_position_2 = its second showing (repeat6), lag = their distance

Person check-ins (v2.3): phase = checkin, one row per response (6 per participant): trial_index = check-in 1-3,
serial_position = the familiarization trial it followed, condition = the person asked about (known / unfamiliar),
checkin_qid, checkin_order_in_pair (1 = asked first), checkin_response (option text), rt_ms.
The matching-task trials are only in full_data_json ("match"); their summaries are participant columns.

Usage:
    python analysis/reshape_qualtrics.py qualtrics_export.csv -o long.csv [--include-incomplete] [--include-debug]
"""
import argparse
import csv
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
FIELDS_JS = os.path.join(HERE, '..', 'experiment', 'js', 'fields.js')
PEOPLE_JS = os.path.join(HERE, '..', 'experiment', 'js', 'people.js')


def load_feature_keys():
    import re
    txt = open(PEOPLE_JS, encoding='utf-8').read()
    m = re.search(r"const FEATURE_KEYS = \[(.*?)\];", txt, re.S)
    return re.findall(r"'(\w+)'", m.group(1))


FEATURE_KEYS = load_feature_keys()
FEATURE_COLS = ['known_' + k for k in FEATURE_KEYS] + ['unfam_' + k for k in FEATURE_KEYS]


def unpack_vec(s, prefix):
    out = {}
    for part in (s or '').split(';'):
        if '=' in part:
            k, v = part.split('=', 1)
            out[prefix + k] = v
    return out


def load_fields():
    txt = open(FIELDS_JS, encoding='utf-8').read()
    start = txt.index('{', txt.index('window.SRL_FIELDS'))
    return json.loads(txt[start: txt.rindex('}') + 1])


def fields_for(f, design):
    """Same as SRL.data.fieldsFor in the experiment: unique12 lists with the design's overrides."""
    o = (f.get('designs') or {}).get(design)
    if not o:
        return f
    f = dict(f)
    f['participant'] = f['participant'] + o.get('participant_extra', [])
    for k in ('fam_per_scene', 'scene_set_ids'):
        if k in o:
            f[k] = o[k]
    return f


def read_export(path):
    with open(path, newline='', encoding='utf-8-sig') as fh:
        rows = list(csv.reader(fh))
    header = rows[0]
    body = rows[1:]
    # Qualtrics exports have 2 extra header rows: question text, then {"ImportId": ...}
    if len(body) >= 2 and body[1] and body[1][0].startswith('{"ImportId"'):
        body = body[2:]
    recs = []
    for r in body:
        d = dict(zip(header, r))
        # Strip the NSTE prefix so both engines look the same.
        recs.append({(k[5:] if k.startswith('__js_') else k): v for k, v in d.items()})
    return recs


# Person-binding steps (v2.3; blank for older data or when a step was switched off).
BINDING_COLS = ['recall_enabled', 'revision_enabled', 'matching_enabled', 'checkins_enabled', 'steps_source',
                'recall_ms', 'recall_chars_1', 'recall_chars_2', 'recall_chars_3',
                'likeness_1', 'revision_offered', 'revised', 'likeness_2', 'designer_ms_2', 'confirm_ms', 'jordan_intro_ms',
                'match_keymap', 'match_acc_kk', 'match_acc_uu', 'match_acc_ku', 'match_acc_uk',
                'match_rt_med_kk', 'match_rt_med_uu', 'match_rt_med_ku', 'match_rt_med_uk', 'match_acc_total', 'match_flag',
                'checkin_order', 'represent_rating',
                # control condition (v2.4; blank in the known-person categories)
                'control_name', 'target_avatar', 'copy_intro_ms', 'copy_err_1', 'copy_n_miss_1', 'copy_miss_1', 'copy_err', 'copy_n_miss', 'copy_miss']
LONG_COLS = [
    # participant level
    'prolific_pid', 'study_id', 'session_id', 'response_id', 'design_version', 'design_version_source', 'stranger_set', 'category', 'list', 'test_block_order', 'surprise_test', 'name_label_shown', 'mouseview_on',
    'relationship_type', 'is_kin', 'ios', 'contact_inperson', 'contact_remote', 'contact_max', 'contact_freq', 'duration',
    'name_length', 'name_flagged_title', 'name_suspect',
    'known_avatar', 'unfamiliar_avatar', 'unfam_changes', 'unfam_k', 'unfam_identity_dist', 'unfamiliar_name',
] + BINDING_COLS + [
    'likeness_rating', 'likeness_rt_ms', 'designer_edits', 'designer_resets', 'designer_tabs_visited', 't_designer_ms', 'audio_check_pass',
    'filler2_accuracy', 'filler2_n_attempted', 'filler2_n_timeout', 'filler2_low_engagement', 'fam_fast_advance_count', 'fam_timeout_count',
    'fullscreen_exits', 'tab_switches', 'reload_pre_fam', 'reloaded_post_fam', 'browser', 'screen_w', 'screen_h', 'total_ms',
    'expected_test', 'strategy', 'attention_check_1', 'attention_check_2', 'age', 'gender',
    # trial level
    'phase', 'trial_index', 'serial_position', 'presentation', 'lag', 'serial_position_2', 'scene_set_id', 'condition', 'stranger_id', 'word', 'incidental_type', 'incidental_color',
    'viewing_time_ms', 'timed_out', 'label_audio_ms',
    'test_type', 'target_id', 'foil_ids', 'target_position', 'response_id_choice', 'correct', 'rt_ms',
    'checkin_qid', 'checkin_order_in_pair', 'checkin_response',
    'k', 'f'
] + FEATURE_COLS
PCOLS_FROM_ED = ['design_version', 'design_version_source', 'stranger_set', 'category', 'list', 'test_block_order', 'surprise_test', 'name_label_shown', 'mouseview_on', 'relationship_type', 'is_kin', 'ios',
                 'contact_inperson', 'contact_remote', 'contact_max', 'contact_freq', 'duration', 'name_length', 'name_flagged_title',
                 'name_suspect', 'known_avatar', 'unfamiliar_avatar',
                 'unfam_changes', 'unfam_k', 'unfam_identity_dist', 'unfamiliar_name', 'likeness_rating', 'likeness_rt_ms',
                 'designer_edits', 'designer_resets', 'designer_tabs_visited', 't_designer_ms', 'audio_check_pass', 'filler2_accuracy',
                 'filler2_n_attempted', 'filler2_n_timeout', 'filler2_low_engagement',
                 'fam_fast_advance_count', 'fam_timeout_count', 'fullscreen_exits', 'tab_switches', 'reload_pre_fam',
                 'reloaded_post_fam', 'browser', 'screen_w', 'screen_h', 'total_ms'] + BINDING_COLS
NATIVE = {'prolific_pid': 'PROLIFIC_PID', 'study_id': 'STUDY_ID', 'session_id': 'SESSION_ID', 'response_id': 'ResponseId',
          'expected_test': 'expected_test', 'strategy': 'strategy', 'attention_check_1': 'attention_check_1',
          'attention_check_2': 'attention_check_2', 'age': 'age', 'gender': 'gender'}


def to_int(x):
    try:
        return int(float(x))
    except (TypeError, ValueError):
        return None


def reshape(recs, F0, include_incomplete=False, include_debug=False):
    out, problems = [], []
    for d in recs:
        design = d.get('design_version') or 'unique12'
        F = fields_for(F0, design)
        if not d.get('category'):
            continue  # screened out / never reached the experiment
        if d.get('debug') == '1' and not include_debug:
            continue
        if d.get('reloaded_post_fam') == '1' and not include_incomplete:
            continue
        base = {c: d.get(c, '') for c in PCOLS_FROM_ED}
        base['design_version'] = design
        base.update(unpack_vec(d.get('known_avatar'), 'known_'))
        base.update(unpack_vec(d.get('unfamiliar_avatar'), 'unfam_'))
        for c, src in NATIVE.items():
            base[c] = d.get(src, '')
        ios = to_int(d.get('ios'))
        fam, fam2 = {}, {}
        for i in range(1, F['fam_count'] + 1):
            p = f"{F['fam_prefix']}{i:02d}_"
            if not d.get(p + 'scene_set_id'):
                continue
            pres = d.get(p + 'presentation', '') or ('1' if design == 'unique12' else '')
            row = dict(base, phase='familiarization', trial_index=i, serial_position=d.get(p + 'serial_position') or i,
                       presentation=pres, lag=d.get(p + 'lag', ''), scene_set_id=d[p + 'scene_set_id'], condition=d[p + 'condition'],
                       stranger_id=d[p + 'stranger_id'], word=d[p + 'word'], incidental_type=d[p + 'incidental_type'],
                       incidental_color=d[p + 'incidental_color'], viewing_time_ms=d[p + 'view_ms'], timed_out=d[p + 'timed_out'],
                       label_audio_ms=d[p + 'label_audio_ms'])
            if str(pres) != '2':
                fam[row['scene_set_id']] = row  # first showing describes the scene set
            else:
                fam2[row['scene_set_id']] = row
            out.append(row)
        # Test rows: ordered by block, then scene set (the JSON backup has the exact presentation order).
        order = (d.get('test_block_order') or 'word>face>incid').split('>')
        tests, n = [], 0
        for t in order:
            for sid in F['scene_set_ids']:
                p = f'test_{t}_{sid}_'
                if d.get(p + 'correct', '') == '':
                    continue
                n += 1
                fi = fam.get(sid, {})
                cond = fi.get('condition', '')
                k = (ios - 1) if (cond == 'known' and ios is not None) else (0 if cond == 'unfamiliar' else '')
                tests.append(dict(base, phase='test', trial_index=n, serial_position=fi.get('serial_position', ''),
                                  serial_position_2=fam2.get(sid, {}).get('serial_position', ''), lag=fam2.get(sid, {}).get('lag', ''),
                                  scene_set_id=sid, condition=cond, stranger_id=fi.get('stranger_id', ''),
                                  word=fi.get('word', ''), incidental_type=fi.get('incidental_type', ''), incidental_color=fi.get('incidental_color', ''),
                                  test_type=t, target_id={'word': '', 'face': fi.get('stranger_id', ''), 'incid': fi.get('incidental_color', '')}[t],
                                  foil_ids=d[p + 'foils'], target_position=d[p + 'position'], response_id_choice=d[p + 'choice'],
                                  correct=d[p + 'correct'], rt_ms=d[p + 'rt_ms'], k=k, f='incidental' if t == 'incid' else 'target'))
        out.extend(tests)
        # Person check-ins (v2.3): one row per response; condition = the person asked about.
        for kk in range(1, 4):
            p = f'checkin_{kk}_'
            if not d.get(p + 'qid'):
                continue
            first = d.get(p + 'first', '')
            for person, short in (('known', 'known'), ('unfamiliar', 'unf')):
                out.append(dict(base, phase='checkin', trial_index=kk, serial_position=d.get(p + 'after_trial', ''), condition=person,
                                checkin_qid=d[p + 'qid'], checkin_order_in_pair=1 if first == person else 2,
                                checkin_response=d.get(p + short + '_resp', ''), rt_ms=d.get(p + short + '_rt_ms', '')))
        # Cross-check against the JSON backup; also fills the word-test target object id.
        js = ''.join(d.get(f"{F['json_prefix']}{i}", '') for i in range(1, F['json_chunks'] + 1))
        if js:
            try:
                j = json.loads(js)
                byk = {(t['test_type'], t['scene_set_id']): t for t in j.get('test', [])}
                for r in tests:
                    jt = byk.get((r['test_type'], r['scene_set_id']))
                    if jt is None or str(jt['correct']) != str(r['correct']) or str(jt['rt_ms']) != str(r['rt_ms']):
                        problems.append(f"{base['prolific_pid']}: mismatch {r['test_type']} {r['scene_set_id']}")
                    elif r['test_type'] == 'word':
                        r['target_id'] = jt['target_id']
            except json.JSONDecodeError:
                problems.append(f"{base['prolific_pid']}: full_data_json could not be parsed (truncated={d.get('full_data_json_truncated')})")
    return out, problems


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('export')
    ap.add_argument('-o', '--out', default='long_format.csv')
    ap.add_argument('--include-incomplete', action='store_true', help='keep participants with reloaded_post_fam = 1')
    ap.add_argument('--include-debug', action='store_true', help='keep debug=1 runs')
    a = ap.parse_args()
    F = load_fields()
    recs = read_export(a.export)
    out, problems = reshape(recs, F, a.include_incomplete, a.include_debug)
    with open(a.out, 'w', newline='', encoding='utf-8') as fh:
        w = csv.DictWriter(fh, fieldnames=LONG_COLS, extrasaction='ignore')
        w.writeheader()
        for r in out:
            w.writerow(r)
    n_p = len({(r['prolific_pid'], r['response_id']) for r in out})
    print(f'{len(recs)} responses read -> {n_p} participants, {len(out)} rows written to {a.out}')
    for p in problems:
        print('CHECK:', p, file=sys.stderr)


if __name__ == '__main__':
    main()
