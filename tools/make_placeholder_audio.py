"""Generate PLACEHOLDER audio with Windows built-in voices (Zira, David), then normalize it.

Each stranger gets a distinct placeholder voice by pitch/tempo-shifting the base voice (see "voice" in
stimuli.json). Novel words use SSML <phoneme alphabet="ipa"> with the IPA in stimuli.json (stress on the first
syllable), so stranger and narrator clips use the same pronunciation.

Usage (Windows):  python tools/make_placeholder_audio.py
Writes raw WAVs to audio_src/raw_placeholder/, shifted WAVs to audio_src/placeholder/, final MP3/OGG to
experiment/audio/, and experiment/audio/audio_manifest.csv (is_placeholder = 1).
"""
import json
import os
import subprocess
import sys
from xml.sax.saxutils import escape

sys.path.insert(0, os.path.dirname(__file__))
import audio_common as ac  # noqa: E402

VOICES = {'Zira': 'Microsoft Zira Desktop', 'David': 'Microsoft David Desktop'}


def ssml_for(c, words):
    def ph(w):
        return f'<phoneme alphabet="ipa" ph="{words[w]["ipa"]}">{w}</phoneme>'
    body = escape(c['text'])
    if c['kind'] == 'label':
        w = c['word']
        body = f"Look! It's a {ph(w)}! A {ph(w)}!"
    elif c['kind'] == 'test_word':
        body = f"Which one is the {ph(c['word'])}?"
    elif c['kind'] == 'greet':
        body = 'Hi! Good to see you!'
    return f'<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">{body}</speak>'


def main():
    ffmpeg = ac.find_tool('ffmpeg')
    st = ac.load_stimuli()
    raw = os.path.join(ac.ROOT, 'audio_src', 'raw_placeholder')
    shifted = os.path.join(ac.ROOT, 'audio_src', 'placeholder')
    os.makedirs(raw, exist_ok=True)
    os.makedirs(shifted, exist_ok=True)
    clips = ac.clips()
    jobs = [{'out': os.path.join(raw, c['clip_id'] + '.wav'), 'voice': VOICES[c['voice']['base']], 'ssml': ssml_for(c, st['words'])}
            for c in clips]
    jobs_path = os.path.join(ac.ROOT, 'audio_src', 'tts_jobs.json')
    with open(jobs_path, 'w', encoding='utf-8') as f:
        json.dump(jobs, f, ensure_ascii=False, indent=1)
    ps = os.path.join(os.path.dirname(__file__), 'tts_sapi.ps1')
    r = subprocess.run(['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps, '-Jobs', jobs_path],
                       capture_output=True, text=True)
    if r.returncode:
        raise SystemExit('TTS failed:\n' + r.stdout + r.stderr)
    print(f'synthesized {len(jobs)} clips')
    for c in clips:
        p, t = c['voice']['pitch'], c['voice']['tempo']
        # SAPI inserts ~0.9 s after each "!"; shorten internal pauses to ~0.35 s so the placeholder sounds natural.
        af = (f'asetrate={44100 * p:.0f},aresample=44100,atempo={t / p:.4f},'
              'silenceremove=stop_periods=-1:stop_duration=0.3:stop_threshold=-38dB:stop_silence=0.3')
        subprocess.run([ffmpeg, '-y', '-hide_banner', '-loglevel', 'error', '-i', os.path.join(raw, c['clip_id'] + '.wav'),
                        '-af', af, os.path.join(shifted, c['clip_id'] + '.wav')], check=True)
    subprocess.run([sys.executable, os.path.join(os.path.dirname(__file__), 'normalize_audio.py'), '--src', shifted, '--placeholder'], check=True)


if __name__ == '__main__':
    main()
