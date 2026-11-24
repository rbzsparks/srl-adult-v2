"""Reshape a Qualtrics CSV export (v3.0 experiment) into the analysis files.

Writes three files into the output folder (keep it out of the repo: data/ is gitignored):
  participants.csv  one row per participant who reached the experiment: subject (S001, ...), every experiment field
                    from fields.js, the Qualtrics post-test answers, and the inputs to the exclusion rules
                    (attention checks as pass/fail, parity_flag, match_acc_total / match_no_response, fam_timeout_count,
                    audio_check_pass, reloaded_post_fam). external_aid is left blank: code it from `strategy`.
  test_trials.csv   one row per test trial (18 per participant), in presentation order, from the full_data_json backup:
                    subject, condition, stranger_set, test, test_position (1-3, the block), trial_in_block, scene_set,
                    serial_position(_2), target, choice, target_position, correct, rt_ms, stranger_name (identity), ...
                    Checked against the wide fields; mismatches are printed.
  id_key.csv        subject -> PROLIFIC_PID, ResponseId (for payment queries; keep private)

Works with either export option ("Use numeric values" or "Use choice text"), with the 3-row Qualtrics header or a plain
1-row header, and with legacy or NSTE (__js_-prefixed) fields. Debug runs (debug = 1) are skipped unless --include-debug.

Usage:
    python analysis/reshape_qualtrics.py qualtrics_export.csv -o data/pilot2 [--include-debug]
"""
import argparse
import csv
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
FIELDS_JS = os.path.join(HERE, '..', 'experiment', 'js', 'fields.js')

QUALTRICS_COLS = ['expected_test', 'strategy', 'exp_easy', 'exp_sound', 'attention_check_1', 'attention_check_2', 'tech_problems', 'age', 'gender',
                  'gender_4_TEXT', 'Duration (in seconds)', 'Finished', 'device_ok', 'device_reason']
# Attention checks: item 1 asks for "Strongly disagree" (choice 1), item 2 for "Somewhat agree" (choice 4).
AC_PASS = {'attention_check_1': ('1', 'Strongly disagree'), 'attention_check_2': ('4', 'Somewhat agree')}
TRIAL_COLS = ['subject', 'condition', 'stranger_set', 'test_order', 'test', 'test_position', 'trial_in_block', 'scene_set', 'serial_position',
              'serial_position_2', 'target', 'stranger_id', 'stranger_name', 'word', 'incidental_type', 'choice', 'foils', 'option_order',
              'target_position', 'response_position', 'correct', 'rt_ms', 'responded_before_prompt_end']


def load_fields():
    txt = open(FIELDS_JS, encoding='utf-8').read()
    start = txt.index('{', txt.index('window.SRL_FIELDS'))
    return json.loads(txt[start: txt.rindex('}') + 1])


def read_export(path):
    with open(path, newline='', encoding='utf-8-sig') as fh:
        rows = list(csv.reader(fh))
    header, body = rows[0], rows[1:]
    # Qualtrics exports have 2 extra header rows: question text, then {"ImportId": ...}
    if len(body) >= 2 and body[1] and body[1][0].startswith('{"ImportId"'):
        body = body[2:]
    return [{(k[5:] if k.startswith('__js_') else k): v for k, v in zip(header, r)} for r in body]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('export')
    ap.add_argument('-o', '--out', default='data/out')
    ap.add_argument('--include-debug', action='store_true')
    a = ap.parse_args()
    F = load_fields()
    recs = [d for d in read_export(a.export) if d.get('condition') and d.get('exp_version') and (a.include_debug or d.get('debug') != '1')]
    recs.sort(key=lambda d: d.get('js_start_epoch_ms') or d.get('StartDate', ''))
    os.makedirs(a.out, exist_ok=True)
    pcols = ['subject'] + F['participant'] + QUALTRICS_COLS + ['attention_check_1_pass', 'attention_check_2_pass', 'external_aid']
    prows, trows, keys, problems = [], [], [], []
    for i, d in enumerate(recs):
        subj = f'S{i + 1:03d}'
        p = {c: d.get(c, '') for c in F['participant'] + QUALTRICS_COLS}
        p['subject'] = subj
        for k, ok in AC_PASS.items():
            p[k + '_pass'] = '' if d.get(k, '') == '' else int(d.get(k) in ok)
        p['external_aid'] = ''
        prows.append(p)
        keys.append({'subject': subj, 'prolific_pid': d.get('PROLIFIC_PID', ''), 'response_id': d.get('ResponseId', '')})
        js = ''.join(d.get(f"{F['json_prefix']}{k}", '') for k in range(1, F['json_chunks'] + 1))
        if not js:
            continue
        try:
            j = json.loads(js)
        except json.JSONDecodeError:
            problems.append(f'{subj}: full_data_json could not be parsed (truncated={d.get("full_data_json_truncated")})')
            continue
        n_in_block = {}
        for t in j.get('test', []):
            b = t['block_index']
            n_in_block[b] = n_in_block.get(b, 0) + 1
            row = {'subject': subj, 'condition': d['condition'], 'stranger_set': d.get('stranger_set', ''), 'test_order': d.get('test_order', ''),
                   'test': t['test_type'], 'test_position': b, 'trial_in_block': n_in_block[b], 'scene_set': t['scene_set_id'],
                   'serial_position': t['serial_position'], 'serial_position_2': t['serial_position_2'], 'target': t['target_id'],
                   'stranger_id': t['stranger_id'], 'stranger_name': t.get('target_name', ''), 'word': t['word'], 'incidental_type': t['incidental_type'],
                   'choice': t['response_id'], 'foils': t['foil_ids'], 'option_order': t['option_order'], 'target_position': t['target_position'],
                   'response_position': t['response_position'], 'correct': t['correct'], 'rt_ms': t['rt_ms'],
                   'responded_before_prompt_end': t['responded_before_prompt_end']}
            w = f"test_{t['test_type']}_{t['scene_set_id']}_"
            if str(d.get(w + 'correct', '')) != str(t['correct']) or str(d.get(w + 'rt_ms', '')) != str(t['rt_ms']):
                problems.append(f"{subj}: wide/JSON mismatch {t['test_type']} {t['scene_set_id']}")
            trows.append(row)
    for name, rows, cols in (('participants.csv', prows, pcols), ('test_trials.csv', trows, TRIAL_COLS), ('id_key.csv', keys, ['subject', 'prolific_pid', 'response_id'])):
        with open(os.path.join(a.out, name), 'w', newline='', encoding='utf-8') as fh:
            w = csv.DictWriter(fh, fieldnames=cols, extrasaction='ignore')
            w.writeheader()
            w.writerows(rows)
    print(f'{len(prows)} participants, {len(trows)} test trials -> {a.out}')
    for p in problems:
        print('CHECK:', p, file=sys.stderr)


if __name__ == '__main__':
    main()
