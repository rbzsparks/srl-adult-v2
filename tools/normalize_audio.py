"""Normalize clips for the experiment: trim silence, -16 LUFS, true-peak limit, 44.1 kHz mono, MP3 + OGG.

Rerun this on the final recordings. Input: a folder of WAV (or any ffmpeg-readable) files named <clip_id>.<ext>,
e.g. greet_s01.wav, label_s01.wav, test_word_bosa.wav (see experiment/audio/audio_manifest.csv for every clip_id).
Output: experiment/audio/<clip_id>.mp3 and .ogg, and duration_ms / is_placeholder updated in the manifest.

Usage:
  python tools/normalize_audio.py --src recordings/final            # final recordings (is_placeholder = 0)
  python tools/normalize_audio.py --src audio_src/placeholder --placeholder
Options: --target -16 (LUFS)  --pad-ms 40  --threshold-db -45
"""
import argparse
import json
import os
import re
import subprocess
import sys

sys.path.insert(0, os.path.dirname(__file__))
import audio_common as ac  # noqa: E402


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace')


def measure_lufs(ffmpeg, path):
    r = run([ffmpeg, '-hide_banner', '-nostats', '-i', path, '-af', 'ebur128=framelog=quiet', '-f', 'null', '-'])
    m = re.findall(r'I:\s+(-?[\d.]+|-inf)\s+LUFS', r.stderr)
    val = float(m[-1]) if m and m[-1] != '-inf' else None
    if val is None or val < -60:  # too short for gated loudness: fall back to mean volume (approx.)
        r = run([ffmpeg, '-hide_banner', '-nostats', '-i', path, '-af', 'volumedetect', '-f', 'null', '-'])
        mv = re.search(r'mean_volume:\s*(-?[\d.]+) dB', r.stderr)
        val = float(mv.group(1)) + 3.0 if mv else -23.0
        return val, 'mean_volume_fallback'
    return val, 'ebur128'


def duration_ms(ffprobe, path):
    r = run([ffprobe, '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', path])
    return int(round(float(r.stdout.strip()) * 1000))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', required=True)
    ap.add_argument('--out', default=os.path.join(ac.EXP, 'audio'))
    ap.add_argument('--placeholder', action='store_true', help='mark processed clips as placeholders in the manifest')
    ap.add_argument('--target', type=float, default=-16.0)
    ap.add_argument('--pad-ms', type=int, default=40)
    ap.add_argument('--threshold-db', type=float, default=-45.0)
    ap.add_argument('--source', default='', help='text for the manifest "source" column, e.g. "human recording"')
    ap.add_argument('--source-map', default='', help='JSON {clip_id: source text}; overrides --source per clip')
    a = ap.parse_args()
    source_map = json.load(open(a.source_map, encoding='utf-8')) if a.source_map else {}
    ffmpeg, ffprobe = ac.find_tool('ffmpeg'), ac.find_tool('ffprobe')
    os.makedirs(a.out, exist_ok=True)
    tmpdir = os.path.join(ac.ROOT, 'audio_src', '_tmp')
    os.makedirs(tmpdir, exist_ok=True)

    clips = {c['clip_id']: c for c in ac.clips()}
    existing = {r['clip_id']: r for r in ac.read_manifest()}
    src_files = {os.path.splitext(f)[0]: os.path.join(a.src, f) for f in os.listdir(a.src)
                 if os.path.splitext(f)[1].lower() in ('.wav', '.mp3', '.ogg', '.flac', '.m4a', '.aif', '.aiff')}
    unknown = sorted(set(src_files) - set(clips))
    if unknown:
        print('WARNING: files with no matching clip_id (ignored):', ', '.join(unknown))
    missing = sorted(set(clips) - set(src_files))
    if missing:
        print('NOTE: clip_ids with no file in --src (left unchanged):', ', '.join(missing))

    thr = a.threshold_db
    trim = (f'silenceremove=start_periods=1:start_duration=0:start_threshold={thr}dB:detection=peak,areverse,'
            f'silenceremove=start_periods=1:start_duration=0:start_threshold={thr}dB:detection=peak,areverse,'
            f'adelay={a.pad_ms},apad=pad_dur={a.pad_ms / 1000}')
    for cid, src in sorted(src_files.items()):
        if cid not in clips:
            continue
        tmp = os.path.join(tmpdir, cid + '_trim.wav')
        r = run([ffmpeg, '-y', '-hide_banner', '-i', src, '-ac', '1', '-ar', '44100', '-af', trim, tmp])
        if r.returncode:
            print('ffmpeg trim failed for', cid, r.stderr[-400:])
            continue
        lufs, how = measure_lufs(ffmpeg, tmp)
        gain = a.target - lufs
        # Gain + true-peak limiter (-1 dBFS). The limiter can pull loud-peaked clips below target, so re-measure
        # and add gain until within 0.5 LU (max 4 passes).
        norm = os.path.join(tmpdir, cid + '_norm.wav')
        final_lufs = None
        for _ in range(4):
            chain = f'volume={gain:.2f}dB,alimiter=limit=0.89:level=false:attack=2:release=40,aresample=44100'
            run([ffmpeg, '-y', '-hide_banner', '-i', tmp, '-af', chain, '-ac', '1', '-ar', '44100', '-c:a', 'pcm_s16le', norm])
            final_lufs, _h = measure_lufs(ffmpeg, norm)
            if abs(final_lufs - a.target) <= 0.5:
                break
            gain += a.target - final_lufs
        tag = 'PLACEHOLDER TTS - replace before launch' if a.placeholder else 'final'
        for ext, codec in (('mp3', ['-c:a', 'libmp3lame', '-q:a', '2']), ('ogg', ['-c:a', 'libvorbis', '-q:a', '5'])):
            out = os.path.join(a.out, f'{cid}.{ext}')
            r = run([ffmpeg, '-y', '-hide_banner', '-i', norm, '-ac', '1', '-ar', '44100', *codec,
                     '-metadata', f'comment={tag}', out])
            if r.returncode:
                print('encode failed', cid, ext, r.stderr[-400:])
        d = duration_ms(ffprobe, os.path.join(a.out, f'{cid}.mp3'))
        row = existing.get(cid, {})
        c = clips[cid]
        row.update({k: c.get(k, '') for k in ('clip_id', 'speaker_id', 'speaker_gender', 'speaker_age', 'text', 'pronunciation', 'ipa', 'stress', 'notes')})
        row['file'] = f'{cid}.mp3 | {cid}.ogg'
        row['duration_ms'] = d
        row['is_placeholder'] = 1 if a.placeholder else 0
        row['source'] = source_map.get(cid, a.source or ('Windows SAPI placeholder' if a.placeholder else ''))
        existing[cid] = row
        print(f'{cid:24s} in {lufs:6.1f} LUFS ({how})  gain {gain:+5.1f} dB  out {final_lufs:6.1f} LUFS  {d} ms')

    rows = []
    for cid, c in clips.items():
        row = existing.get(cid) or {k: c.get(k, '') for k in ('clip_id', 'speaker_id', 'speaker_gender', 'speaker_age', 'text', 'pronunciation', 'ipa', 'stress', 'notes')}
        rows.append(row)
    ac.write_manifest(rows)
    print('manifest:', ac.MANIFEST)


if __name__ == '__main__':
    main()
