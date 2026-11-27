"""Reshape a Qualtrics CSV export (v3.0 experiment) into the analysis files.

Writes three files into the output folder (keep it out of the repo: data/ is gitignored):
  participants.csv  one row per participant who reached the experiment: subject (S001, ...), every experiment field
                    from fields.js, the Qualtrics post-test answers, and the inputs to the exclusion rules
                    (attention checks as pass/fail, the timeout rates below, audio_check_pass, reloaded_post_fam).
                    external_aid is left blank: code it from `strategy`.
                    Timeout rates (from the JSON backup; the first trial of each task is not counted, because many
                    people miss it while getting ready): timeout_rate_scenes (of scenes 2-12), timeout_rate_matching
                    (of matching trials 2-24), timeout_rate_filler (odd/even numbers missed, or arithmetic timeouts,
                    after the first), and timeout_rate_max, the highest of the three (the exclusion rule uses it).
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
TIMEOUT_COLS = ['timeout_rate_scenes', 'timeout_rate_matching', 'timeout_rate_filler', 'timeout_rate_max']
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


def timeout_rates(j):
    """Share of trials with no response in each timed task, not counting the first trial (see the docstring)."""
    def rate(trials, flag):
        rest = trials[1:]
        return round(sum(int(t.get(flag) or 0) for t in rest) / len(rest), 3) if rest else ''
    fam = sorted(j.get('fam', []), key=lambda t: t.get('serial_position') or 0)
    filler = j.get('filler2', [])
    r = {'timeout_rate_scenes': rate(fam, 'timed_out'), 'timeout_rate_matching': rate(j.get('match', []), 'timed_out'),
         'timeout_rate_filler': rate(filler, 'missed' if filler and 'missed' in filler[0] else 'timed_out')}
    vals = [v for v in r.values() if v != '']
    r['timeout_rate_max'] = max(vals) if vals else ''
    return r


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
    pcols = ['subject'] + F['participant'] + QUALTRICS_COLS + ['attention_check_1_pass', 'attention_check_2_pass', 'external_aid'] + TIMEOUT_COLS
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
            problems.append(f'{subj}: no full_data_json backup (no test trials or timeout rates)')
            continue
        try:
            j = json.loads(js)
        except json.JSONDecodeError:
            problems.append(f'{subj}: full_data_json could not be parsed (truncated={d.get("full_data_json_truncated")})')
            continue
        # Fill participant fields missing from the export from the JSON backup. Qualtrics drops the embedded-data field
        # "duration" (relationship duration) from exports, apparently because it clashes with its own "Duration (in seconds)".
        for c, v in (j.get('p') or {}).items():
            if c in p and p[c] == '' and v not in (None, ''):
                p[c] = v
        p.update(timeout_rates(j))
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
