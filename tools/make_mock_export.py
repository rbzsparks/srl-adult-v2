"""Build a mock Qualtrics CSV export from debug-run field files (sample_data/*_qualtrics_fields.json).

Mimics the real export layout (3 header rows: names, question text, ImportId JSON) so the reshape script can be
tested before any real data exist. Post-test answers are filled with plausible placeholder values.

Usage: python tools/make_mock_export.py sample_data/*_qualtrics_fields.json -o sample_data/mock_qualtrics_export.csv [--engine nste]
"""
import argparse
import csv
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__)))
from build_qsf import all_field_names, load_fields  # noqa: E402

NATIVE = ['StartDate', 'EndDate', 'Status', 'Progress', 'Duration (in seconds)', 'Finished', 'RecordedDate', 'ResponseId',
          'consent', 'expected_test', 'strategy', 'exp_easy', 'attention_check_1', 'exp_sound', 'attention_check_2', 'tech_problems',
          'age', 'gender', 'gender_4_TEXT']


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('files', nargs='+')
    ap.add_argument('-o', '--out', required=True)
    ap.add_argument('--engine', choices=['legacy', 'nste'], default='legacy')
    a = ap.parse_args()
    pre = '__js_' if a.engine == 'nste' else ''
    ed = ['PROLIFIC_PID', 'STUDY_ID', 'SESSION_ID', 'debug', 'condition', 'stranger_set', 'test_order', 'device_ok', 'device_reason', 'device_screen', 'device_window']
    exp = all_field_names(load_fields())
    cols = NATIVE + ed + [pre + c for c in exp if c not in ed]
    rows = []
    for i, fpath in enumerate(sorted(a.files)):
        f = json.load(open(fpath, encoding='utf-8'))
        j = json.loads(''.join(f.get(f'full_data_json_{k}', '') for k in range(1, 5)))
        p = j['p']
        r = {c: '' for c in cols}
        r.update({'StartDate': '2026-11-24 10:00:00', 'EndDate': '2026-11-24 10:20:00', 'Status': '0', 'Progress': '100',
                  'Duration (in seconds)': str(round(int(f['total_ms']) / 1000) + 180), 'Finished': '1', 'RecordedDate': '2026-11-24 10:20:00',
                  'ResponseId': f'R_mock{i:03d}', 'consent': '1', 'expected_test': '2', 'strategy': '', 'exp_easy': '4',
                  'attention_check_1': '1', 'exp_sound': '4', 'attention_check_2': '4', 'tech_problems': '', 'age': str(25 + i), 'gender': str(1 + i % 2),
                  'PROLIFIC_PID': p.get('prolific_pid', ''), 'STUDY_ID': p.get('study_id', ''), 'SESSION_ID': 'SESSION_mock',
                  'debug': '', 'condition': f['condition'], 'stranger_set': f['stranger_set'], 'test_order': f['test_order'], 'device_ok': '1', 'device_reason': '', 'device_screen': '1920x1080',
                  'device_window': '1920x960'})
        for c in exp:
            if c in ed:
                continue
            r[pre + c] = '' if f.get(c) is None else str(f.get(c))
        r['debug'] = str(f.get('debug', ''))
        rows.append(r)
    with open(a.out, 'w', newline='', encoding='utf-8') as fh:
        w = csv.writer(fh)
        w.writerow(cols)
        w.writerow(cols)  # Qualtrics row 2: question text (names reused here)
        w.writerow([json.dumps({'ImportId': c}) for c in cols])
        for r in rows:
            w.writerow([r[c] for c in cols])
    print(f'wrote {a.out}: {len(rows)} responses, {len(cols)} columns')


if __name__ == '__main__':
    main()
