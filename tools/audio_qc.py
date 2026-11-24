"""Automatic checks on ElevenLabs takes (audio_src/elevenlabs/takes/), shown next to each take in audio_review.html.

For each take: duration and the pause structure found by the same detector the experiment uses for gaze timing
(20 ms RMS frames, < 8% of peak, >= 100 ms, not at the edges).
  label clips  need >= 2 pauses (after "Look!" and after "It's a X!"), otherwise the gaze falls back to proportional timing
  all clips    flagged if much longer than the median of their kind (e.g. IPA read out as text, or a stray extra phrase)
  greetings    flagged if there is a break inside "Hi, Name!" (longest internal gap >= 0.12 s, 10 ms frames, < 12% of peak):
               such takes sound like two separate utterances. gap_s is recorded for every take.
Writes takes/qc.json and, unless selection.json exists, a suggested selection.json (first take that passes).

Usage: python tools/audio_qc.py [--reselect-greetings]   (the option overwrites the greeting picks in selection.json)
"""
import json
import os
import statistics
import subprocess
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
import audio_common as ac  # noqa: E402

TAKES = os.path.join(ac.ROOT, 'audio_src', 'elevenlabs', 'takes')
SEL = os.path.join(ac.ROOT, 'audio_src', 'elevenlabs', 'selection.json')
SR, FRAME = 22050, 0.02


def decode(ffmpeg, path):
    r = subprocess.run([ffmpeg, '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True)
    return np.frombuffer(r.stdout, dtype=np.float32)


def pauses(x):
    n = int(FRAME * SR)
    env = np.array([np.sqrt(np.mean(x[i:i + n] ** 2)) for i in range(0, len(x), n)])
    thr = env.max() * 0.08
    gaps, start = [], -1
    for i, v in enumerate(env):
        if v < thr:
            if start < 0:
                start = i
        else:
            if start > 0 and (i - start) * FRAME >= 0.1:
                gaps.append(round((i - start) * FRAME, 2))
            start = -1
    return gaps


def max_gap(x, thr_frac=0.12, frame=0.01):
    """Longest run of quiet 10 ms frames between the first and last sound (seconds)."""
    n = int(frame * SR)
    env = np.array([np.sqrt(np.mean(x[i:i + n] ** 2)) for i in range(0, len(x), n)])
    on = np.where(env >= env.max() * thr_frac)[0]
    if not len(on):
        return 0.0
    best = run = 0
    for v in env[on[0]:on[-1] + 1] < env.max() * thr_frac:
        run = run + 1 if v else 0
        best = max(best, run)
    return round(best * frame, 2)


def kind(cid):
    for k in ('sel', 'greet', 'label', 'test_word', 'test_incid', 'test_identity', 'check'):
        if cid.startswith(k):
            return k
    return cid


def main():
    ffmpeg = ac.find_tool('ffmpeg')
    index = json.load(open(os.path.join(TAKES, 'index.json'), encoding='utf-8'))
    qc = {}
    for cid, e in index.items():
        for t in e['takes']:
            x = decode(ffmpeg, os.path.join(TAKES, t['file']))
            qc[t['file']] = {'clip_id': cid, 'dur': round(len(x) / SR, 2), 'pauses': pauses(x), 'gap_s': max_gap(x)}
    kinds = {}
    for f, q in qc.items():
        kinds.setdefault(kind(q['clip_id']), []).append(q['dur'])
    med = {k: statistics.median(v) for k, v in kinds.items()}
    for f, q in qc.items():
        cid = q['clip_id']
        k = kind(cid)
        notes = []
        if cid.startswith('label') and len(q['pauses']) < 2:
            notes.append('fewer than 2 pauses: gaze timing will be approximate')
        if cid.startswith('greet') and q['gap_s'] >= 0.12:
            notes.append(f'break inside the greeting ({q["gap_s"]} s): sounds like two utterances')
        if q['dur'] > 1.45 * med[k]:
            notes.append(f'long ({q["dur"]} s vs typical {med[k]:.1f} s): check for extra words')
        q['ok'] = not notes
        q['notes'] = notes
    json.dump(qc, open(os.path.join(TAKES, 'qc.json'), 'w', encoding='utf-8'), indent=1)
    bad = [f for f, q in qc.items() if not q['ok']]
    print(f'{len(qc)} takes checked, {len(bad)} flagged')
    for f in bad:
        print('  ', f, '; '.join(qc[f]['notes']))
    if not os.path.exists(SEL):
        sel = {}
        for cid, e in index.items():
            good = [i for i, t in enumerate(e['takes']) if qc[t['file']]['ok']]
            sel[cid] = (good[0] if good else 0) + 1
        json.dump(sel, open(SEL, 'w', encoding='utf-8'), indent=1)
        print('suggested selection written (first passing take per clip); confirm it in tools/audio_review.html')
    if '--reselect-greetings' in sys.argv:
        # Greetings: use the take with the smallest internal break among those that pass QC (all takes if none pass);
        # ties go to the duration closest to the median greeting.
        sel = json.load(open(SEL, encoding='utf-8')) if os.path.exists(SEL) else {}
        for cid, e in index.items():
            if not cid.startswith('greet'):
                continue
            qs = [(i, qc[t['file']]) for i, t in enumerate(e['takes'])]
            pool = [x for x in qs if x[1]['ok']] or qs
            best = min(pool, key=lambda x: (x[1]['gap_s'], abs(x[1]['dur'] - med['greet'])))
            sel[cid] = best[0] + 1
        json.dump(sel, open(SEL, 'w', encoding='utf-8'), indent=1)
        print('greetings reselected: smallest internal break per clip')
    no_good = [cid for cid, e in index.items() if not any(qc[t['file']]['ok'] for t in e['takes'])]
    if no_good:
        print('clips with no passing take (consider: generate --only ... --force):', ', '.join(no_good))


if __name__ == '__main__':
    main()
