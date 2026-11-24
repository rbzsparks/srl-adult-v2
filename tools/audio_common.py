"""Shared helpers for the audio tools: clip list (v3.0: from stimuli.json + config.js), ffmpeg lookup, manifest I/O."""
import csv
import glob
import json
import os
import re
import shutil

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
EXP = os.path.join(ROOT, 'experiment')
MANIFEST = os.path.join(EXP, 'audio', 'audio_manifest.csv')
MANIFEST_COLS = ['clip_id', 'speaker_id', 'speaker_gender', 'speaker_age', 'text', 'pronunciation', 'file', 'duration_ms',
                 'is_placeholder', 'ipa', 'stress', 'notes', 'source']


def find_tool(name):
    p = shutil.which(name) or os.environ.get(name.upper())
    if p:
        return p
    hits = glob.glob(os.path.expandvars(r'%LOCALAPPDATA%\Microsoft\WinGet\Packages\Gyan.FFmpeg*\ffmpeg-*\bin\\' + name + '.exe'))
    if hits:
        return hits[0]
    raise SystemExit(f'{name} not found. Install ffmpeg (winget install Gyan.FFmpeg) or set {name.upper()}=<path>.')


def load_stimuli():
    with open(os.path.join(EXP, 'stimuli', 'stimuli.json'), encoding='utf-8') as f:
        return json.load(f)


def _config():
    with open(os.path.join(EXP, 'config.js'), encoding='utf-8') as f:
        return f.read()


def audio_check_words():
    m = re.search(r"AUDIO_CHECK_WORDS:\s*\[([^\]]*)\]", _config())
    return re.findall(r"'([^']+)'", m.group(1))


def voices():
    """[(id, gender, age)] from config VOICES."""
    return re.findall(r"\{ id: '(\w+)', gender: '(\w+)', age: '(\w+)' \}", _config())


def stranger_names():
    """Every stranger name and backup from config STRANGER_NAMES."""
    out = []
    for m in re.finditer(r"name: '(\w+)', onset: '\w+', backup: '(\w+)'", _config()):
        out += [m.group(1), m.group(2)]
    return out


def voice_sample_text():
    return re.search(r'VOICE_SAMPLE_TEXT:\s*"([^"]+)"', _config()).group(1)


def clips():
    """Every clip the experiment loads, with its text and speaker. Speakers: the 6 avatar voices (fy, my, fm, mm, fo, mo)
    and the narrator."""
    st = load_stimuli()
    words, nar = st['words'], st['narrator']
    out = []
    g = {'woman': 'female', 'man': 'male'}

    def pron(w):
        return f"{w} = {words[w]['respelling']}"

    for vid, gender, age in voices():
        spk = dict(speaker_id=vid, speaker_gender=g[gender], speaker_age=age)
        out.append(dict(clip_id='sel_' + vid, text=voice_sample_text(), word=None, kind='sel', **spk))
        for n in stranger_names():
            out.append(dict(clip_id=f'greet_{n.lower()}_{vid}', text=f'Hi, {n}!', word=None, kind='greet', **spk))
        for s in st['scene_sets']:
            w = s['word']
            out.append(dict(clip_id=f'label_{w}_{vid}', text=f"Look! It's a {w}! A {w}!", pronunciation=pron(w), ipa=words[w]['ipa'],
                            stress=words[w]['stress'], word=w, kind='label',
                            notes='Keep clear pauses after "Look!" and after the first word token: the animation finds them to time the gaze shifts.', **spk))
        for w in audio_check_words():
            out.append(dict(clip_id=f'check_{w}_{vid}', text=w, word=None, kind='check', **spk))
    spk = dict(speaker_id='narrator', speaker_gender=nar['gender'], speaker_age=nar['age'])
    for s in st['scene_sets']:
        w = s['word']
        out.append(dict(clip_id='test_word_' + w, text=f'Which one is the {w}?', pronunciation=pron(w), ipa=words[w]['ipa'],
                        stress=words[w]['stress'], word=w, kind='test_word', **spk))
    for n in stranger_names():
        out.append(dict(clip_id='test_identity_' + n.lower(), text=f'Which one is {n}?', word=None, kind='test_identity', **spk))
    for s in st['scene_sets']:
        out.append(dict(clip_id='test_incid_' + s['incidental'], text=f"What color was the {st['incidental_types'][s['incidental']]}?",
                        word=None, kind='test_incid', **spk))
    return out


def read_manifest():
    if not os.path.exists(MANIFEST):
        return []
    with open(MANIFEST, newline='', encoding='utf-8') as f:
        return list(csv.DictReader(f))


def write_manifest(rows):
    os.makedirs(os.path.dirname(MANIFEST), exist_ok=True)
    with open(MANIFEST, 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=MANIFEST_COLS, extrasaction='ignore')
        w.writeheader()
        for r in rows:
            w.writerow(r)
