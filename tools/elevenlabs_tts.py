"""Generate the study's audio with ElevenLabs.

API key: set ELEVENLABS_API_KEY, or put the key alone in %USERPROFILE%\\.elevenlabs_api_key (outside the repo).
The key is sent only in the xi-api-key header to api.elevenlabs.io and is never printed or written anywhere.

Workflow
  1. python tools/elevenlabs_tts.py models
        Lists the TTS models your account can use.
  2. python tools/elevenlabs_tts.py voices
        Lists candidate voices (your account + the shared Voice Library) by gender / age, American accent, and writes
        audio_src/elevenlabs/voice_candidates.json. Pick one voice per speaker, then fill experiment/audio/voice_casting.json
        (python tools/elevenlabs_tts.py cast --auto writes a first proposal you can edit).
  3. python tools/elevenlabs_tts.py cast --add
        Checks the casting and adds any Voice Library voices to your account (uses voice slots).
  4. python tools/elevenlabs_tts.py generate --takes 3 [--only label_s01 test_word_bosa ...] [--force]
        Writes audio_src/elevenlabs/takes/<clip_id>_t<k>.mp3 and takes/index.json.
  5. Listen and choose takes in tools/audio_review.html (served by tools/dev_server.py).
        Saves audio_src/elevenlabs/selection.json.
  6. python tools/elevenlabs_tts.py finalize [--only label_str10_tefo ...]
        Copies the chosen takes to audio_src/elevenlabs/selected/ and runs normalize_audio.py
        (trim, -16 LUFS, 44.1 kHz mono MP3 + OGG into experiment/audio/, manifest updated).

Pronunciation of the novel words (stress on the first syllable, IPA from stimuli.json):
  eleven_v4 / eleven_v3: inline IPA in slashes, e.g. "It's a /ˈboʊsɑ/!"
  eleven_flash_v2: SSML <phoneme alphabet="ipa" ph="ˈboʊsɑ">bosa</phoneme> (most deterministic, less natural)
Use --model-for-words to render clips containing a novel word with a different model.
"""
import argparse
import json
import os
import random
import shutil
import subprocess
import sys
import time

import requests

sys.path.insert(0, os.path.dirname(__file__))
import audio_common as ac  # noqa: E402

# Voice names, descriptions and IPA are Unicode; the Windows console defaults to cp1252.
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

API = 'https://api.elevenlabs.io'
OUT = os.path.join(ac.ROOT, 'audio_src', 'elevenlabs')
TAKES = os.path.join(OUT, 'takes')
CASTING = os.path.join(ac.EXP, 'audio', 'voice_casting.json')
PHONEME_TAG_MODELS = {'eleven_flash_v2', 'eleven_turbo_v2', 'eleven_english_sts_v2'}
DEFAULT_MODEL = 'eleven_v4'


def api_key():
    k = os.environ.get('ELEVENLABS_API_KEY')
    if not k:
        p = os.path.join(os.path.expanduser('~'), '.elevenlabs_api_key')
        if os.path.exists(p):
            k = open(p, encoding='utf-8').read().strip()
    if not k:
        raise SystemExit('No API key: set ELEVENLABS_API_KEY or create %USERPROFILE%\\.elevenlabs_api_key containing only the key.')
    return k


def call(method, path, **kw):
    headers = kw.pop('headers', {})
    headers['xi-api-key'] = api_key()
    for attempt in range(4):
        r = requests.request(method, API + path, headers=headers, timeout=120, **kw)
        if r.status_code == 429 or r.status_code >= 500:
            time.sleep(2 * (attempt + 1))
            continue
        if r.status_code >= 400:
            # Error bodies never contain the key; trim them anyway.
            raise SystemExit(f'{method} {path} -> HTTP {r.status_code}: {r.text[:400]}')
        return r
    raise SystemExit(f'{method} {path} failed after retries (HTTP {r.status_code})')


# ---------- text for each clip ----------
def strip_dots(ipa):
    return ipa.replace('.', '')


def clip_text(c, words, model):
    """Text sent to the model. Pauses in label clips come from punctuation (v3/v4 don't support <break>)."""
    w = c.get('word')
    if not w:
        return c['text'], False
    ipa = strip_dots(words[w]['ipa'])
    if model in PHONEME_TAG_MODELS:
        tag = f'<phoneme alphabet="ipa" ph="{ipa}">{w}</phoneme>'
        if c['kind'] == 'label':
            return f'Look! <break time="0.4s" /> It\'s a {tag}! <break time="0.4s" /> A {tag}!', True
        return f'Which one is the {tag}?', True
    tok = f'/{ipa}/'
    if c['kind'] == 'label':
        return f"Look! ... It's a {tok}! ... A {tok}!", True
    return f'Which one is the {tok}?', True


# ---------- commands ----------
def cmd_models(a):
    r = call('GET', '/v1/models').json()
    for m in r:
        if m.get('can_do_text_to_speech'):
            print(f"{m['model_id']:28s} {m.get('name', '')}")


def fetch_candidates():
    out = []
    # Voices already in the account (premade/default + any added).
    token = None
    while True:
        params = {'page_size': 100}
        if token:
            params['next_page_token'] = token
        r = call('GET', '/v2/voices', params=params).json()
        for v in r.get('voices', []):
            lab = v.get('labels') or {}
            out.append({'source': 'account', 'voice_id': v['voice_id'], 'name': v.get('name'), 'category': v.get('category'),
                        'gender': lab.get('gender', ''), 'age': lab.get('age', ''), 'accent': lab.get('accent', ''),
                        'description': lab.get('description', '') or (v.get('description') or '')[:80],
                        'use_case': lab.get('use_case', ''), 'preview_url': v.get('preview_url', ''), 'public_owner_id': None})
        if not r.get('has_more'):
            break
        token = r.get('next_page_token')
    # Shared Voice Library: American English voices by gender x age.
    for gender in ('female', 'male'):
        for age in ('young', 'middle_aged', 'old'):
            r = call('GET', '/v1/shared-voices', params={'page_size': 30, 'gender': gender, 'age': age, 'accent': 'american',
                                                          'language': 'en', 'sort': 'cloned_by_count'}).json()
            for v in r.get('voices', []):
                out.append({'source': 'library', 'voice_id': v['voice_id'], 'name': v.get('name'), 'category': v.get('category'),
                            'gender': v.get('gender', ''), 'age': v.get('age', ''), 'accent': v.get('accent', ''),
                            'description': (v.get('descriptive') or '') + ' ' + (v.get('description') or '')[:80],
                            'use_case': v.get('use_case', ''), 'preview_url': v.get('preview_url', ''),
                            'public_owner_id': v.get('public_owner_id'), 'cloned_by_count': v.get('cloned_by_count')})
    return out


def cmd_voices(a):
    os.makedirs(OUT, exist_ok=True)
    cands = fetch_candidates()
    json.dump(cands, open(os.path.join(OUT, 'voice_candidates.json'), 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    for c in sorted(cands, key=lambda x: (x['source'], x['gender'], x['age'], x['name'] or '')):
        print(f"{c['source']:7s} {c['gender']:6s} {c['age']:11s} {c['accent']:10s} {c['name'][:28]:28s} {c['voice_id']}  {c['description'][:60]}")
    print(f'\n{len(cands)} candidates -> audio_src/elevenlabs/voice_candidates.json')


def speakers():
    """speaker_id -> (gender, age) as the study needs them."""
    sp = {}
    for c in ac.clips():
        sp[c['speaker_id']] = (c['speaker_gender'], c['speaker_age'])
    return sp


AGE_MAP = {'young': 'young', 'middle': 'middle_aged', 'older': 'old'}


def cmd_cast(a):
    sp = speakers()
    if a.auto:
        cands = json.load(open(os.path.join(OUT, 'voice_candidates.json'), encoding='utf-8'))
        used, cast = set(), {}
        for sid, (g, age) in sorted(sp.items()):
            want = AGE_MAP.get(age, age)
            pool = [c for c in cands if c['gender'] == g and c['age'] == want and c['voice_id'] not in used
                    and (c['accent'] or 'american').lower().startswith('american')]
            pool.sort(key=lambda c: (c['source'] != 'account', -(c.get('cloned_by_count') or 0)))
            if not pool:
                print(f'no candidate for {sid} ({g}, {age})')
                continue
            c = pool[0]
            used.add(c['voice_id'])
            cast[sid] = {k: c[k] for k in ('voice_id', 'name', 'source', 'gender', 'age', 'accent', 'public_owner_id', 'preview_url')}
            cast[sid]['want'] = f'{g}, {age}'
        json.dump(cast, open(CASTING, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
        print(f'proposal written to {CASTING}; listen to the preview_url of each and edit before generating.')
    cast = json.load(open(CASTING, encoding='utf-8'))
    missing = [s for s in sp if s not in cast]
    if missing:
        raise SystemExit('casting missing speakers: ' + ', '.join(missing))
    ids = [v['voice_id'] for v in cast.values()]
    if len(set(ids)) != len(ids):
        print('WARNING: the same voice is cast for more than one speaker')
    for sid, v in sorted(cast.items()):
        print(f"{sid:9s} want {sp[sid][0]:6s} {sp[sid][1]:7s} -> {v['name']} ({v.get('gender')}, {v.get('age')}, {v.get('source')})")
    if a.add:
        for sid, v in cast.items():
            if v.get('source') == 'library' and not v.get('added'):
                r = call('POST', f"/v1/voices/add/{v['public_owner_id']}/{v['voice_id']}", json={'new_name': f"SRL {sid} {v['name']}"[:40]}).json()
                v['voice_id'] = r.get('voice_id', v['voice_id'])
                v['added'] = True
                print(f'added {sid}: {v["name"]}')
        json.dump(cast, open(CASTING, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)


def cmd_generate(a):
    cast = json.load(open(CASTING, encoding='utf-8'))
    words = ac.load_stimuli()['words']
    os.makedirs(TAKES, exist_ok=True)
    idx_path = os.path.join(TAKES, 'index.json')
    index = json.load(open(idx_path, encoding='utf-8')) if os.path.exists(idx_path) else {}
    clips = [c for c in ac.clips() if not a.only or c['clip_id'] in a.only]
    for c in clips:
        cid = c['clip_id']
        model = a.model_for_words if (a.model_for_words and c.get('word')) else a.model
        text, has_word = clip_text(c, words, model)
        voice = cast[c['speaker_id']]
        entry = index.get(cid) if not a.force else None
        entry = entry or {'clip_id': cid, 'text': c['text'], 'pronunciation': c.get('pronunciation', ''), 'speaker_id': c['speaker_id'], 'takes': []}
        start = len(entry['takes'])
        for k in range(start, a.takes):
            seed = random.randint(1, 2**31 - 1)  # fresh seed per take; recorded below so a take can be reproduced
            body = {'text': text, 'model_id': model, 'seed': seed}
            if model in PHONEME_TAG_MODELS:
                body['voice_settings'] = {'stability': 0.55, 'similarity_boost': 0.75}
            r = call('POST', f"/v1/text-to-speech/{voice['voice_id']}", params={'output_format': 'mp3_44100_128'}, json=body)
            fn = f'{cid}_t{k + 1}.mp3'
            open(os.path.join(TAKES, fn), 'wb').write(r.content)
            entry['takes'].append({'file': fn, 'model': model, 'voice': voice['name'], 'voice_id': voice['voice_id'], 'sent_text': text, 'seed': seed})
            print(f'{cid:24s} take {k + 1}  {model}  {voice["name"]}')
        index[cid] = entry
        json.dump(index, open(idx_path, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    print(f'{len(clips)} clips; index: {idx_path}')


def cmd_finalize(a):
    index = json.load(open(os.path.join(TAKES, 'index.json'), encoding='utf-8'))
    sel_path = os.path.join(OUT, 'selection.json')
    sel = json.load(open(sel_path, encoding='utf-8')) if os.path.exists(sel_path) else {}
    dest = os.path.join(OUT, 'selected')
    if os.path.isdir(dest):
        shutil.rmtree(dest)
    os.makedirs(dest)
    source = {}
    for cid, e in index.items():
        if a.only and cid not in a.only:
            continue  # --only: re-normalize just these clips; every other file is left as it is
        k = int(sel.get(cid, 1)) - 1
        t = e['takes'][k]
        shutil.copy(os.path.join(TAKES, t['file']), os.path.join(dest, cid + '.mp3'))
        source[cid] = f"ElevenLabs {t['model']} / {t['voice']} / take {k + 1}"
    unselected = [c for c in index if c not in sel]
    if unselected:
        print(f'{len(unselected)} clips had no selection; take 1 used: ' + ', '.join(unselected[:12]) + (' ...' if len(unselected) > 12 else ''))
    smap = os.path.join(OUT, 'source_map.json')
    json.dump(source, open(smap, 'w', encoding='utf-8'), indent=1)
    subprocess.run([sys.executable, os.path.join(os.path.dirname(__file__), 'normalize_audio.py'), '--src', dest, '--source-map', smap], check=True)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest='cmd', required=True)
    sub.add_parser('models')
    sub.add_parser('voices')
    c = sub.add_parser('cast')
    c.add_argument('--auto', action='store_true', help='write a first casting proposal from voice_candidates.json')
    c.add_argument('--add', action='store_true', help='add cast Voice Library voices to your account')
    g = sub.add_parser('generate')
    g.add_argument('--model', default=DEFAULT_MODEL)
    g.add_argument('--model-for-words', default='', help='model for clips containing a novel word (e.g. eleven_flash_v2)')
    g.add_argument('--takes', type=int, default=3)
    g.add_argument('--only', nargs='*')
    g.add_argument('--force', action='store_true', help='discard existing takes for these clips')
    fz = sub.add_parser('finalize')
    fz.add_argument('--only', nargs='*', help='finalize only these clip ids (other audio files are not touched)')
    a = ap.parse_args()
    {'models': cmd_models, 'voices': cmd_voices, 'cast': cmd_cast, 'generate': cmd_generate, 'finalize': cmd_finalize}[a.cmd](a)


if __name__ == '__main__':
    main()
