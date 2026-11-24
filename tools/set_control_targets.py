"""Install the chosen control-condition copy targets into experiment/stimuli/stimuli.json (v3.1).

Candidates come from tools/control_targets.html ("Save candidates JSON" writes
experiment/stimuli/control_target_candidates.json). Pick one column per row (slot 1-6 = voices fy, my, fm, mm, fo, mo):

    python tools/set_control_targets.py --pick A,A,A,A,A,A

writes stimuli.json "control_targets": [{"id": 1, "voice": "fy", "candidate": "1A", "avatar": {...}}, ...].
"""
import argparse
import json
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
STIM = os.path.join(ROOT, 'experiment', 'stimuli')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--pick', required=True, help='one of A/B/C per slot, comma-separated, e.g. A,B,A,C,A,B')
    a = ap.parse_args()
    picks = [p.strip().upper() for p in a.pick.split(',')]
    cands = json.load(open(os.path.join(STIM, 'control_target_candidates.json'), encoding='utf-8'))
    if len(picks) != len(cands):
        raise SystemExit(f'need {len(cands)} picks, got {len(picks)}')
    targets = []
    for row, p in zip(cands, picks):
        c = next((c for c in row['candidates'] if c['id'] == f"{row['slot']}{p}"), None)
        if not c:
            raise SystemExit(f"slot {row['slot']}: no candidate {p}")
        targets.append({'id': row['slot'], 'voice': row['voice'], 'label': row['label'], 'candidate': c['id'], 'avatar': c['avatar']})
    path = os.path.join(STIM, 'stimuli.json')
    st = json.load(open(path, encoding='utf-8'))
    st['control_targets'] = targets
    json.dump(st, open(path, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    print('control_targets:', ', '.join(f"{t['id']}={t['candidate']} ({t['voice']})" for t in targets))


if __name__ == '__main__':
    main()
