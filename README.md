# Social relevance and learning from strangers: adult Prolific experiment (v2)

> **Status: v2 under construction.** This repo starts from the pilot-1 code (`rbzsparks/srl-adult-prolific`, tag
> `v2.4.2-pilot1`). The v2 design is in [docs/V2_SPEC.md](docs/V2_SPEC.md). Until the build is done, the text below
> still describes pilot 1.

jsPsych 8.2.1 experiment, embedded in a **Qualtrics** survey (classic layout), recruited on **Prolific**.
Participants name someone they know (closeness category assigned between subjects), rate closeness (IOS), contact
frequency and relationship duration, picture that person and jot down a few private notes, build an avatar of them, confirm it,
meet an unfamiliar person ("Jordan"), do a short avatar–name matching task, read the scene instructions, get a 10-second
"get ready" countdown, watch 12 animated scenes with audio (with three short person check-ins), rate how much the avatar felt
like their person, do a 45-second arithmetic filler, and then take surprise memory tests for words, faces and incidental objects.
The steps that link the avatar to the person (v2.3) are in [§19](#19-linking-the-avatar-to-the-person-and-check-ins-v23).
A fourth, **control** category (v2.4) has no known person: participants copy a random avatar, which is then given a name,
and skip every question about a known person; see [§20](#20-control-condition-copy-a-random-avatar-v24).

**Two versions share this codebase** (each runs as its own Qualtrics survey and Prolific study):
- **unique12**: 12 scene sets, each shown once; 36 test trials. Survey: `qualtrics/survey.qsf`. Most of this README describes it.
- **repeat6**: 6 scene sets, each shown twice; 18 test trials; a between-subjects stranger set (X / Y). Survey: `qualtrics/repeat6/survey.qsf`. Everything that differs is in [§18](#18-repeat6-version-6-scene-sets-each-shown-twice).

Order of precedence for the design documents: `ANSWERS_ROUND2.md` > `UPDATES_v2.md` > `ANSWERS_FOR_CLAUDE_CODE.md` > `EXPERIMENT_SPEC.md`.

---

## Contents

1. [Files](#1-files)
2. [Run it locally](#2-run-it-locally)
3. [Deploy to GitHub Pages](#3-deploy-to-github-pages)
4. [Qualtrics setup](#4-qualtrics-setup)
5. [Prolific setup](#5-prolific-setup)
6. [Configuration and [DECISION] flags](#6-configuration-and-decision-flags)
7. [Procedure and timing](#7-procedure-and-timing)
8. [Counterbalancing and randomization](#8-counterbalancing-and-randomization)
9. [Stimuli](#9-stimuli)
10. [Audio](#10-audio)
11. [Data saving](#11-data-saving)
12. [Reshaping the Qualtrics export](#12-reshaping-the-qualtrics-export)
13. [Data dictionary](#13-data-dictionary)
14. [Data quality and exclusion support](#14-data-quality-and-exclusion-support)
15. [Privacy](#15-privacy)
16. [What the researcher still needs to supply](#16-what-the-researcher-still-needs-to-supply)
17. [Known limitations and untested paths](#17-known-limitations-and-untested-paths)
18. [Repeat6 version (6 scene sets, each shown twice)](#18-repeat6-version-6-scene-sets-each-shown-twice)
19. [Linking the avatar to the person, and check-ins (v2.3)](#19-linking-the-avatar-to-the-person-and-check-ins-v23)
20. [Control condition: copy a random avatar (v2.4)](#20-control-condition-copy-a-random-avatar-v24)

---

## 1. Files

```
experiment/                  ← publish this folder on GitHub Pages
  config.js                  all counts, timings, codes and [DECISION] flags
  index.html                 local runner (same code Qualtrics loads)
  css/experiment.css
  lib/jspsych.js             jsPsych 8.2.1 (vendored, so the study doesn't depend on a CDN)
  js/loader.js               loads everything from a base URL and starts the study
  js/main.js                 timeline, sections, reload handling, finishing
  js/screens.js              intro, name, relationship, IOS, duration, audio check, messages, scene instructions
  js/binding.js              contact (2 questions), recall notes, revision offer, confirmation, unfamiliar-person
                             introduction, avatar–name matching, person check-ins, post-scene rating (§19)
  js/designer.js             avatar designer (6 tabs, 16 sliders, recall-notes panel) + likeness rating
  js/people.js               shaded parametric figure renderer + animation rig (gaze, turn, mouth)
  js/avatar_rules.js         unfamiliar-person rule, natural hair-colour scale, similar styles, foil maker + checks
  js/objects.js              novel objects (12) and recolorable incidental objects (12)
  js/scene.js                animated familiarization scene, AOIs, MouseView option
  js/fillers.js              "get ready" countdown; arithmetic verification
  js/tests.js                word / face / incidental tests
  js/stimuli.js              loads the stimulus file of the design version; lists, orders, foils (unique12 + repeat6)
  js/audio.js                Web Audio preload, playback, amplitude lip-sync, pause segmentation
  js/data.js                 Qualtrics (legacy / NSTE), JSON chunks, DataPipe, local download
  js/progress.js             reload marker (localStorage), leave-page warning
  js/fields.js               THE list of embedded-data fields (shared with the Python tools)
  stimuli/stimuli.json       scene sets: stranger + foil feature vectors, foil change, object, word (+IPA), incidental type, voice
  stimuli/stimuli_repeat6.json  repeat6: 6 scene sets + stranger sets X / Y (strangers, foils, voices, audio clip ids)
  stimuli/svg/               exported SVGs of every stimulus (see §9)
  audio/                     <clip_id>.mp3 + .ogg, audio_manifest.csv (recording script)
qualtrics/
  survey.qsf                 importable survey (flow, randomizer, fields, JS question, post-test, debrief, redirects)
  experiment_question.js     the JS in the experiment question (for pasting manually if needed)
  device_check_question.js   the JS in the device-check question
  embedded_data_fields.txt   every embedded-data field declared in the survey flow
  repeat6/                   the same four files for the repeat6 survey (python tools/build_qsf.py --design repeat6)
analysis/
  reshape_qualtrics.py       Qualtrics export (wide) → long format, one row per trial
tools/
  dev_server.py              local server (also lets debug runs write into sample_data/)
  stimulus_sheet.html        preview every stimulus; "Export SVGs" writes experiment/stimuli/svg/
  scene_preview.html         play any scene in either condition; show the final frame + AOIs
  designer_preview.html      run the avatar designer + likeness question on their own; shows the unfamiliar person
  make_foils.html            (re)generate the frozen face-test foils from FOIL_K / FOIL_STEP; checks the 6 foil rules
                             (?design=repeat6: the repeat6 foils and their rules)
  build_repeat6_stimuli.py   builds stimuli_repeat6.json from stimuli.json (scene sets, stranger sets, foil changes)
  check_repeat6.html         1,000 repeat6 designs from the real stimuli.js: every order / test rule + balance tables
  privacy_check.html         full automatic session; searches every output for the typed name and recall notes (§15)
  hair_review.html           hair styles across textures, skin tones and hair colours, old vs. new drawing
  hair_motion.html           every hair style looping through the scenes' look at the partner / at the object
  build_qsf.py               regenerates qualtrics/survey.qsf from config.js + fields.js
  make_placeholder_audio.py  placeholder TTS (Windows voices) → normalize
  normalize_audio.py         trim / −16 LUFS / limiter / 44.1 kHz mono / MP3 + OGG (rerun on final recordings)
  tts_sapi.ps1, audio_common.py
  make_mock_export.py        builds a fake Qualtrics export from debug runs (to test the reshape script)
sample_data/                 outputs of debug runs (see §12)
```

## 2. Run it locally

```bash
python tools/dev_server.py
```

Then open `http://localhost:8000/experiment/index.html?debug=1`. URL parameters:

| Parameter | Meaning |
|---|---|
| `PROLIFIC_PID`, `STUDY_ID`, `SESSION_ID` | as Prolific sends them |
| `category` | `acquaintance` \| `moderate` \| `close` \| `control` (random if missing; `control`: §20) |
| `list` | `A` \| `B` (random if missing) |
| `design_version` | `unique12` \| `repeat6` (missing: `DESIGN_VERSION` in config.js, recorded as `design_version_source = config_fallback`) |
| `stranger_set` | repeat6 only: `X` \| `Y` (random if missing) |
| `debug=1` | fillers shortened (countdown 5 s, arithmetic 15 s); condition / stimulus IDs shown on screen; no DataPipe; data downloaded |
| `name_label` | `0` hides / `1` shows the name text beneath the person in scenes (overrides `SHOW_NAME_LABEL`) |
| `binding` | `0` / `1` turns the recall, revision and matching steps off / on (overrides their config switches, §19) |
| `checkins` | `0` / `1` turns the person check-ins off / on (overrides `CHECKINS_ENABLED`, §19) |
| `auto=1` | with `debug=1`: autopilot clicks through the whole study (~3–4 min) |
| `devsave=1` | with the dev server: write output files into `sample_data/` instead of downloading |
| `reset=1` | clear the reload marker for this PROLIFIC_PID (otherwise a second visit counts as a reload) |
| `prototype=1` | load Prototype.js 1.7.1 first, as Qualtrics' classic layouts do, to catch code that breaks under it (run this before every deploy) |

Example full walkthrough: `…/index.html?debug=1&auto=1&devsave=1&PROLIFIC_PID=TEST001&category=close&list=A&reset=1`.

`tools/scene_preview.html` plays any scene in either condition (with sound) and shows the final frame and AOIs.

## 3. Deploy to GitHub Pages

**Status:** done on 2026-11-13. The repo is <https://github.com/rbzsparks/srl-adult-prolific> (public), Pages serves `main` / root, and the .qsf in `qualtrics/` already uses the base URL below. To update the live study, commit and `git push`; Pages redeploys in about a minute.

1. Create a public repo under `rbzsparks`, `srl-adult-prolific`, and push this folder.
2. Repo **Settings → Pages → Deploy from a branch → main / root**.
3. The experiment base URL is then `https://rbzsparks.github.io/srl-adult-prolific/experiment/`.
4. Rebuild the .qsf with that URL (or edit `BASE_URL` in the experiment question's JS after import):
   ```bash
   python tools/build_qsf.py --base-url https://rbzsparks.github.io/srl-adult-prolific/experiment/ --completion-code YOURCODE --screenout-code YOURCODE2
   ```
5. **Cross-origin check.** Qualtrics loads the scripts with `<script>` tags (no CORS needed) and the audio and
   `stimuli.json` with `fetch()`, which does need CORS. GitHub Pages sends `Access-Control-Allow-Origin: *`
   (checked 2026-11-13 on a github.io page). To confirm on your repo:
   ```bash
   curl -sI https://rbzsparks.github.io/srl-adult-prolific/experiment/audio/greet_s01.mp3 | grep -i access-control
   ```
   It should print `access-control-allow-origin: *`. Then do a Qualtrics preview with `debug=1` (see §4). The
   loading bar fills only if all clips of the design version were fetched and decoded with the Web Audio API.
   `audio_load_errors` in the data counts any that failed.
   Without Qualtrics, `tools/remote_load_test.html` (served by `tools/dev_server.py`) loads the live study from
   GitHub Pages into a page on another origin, the same way the Qualtrics question does. Add `?auto=1` for an
   autopilot run. Tested 2026-11-13: all scripts loaded, 51/51 audio clips decoded, real playback, no errors.
6. **Caching.** GitHub Pages caches for about 10 minutes. The question JS appends `?v=<VERSION>` to every file,
   so bump `VERSION` in `config.js` and in the question JS (`VERSION = '…'`) when you change files mid-study.

## 4. Qualtrics setup

### 4.1 One-minute test that custom JavaScript is allowed (Harvard license)

1. Make a blank survey with one text/graphic question → **Question behavior → JavaScript**.
2. Paste:
   ```js
   Qualtrics.SurveyEngine.addOnload(function () { console.log('SRL JS test OK', this.questionId); alert('JavaScript works'); });
   ```
3. **Preview**. If an alert appears (and the console shows the line), custom JS is allowed. If the JavaScript
   option is missing or nothing happens, ask Harvard's Qualtrics admins to enable custom JavaScript for your account.

### 4.2 Import

**Create project → Survey → From a file → `qualtrics/survey.qsf`.**

Survey flow in the .qsf:

1. **Embedded Data**: `PROLIFIC_PID`, `STUDY_ID`, `SESSION_ID`, `debug`, `name_label` (from the URL), plus every field the experiment writes (392 fields in total; listed in `qualtrics/embedded_data_fields.txt`).
2. **Device check** (JS, before consent): mobile/tablet (by user agent), or a screen smaller than 1024 × 650 physical pixels (either orientation; measured as CSS pixels × `devicePixelRatio`, so Windows display scaling or browser zoom doesn't fail an ordinary laptop) → message showing the detected reason and screen size → **End of Survey → redirect to `…/complete?cc=SCREENOUT_CODE`**. Qualtrics' preview has a **Mobile view** toggle; with it on, a phone-sized frame is shown, so preview with it off.
3. **Consent** (placeholder text, shows the ~22 min estimate, ~20 in repeat6, and says that some participants design an avatar of someone they know, typing a name and notes, while others copy an avatar, and that any name and notes typed are not saved; the consent comes before the Randomizer, so one text covers all four categories). "I do not agree" → a short message → **End of Survey → redirect to `…/complete?cc=NOCONSENT_CODE`** (Prolific requires non-consenting participants to be sent to a completion path; set that path to "Request a return").
4. **Randomizer**: present 1 of 8 (repeat6: 1 of 16), **evenly present** on. Each element sets `category` (acquaintance / moderate / close / control) × `list` (A / B) (× `stranger_set` in repeat6).
5. **Experiment (JS)**: one question whose JS loads the experiment from `BASE_URL`; the Next button is hidden and clicked automatically when the participant finishes.
6. **Post-test questions**: expected a test? (Yes / No / Not sure), strategy (optional text), 2 experience items with 2 attention checks between them, technical problems (optional).
7. **Demographics**: age (number 18–110), gender. *(Confirm the list with the IRB.)*
8. **Debrief** (placeholder text).
9. **End of Survey → redirect to `https://app.prolific.com/submissions/complete?cc=COMPLETION_CODE`.**

### 4.3 Checklist after import

- [ ] **Look & Feel → Layout = Flat (or Modern)**, and **Survey options → "New survey taking experience" is OFF**. Qualtrics made the new experience the default for *new* surveys in June 2026. Importing a .qsf keeps the file's settings, but check anyway.
- [ ] **Survey flow → Randomizer → "Evenly present elements" is checked**, "Randomly present 1 of the following elements", with 6 elements.
- [ ] **The Embedded Data element is the first element in the flow**, above the Experiment block (otherwise values the JS sets are not saved).
- [ ] **Survey options → Back button is OFF.**
- [ ] **All three End of Survey redirects** have the right codes (device screen-out branch, consent-declined branch, and the final element) and use `https://app.prolific.com/submissions/complete?cc=…`.
- [ ] Experiment question JS: `BASE_URL` points at your GitHub Pages `experiment/` folder (with the trailing `/`).
- [ ] Replace the consent / debrief placeholders and confirm the demographics with the IRB.
- [ ] Preview with `?PROLIFIC_PID=test1&STUDY_ID=x&SESSION_ID=y&debug=1`, go through the whole survey, then check **Data & Analysis** that `ios`, `fam_01_view_ms`, `test_word_s01_correct` and `full_data_json_1` are filled.

If the .qsf import fails or loses something (the file was generated by script, and I could not test the import without a Qualtrics account), build those parts by hand.
Everything you need is in `qualtrics/`: the two JS files, the field list, and the flow above.

### 4.4 Qualtrics limits that matter

- **Embedded-data value size: 20 KB per value** (Qualtrics documentation). A bug in the new survey-taking experience capped values at 1,000 characters in January–February 2026. Qualtrics reported it fixed on 2026-02-25.
- The full trial-level backup is about 25 KB, so it's split across **`full_data_json_1..4`**, each at most 15,000 characters (configurable: `JSON_CHUNK_CHARS`, `JSON_CHUNKS`). That allows up to 60 KB. If it is ever larger, `full_data_json_truncated = 1`, but the wide fields and the DataPipe copy are still complete.
- Embedded data is saved only when the page is submitted (when the experiment clicks Next). A participant who closes the tab mid-experiment leaves no Qualtrics data from the JS block, but the **DataPipe** backups (after familiarization and after each test block) survive.

### 4.5 Newer engine ("nste") path: untested

Build and test with `QUALTRICS_ENGINE: 'legacy'` (the default). If Harvard forces the new survey-taking experience,
or Qualtrics retires the classic layouts:

1. Set `QUALTRICS_ENGINE: 'nste'` in `config.js`.
2. Rebuild the survey: `python tools/build_qsf.py --engine nste --base-url …`. Every field is then declared with the `__js_` prefix, and the device-check JS uses `setJSEmbeddedData`.

The experiment then calls `Qualtrics.SurveyEngine.setJSEmbeddedData(name, value)`, and the survey flow must declare
**`__js_<name>`** for every field: `__js_category`, `__js_list`, `__js_ios`, `__js_fam_01_view_ms`, …,
`__js_full_data_json_1`, and so on (the full list is `embedded_data_fields.txt` with each name prefixed). The flow's own
fields (`PROLIFIC_PID`, `STUDY_ID`, `SESSION_ID`, `debug`, and the Randomizer's `category` / `list`) keep their plain names.
`reshape_qualtrics.py` strips the `__js_` prefix automatically.

**This path has not been run on the new engine.** Before relying on it, check three things in a preview: that piped
text (`${e://Field/…}`) works inside the question JS, that `hideNextButton` and `clickNextButton` exist, and that the
fields appear in the data.

## 5. Prolific setup

- Study URL: `https://<your>.qualtrics.com/jfe/form/SV_xxx?PROLIFIC_PID={{%PROLIFIC_PID%}}&STUDY_ID={{%STUDY_ID%}}&SESSION_ID={{%SESSION_ID%}}`
- Device filter: **Desktop only**. Listing text: **"Requires audio (headphones or speakers)."**
- Completion paths (Data collection → Completion paths; set up before publishing):
  - **Completed** → approve and pay (or manually review): `COMPLETION_CODE`.
  - **Screened out** (device check only) → fixed screen-out reward (minimum £0.10 / $0.14) with a screen-out cap of about 10: `SCREENOUT_CODE`. State the device requirement in the description and "Study details".
  - **No consent** → "Request a return": `NOCONSENT_CODE`. Unreviewed submissions on this path are auto-approved at the full reward after 21 days, so check them.
- Build the survey with the real codes into a folder **outside the repo** (the repo is public):
  `python tools/build_qsf.py --design repeat6 --completion-code … --screenout-code … --noconsent-code … --out <folder outside the repo>/survey.qsf`
- Duration estimate shown on the consent page: about 22 min (`ESTIMATED_MINUTES`; repeat6 20). v2.3 added about 2 min 40 s for the binding steps and check-ins; it was 19 in v2.1–2.2. The one repeat6 pilot before v2.3 took 10.4 min against an estimate of 17, so both numbers are probably generous. Confirm it with the pilot (`total_ms`, `t_*_ms`, and Qualtrics `Duration`), then set pay at or above Prolific's recommended rate.

## 6. Configuration and [DECISION] flags

All in `experiment/config.js`.

| Setting | Default | Notes |
|---|---|---|
| `QUALTRICS_ENGINE` | `'legacy'` | `'nste'` = untested path, §4.5 |
| `COMPLETION_CODE`, `SCREENOUT_CODE`, `NOCONSENT_CODE` | placeholders | the .qsf redirects; pass real codes with `--completion-code` / `--screenout-code` / `--noconsent-code` rather than committing them (§5) |
| `DATAPIPE.EXPERIMENT_ID` | placeholder | backup is skipped while it's a placeholder or in debug mode |
| `DESIGN_VERSION` | `'unique12'` | fallback only: each survey passes `design_version` to the experiment (§18). Recorded as `design_version`, with `design_version_source` = `qsf` (passed by the survey), `url` (local runs) or `config_fallback` |
| `ESTIMATED_MINUTES`, `ESTIMATED_MINUTES_REPEAT6` | `22`, `20` | consent-page estimates (unique12, repeat6) |
| `RECALL_ENABLED`, `REVISION_ENABLED`, `MATCHING_ENABLED` | `true` | the binding steps (§19); `binding=0/1` overrides all three per participant |
| `REVISION_MAX_RATING` | `4` | the revision is offered when the first likeness rating is this or lower |
| `MATCH_TRIALS_PER_TYPE`, `MATCH_MAX_RT_MS`, `MATCH_FLAG_BELOW` | `6`, `2500`, `0.75` | matching task: 4 types × 6 = 24 trials; response window; `match_flag` threshold |
| `CHECKINS_ENABLED`, `CHECKIN_AFTER_TRIALS` | `true`, `[3, 6, 9]` | person check-ins (§19); `checkins=0/1` overrides per participant |
| `CONTACT_FREQ` | 7 options | both contact questions; listed most to least often, coded 7 … 1 |
| `SURPRISE_TEST` | `true` | `false` adds "Afterwards, we will test your memory…" to the scene instructions; recorded as `surprise_test` |
| `SHOW_NAME_LABEL` | `true` | `true` (the default again since v2.0.0) shows the name text beneath the known / unfamiliar person in every scene; `false` hides it (the name is still used in the setup questions and scene instructions). Override per participant with `name_label=0/1`, from the URL or a Qualtrics embedded field (§8). Recorded as `name_label_shown` |
| `MOUSEVIEW` | `false` | blur-except-cursor spotlight + AOI dwell (`dwell_*_ms` in the JSON backup). Lightly tested only |
| `TEST_BLOCK_ORDER_MODE` | `'fixed'` | fixed `word → face → incid`; `'counterbalanced'` = random of the 6 orders; recorded as `test_block_order` |
| `CONFIDENCE_RATINGS` | `false` | 1–4 after each test trial (JSON backup only) |
| `AUDIO_CHECK_EXCLUDES` | `false` | failed audio check is flagged only |
| `TIMING.*` | spec values | stranger entry 600 ms; response 900 ms; SPACE enabled 1 s after the label audio ends; auto-advance 15 s after it ends; ISI 500 ms; `FILLER1` 10 s (countdown; 15 s before v2.4.2); `FILLER2` 45 s (arithmetic) with `FILLER2_DEADLINE` 3 s per problem |
| `FILLER2_ENGAGEMENT_MIN` | `0.70` | arithmetic accuracy below this sets `filler2_low_engagement = 1` |
| `DEBUG_TIMING` | countdown 5 s, arithmetic 15 s | applied with `debug=1` |
| `DEVICE` | 1024 × 650 screen; window prompt below 1000 × 600 | small windows get a "please maximize" prompt, never a rejection |
| `AVATAR_UNFAM_K`, `AVATAR_UNFAM_K_BALD_NO_FACIAL_HAIR`, `AVATAR_UNFAM_STEP`, `AVATAR_UNFAM_COLOUR_MAX_STEPS` | 4, 5, 0.35, 2 | unfamiliar-person rule (§9 People) |
| `FOIL_K`, `FOIL_STEP` | 4, 0.35 | read only by `tools/make_foils.html`; foils are frozen in `stimuli.json` (§9 People) |
| `UNFAMILIAR_NAMES` | Jordan, Taylor, Casey, Morgan, Riley, Avery, Quinn, Jamie (+4 spares) | first one that isn't a near-match of the typed name |
| `CATEGORIES`, `NAME_INSTRUCTION`, `FAMILY_TITLES` | from UPDATES_v2 | prompt text per category (`control: null`, v2.4); titles that trigger the "first name, not a title" flag |
| `CONTROL_NAMES` | Sam, Robin, Drew, Kendall, Blake, Harper, Parker, Logan | control condition: the name the copied avatar is given (one at random; the unfamiliar person's name is then chosen as usual) |

Not built (default "off" decisions with no implementation): spoken names (`AUDIO_NAMES`) and a spoken reply from the other person.

## 7. Procedure and timing

Inside the experiment block (Qualtrics handles consent, post-test, demographics and debrief). The control category runs a
shorter setup (§20): steps 2–6b are replaced by one "Copy this avatar" screen, 7 and 7b compare with the avatar to copy,
and 10b is skipped.

| # | Screen | Section timer |
|---|---|---|
| 1 | Welcome → full screen + audio unlock (click); "please maximize" prompt if the window is under 1000 × 600 | `t_intro_ms` |
| 2 | Name entry (category prompt). Validation: 1–20 characters, letters / space / hyphen / apostrophe. Family titles are flagged (accepted on the 2nd attempt) | `t_setup_ms` |
| 3 | "How do you know [name]?" (relationship type → `is_kin`) | `t_setup_ms` |
| 4 | IOS (7 pictorial options) | `t_setup_ms` |
| 5 | Contact, two questions on one screen: in person, and other ways (texting, messaging, calls); 7 options each | `t_setup_ms` |
| 6 | Relationship duration (5 options) | `t_setup_ms` |
| 6b | Recall: "picture the last time you saw [name]" (Continue after 8 s), then three short notes (never saved, §19) | `t_recall_ms` |
| 7 | Avatar designer: "Make an avatar that looks like [name]" (6 tabs: Skin → Face → Eyes → Nose & mouth → Hair → Extras; starts from a neutral face; "Reset this section"; no randomize), with the notes in a side panel | `t_designer_ms`, `t_designer_<tab>_ms` |
| 7b | Likeness: "How much does this avatar look like [name]?" (1–7). At 4 or lower: a one-time offer to adjust the avatar, then the rating again | `t_designer_ms` |
| 7c | Confirmation: "From here on, this avatar is [name]…" (button after 3 s) | `t_binding_ms` |
| 7d | The unfamiliar person, generated from the final avatar: "This is Jordan. You haven't met Jordan before." (button after 3 s) | `t_binding_ms` |
| 7e | Avatar–name matching: 24 trials, F / J | `t_matching_ms` |
| 8 | Sound check: "window", then "garden" on a second attempt. Case and spaces ignored; one letter off accepted | `t_audio_check_ms` |
| 9 | Scene instructions: "short moments from [name]'s and Jordan's days, as they run into people they know" (surprise framing) | `t_fam_ms` |
| 10 | Filler 1: "Get ready – The first scene starts in a moment" with a countdown, 10 s (15 s before v2.4.2); the first scene then starts automatically. Then the 12 scenes, with a person check-in after scenes 3, 6 and 9 | `t_filler1_ms` (countdown), `t_fam_ms`, `t_checkin_ms` |
| 10b | "While watching the scenes, how much did the avatar feel like [name]?" (1–7) | (JSON `t_represent_ms`) |
| 11 | Filler 2: arithmetic verification (Y/N), fixed 45 s (retention delay before the tests). Each problem has a 3 s deadline shown by a shrinking bar under it; a missed deadline shows "Too slow" and counts as an error | `t_filler2_ms` |
| 12 | "Questions about the scenes" → Word (12) → Face (12) → Incidental (12), each block with a short intro | `t_test_ms` |
| 13 | "Click Continue to answer a few final questions" (data written to Qualtrics here) | |

**Scene timeline** (identical in both conditions; only the right-hand avatar and its name differ):

1. The other person is on screen, their name beneath them (`SHOW_NAME_LABEL`, default shown; `name_label=0` hides it). Both figures are turned three-quarters toward each other. The novel object sits on a low table between them, below eye level, so a look at the object reads differently from a look at the partner. The stranger slides in from the left (600 ms, small walking bob) and the other person looks at them.
2. **Greeting audio**: "Hi! Good to see you!" The stranger's mouth is amplitude-driven, with a slight head bob.
3. **Response** (900 ms): the other person smiles, raises their eyebrows, tilts their head and does a small happy bounce.
4. **Label audio**: "Look! It's a *bosa*! A *bosa*!"
   - On "Look!": the stranger looks down at the object (eyes aimed at it, upper lids lowered, head tilted about 9° toward it), and the object slides forward with a 1.05× pulse (300 ms).
   - 300 ms later, the other person's eyes follow (joint attention).
   - On "It's a *bosa*!": the stranger looks back at the other person (head level, eyes straight across).
   - On "A *bosa*!": the stranger looks back at the object.
   - The three segment onsets are found **at runtime** from the clip's two longest pauses, so new recordings need no timing files. `label_segment_source` records `pauses`, or `proportional_fallback` if fewer than two pauses were found.
5. The other person nods twice while smiling at the object. In the final frame both look at the object.
6. "Press SPACE to continue" appears **1 s after the label audio ends**. **`view_ms` = keypress time − label-audio end.** The scene auto-advances 15 s after the label audio ends (`timed_out = 1`). Then a 500 ms blank.

**Measured in debug runs** (placeholder audio, fillers shortened): one scene ≈ 7.6–8.6 s with an immediate keypress.
The real-length experiment block is about 3 min setup + 3–5 min designer and likeness (v2) + 0.5 min sound check + 0.25 min countdown +
2–4 min scenes + 1 min arithmetic (with instructions) + 3–4 min tests ≈ 12.75–17.75 min. With consent and post-test, about 17–20 min.
v2.3 adds about 2 min 40 s: recall ~40 s, confirmation and introduction ~10 s, matching ~60 s, check-ins ~40 s, the
post-scene rating ~10 s, and the revision for some participants. **Confirm with the pilot.**

**Final-frame AOIs** (stage coordinates, 0–1, `[x0, y0, x1, y1]`; also stored in the JSON backup as `aoi_norm`):
`stranger_face [0.12, 0.432, 0.29, 0.7456]`, `object [0.435, 0.6192, 0.565, 0.8272]`, `other_face [0.71, 0.432, 0.88, 0.7456]`, `incidental [0.788, 0.1344, 0.872, 0.2656]`.

**Stage scaling.** Every screen is drawn on a fixed 1000 × 625 logical canvas scaled to fit the window (letterboxed), so layout and AOIs are the same on every screen size.

## 8. Counterbalancing and randomization

- **Name text (optional factor):** to run with- and without-name versions, either
  - set `SHOW_NAME_LABEL` in `config.js` (applies to everyone), or
  - give participants `name_label=1` / `name_label=0`, for example with separate Prolific study URLs ending in `&name_label=0`, or inside the existing Qualtrics Randomizer elements (set embedded field `name_label` alongside `category` and `list`). The field is already declared in the survey flow.
  Each participant's value is recorded as `name_label_shown` (1/0) and `name_label_source` (config / override, in the JSON backup).
- **Binding steps and check-ins (optional factors, §19):** the config switches apply to everyone; `binding=0/1` and
  `checkins=0/1` (URL or embedded data; both are declared in the survey flow) override them per participant, e.g. set inside
  the Randomizer branches of a pilot copy of the survey. Recorded as `recall_enabled`, `revision_enabled`,
  `matching_enabled`, `checkins_enabled` and `steps_source` (config / override).
- **Between subjects:** `category` (4: acquaintance, moderate, close, control) × `list` (2) from the Qualtrics Randomizer (8 branches, evenly presented; repeat6 × `stranger_set`, 16). If those fields are empty (piping failure), the experiment assigns them at random and records `assign_fallback = 1` in the JSON backup.
- **Lists:** list A: scene sets s01–s06 = known, s07–s12 = unfamiliar. List B: swapped. Scene sets are matched in pairs (s01/s07, s02/s08, …) on gender presentation, apparent age and skin-tone band. So within each list, the 6 known and the 6 unfamiliar scenes each have 3 female-presenting and 3 male-presenting strangers, covering the same 6 skin tones and the same age spread (2 young, 2 middle-aged, 2 older).
- **Per participant (seeded RNG; `seed` is recorded, so every assignment can be reconstructed):**
  - incidental color per object type
  - familiarization order (pseudorandom: at most 2 consecutive scenes of the same condition, and the **last 2 scenes are one known-person and one unfamiliar-person scene**, in random order, so recency is equal across conditions). Each scene's position is recorded as `serial_position` (1–12)
  - test order within each block
  - option positions
  - word-test foils
  - which features the unfamiliar avatar changes
  - from a second random stream of the same seed (so these never shift the scene design): matching keys (`match_keymap`,
    F = match or J = match, 50/50), matching trial order, check-in question order (`checkin_order`, one of the 3 rows of a
    Latin square), and which person is asked first at each check-in (`checkin_k_first`)
- **Word-test foils:** 3 foils from the other 11 scene sets, with **at least one from each condition** (hard rule).
  - **Soft rule (as you asked):** all 4 options have different first vowels.
  - Each object is also used as a foil exactly 3 times, so foil familiarity is balanced.
  - A search finds an assignment meeting all of these. In every test run, the vowel rule was met for all 12 trials (`word_foil_vowel_relaxed = 0`). If a run ever has to relax it, the count is recorded, and each trial records `vowel_rule_met`. With 12 words in 5 vowel groups, every trial necessarily contains exactly one e-word and one i-word, so the rule only just fits.

## 9. Stimuli

`experiment/stimuli/stimuli.json` is the manifest and single source of truth (scene set → stranger and foil feature vectors, foil change,
object id, word, IPA, incidental type, voice). SVG exports of every stimulus are in `experiment/stimuli/svg/`
(`tools/stimulus_sheet.html` → "Export SVGs"). Runtime figures are drawn in code from the same renderer, so the files are for reference and figures.

### Words (final 12; stress on the first syllable in all audio)

| Word | Pronunciation | IPA | Scene set | Half |
|---|---|---|---|---|
| bosa | BOH-sah | ˈboʊ.sɑ | s01 | 1 |
| tefo | TEH-foh | ˈtɛ.foʊ | s02 | 1 |
| fiku | FEE-koo | ˈfi.ku | s03 | 1 |
| lufi | LOO-fee | ˈlu.fi | s04 | 1 |
| mavo | MAH-voh | ˈmɑ.voʊ | s05 | 1 |
| zibu | ZEE-boo | ˈzi.bu | s06 | 1 |
| daxa | DAK-sah | ˈdæk.sɑ | s07 | 2 |
| hosi | HOH-see | ˈhoʊ.si | s08 | 2 |
| pemo | PEH-moh | ˈpɛ.moʊ | s09 | 2 |
| keku | KEH-koo | ˈkɛ.ku | s10 | 2 |
| gimu | GEE-moo (hard g) | ˈɡi.mu | s11 | 2 |
| vuno | VOO-noh | ˈvu.noʊ | s12 | 2 |

**Word changes and lexicon check:**

- **Replacements:** toma → lufi, dobi → mavo, wazi → vuno, nepa → hosi.
- **Lexicon check method:** each word was run through Microsoft Word's US-English spell checker (`CheckSpelling`), plus a manual check for common names and brands.
- **Result:** 11 of the 12 words were not recognized. **"bosa" was recognized**, as a variant spelling of *boza* (a fermented drink). It is kept because it is a standard novel word in this literature (researcher decision, 2026-11-13).
- **Vowel groups:** the first-syllable onset + vowel is unique for every word. Shared first vowels are handled by the soft rule in §8.

### Incidental objects

There are 12 types, each in exactly one scene: mug, lamp, clock, bowl, picture frame, watering can, vase, book, teapot, candle, jar, bottle.
- **Colors:** Okabe–Ito colorblind-safe set: **green #009E73, orange #E69F00, blue #0072B2, pink #CC79A7**.
- **Why the spec's palette was replaced:** I checked discriminability with the Machado (2009) simulation and CIEDE2000. The spec's palette failed for deuteranopes: blue/purple had ΔE 1.9. The new set has a minimum pairwise ΔE of 10.9 (tritan), 12.2 (protan) and 15.9 (deutan).
- **Constants:** the object's position and size are the same in every scene, and only the main body takes the color.

### Novel objects

- **Originals:** bosa, daxa, tefo and gimu are the lab's original illustrations, copied verbatim.
- **New:** 8 were drawn in the same style.
- **Recognizability check:** after a first visual check, the new ones that looked like familiar things were redrawn (a party hat, a ring-stacking toy, a flower, a hand fan, an hourglass).
- **Still to do:** a quick naming check in the pilot ("does this look like anything you know?") is worthwhile.

### People (v2 avatars)

Designed and reviewed in `design/avatar_style_sheet.html` (shading levels, rules, strangers, foils, scene preview).

- **Renderer** (`js/people.js`): shaded parametric busts ("Level 2": soft light from the upper left, eye and lip highlights), one renderer for the designer, scenes and face test. A figure's static part is computed once and cached; animation redraws only eyes, brows and mouth.
- **Feature contrast across skin tones:** every facial feature is coloured relative to the skin it sits on (CIELAB lightness difference, dL*), so nothing is masked on darker or lighter skin: mouth seam dL* 24, eyes near-black, brows ≥ 25 and facial hair ≥ 22 (dark or brown hair is only ever pushed darker), age lines 10 / 13, stubble 6. A skin-coloured halo keeps the mouth separate from a dark mustache.
- **Animation:** gaze (eyes aimed at the actual target; upper lids lower when looking down), head roll and nod, a three-quarter turn toward the partner (features shift ~9% of face width; far eye and far side narrow), amplitude-driven mouth, smile, brow raise, bounce. Test faces are front-facing.
- **Designer** (`js/designer.js`): 6 tabs in a fixed order, 16 sliders:
  - Skin: 2-D picker (lightness × undertone: cool, neutral, warm, olive)
  - Face: width, jaw / chin; age (young / middle-aged / older)
  - Eyes: lid type (visible crease / hooded / monolid; eye opening identical for all three), size, tilt, spacing, iris colour (6), brow thickness, brow shape
  - Nose & mouth: nose width, length, lip fullness, mouth width
  - Hair: texture (straight / wavy / curly / coily), length (short / medium / long), style within those, colour (continuous natural scale), grey (range depends on age)
  - Extras: head covering (none / hijab / turban, with colour), facial hair (5), glasses (3), freckles, shirt colour
  - Slider ranges cover ordinary adult variation only; no option is tied to skin tone or group.
- **Hair styles** (16): buzz, bald / receding, short crop, side part, short curls, short coils, **bob**, bob with bangs,
  shoulder length, curls / coils medium, afro, bun / puff, long, curls long, braids, locs (each offered only for the textures
  and lengths it fits).
- **Curly and coily hair (redrawn in v2.3 after feedback that the coily hair looked unnatural).** v2.2 drew these styles as a
  flat shape edged with a ring of identical small circles, which read as a beaded sticker. Now:
  - the outline is built from clustered curls at two scales (larger clumps with finer curls on them), each cluster a
    different size, so the silhouette reads as hair (`curlEdge`, `clumpEdge`);
  - inside the mass, overlapping curl clusters each get a shadow crescent below and, on most, a highlight above, giving the
    bumpy volume of real curls; coily hair has smaller, denser clusters plus fine coils, curly hair larger ringlet clusters
    (`hairTexture`);
  - shapes were reworked: the afro and puff are slightly uneven rounds (`lumpy`) shaded toward the bottom; medium curls / coils
    are fullest at the temples; hairlines are soft and slightly uneven; a textured full beard gets the same edge and texture.
  - Affects short coils, short curls, curls / coils medium, afro, puff (curly / coily bun), curls long and textured full
    beards, at every size (locs and braids: next item). Everything is seeded, so a given avatar always looks the same.
- **Bob (redrawn in v2.3 after feedback that it was small and cartoonish):** fuller and longer (to the chin, full at the
  sides, rounded crown), with the ends curving in toward the jaw instead of a flat edge; strands, a sheen across the crown, and
  a soft, uneven fringe with separations. A **bob without bangs** (side part, hair swept across the forehead) was added. Both
  come in straight and wavy.
- **Locs and braids (redrawn in v2.3):** v2.2 drew them as thin, even tubes at the sides of a flat cap with lines on it and
  a flat dark block behind. Now each loc or braid is its own rope with an outline, a highlight on the lit side and a slight
  tone variation: locs thick and uneven in width with knobbly texture and small coils; braids even, with a plait pattern
  and parted sections at the part. From a centre part they cover the scalp, frame the face, hang densely behind the neck
  and shoulders (ends hidden behind the body) and fall in front of the shoulders: locs to the shoulders, braids to the chest.
  A full hair volume in a deeper shade of the hair colour sits behind the ropes, so the hair reads as full rather than as
  separate strands with gaps. Under 9 ms to draw (the designer redraws on every change); about 210 KB (locs) and 260 KB
  (braids) of SVG per figure.
- **Every other style (redrawn in v2.3, after a check of the styles not yet changed):**
  - **Buzz:** close-cropped with skin showing through, a fine grain that matches the hair type (a stipple for curly and
    coily hair, short strokes for straight and wavy) and a soft hairline. A coily and a straight buzz now look different.
  - **Bald / receding:** a tapered fringe on the temples and a rim of hair behind the ears (the ears stay in front of it),
    instead of two flat patches; a soft sheen on the scalp.
  - **Short crop and side part:** short strands growing from the crown (crop) or combed away from the part (side part),
    and soft hairlines; the side part's fringe ends in soft tips instead of a hard diagonal cut.
  - **Shoulder length and long:** the ends finish in soft, uneven tips with rounded corners (no square-cut shelf), strands
    follow the hair down from the crown, and there is sheen down each side.
  - **Facial hair:** stubble is a light tint with a fine stipple and a broken edge; short and full beards on straight / wavy
    hair have hair strokes growing down and a softly broken edge; the mustache has strokes growing out from the centre.
    (`grain` in `js/people.js`.)
  - **Hijab:** a folded edge framing the face, fabric gathering under the chin with a soft shadow, folds falling from the
    sides of the head over the shoulders, and a slightly narrower drape. Its drape hangs under gravity in the look at the
    object, like long hair (24 fade steps, because it is wide).
  - **Turban:** layered wraps rising from the sides and meeting at the front in V-shaped pleats, each with a shadowed fold
    and a lit edge.
  - Now every stranger and foil is drawn at the same level of detail. Draw time is under 10 ms for every style; the
    largest drawings are braids and locs (about 270 and 220 KB of SVG).
- **Straight / wavy bun (redrawn in v2.3; it was a flat circle on a plain cap):** a fuller, slightly flattened bun with wrap
  lines spiralling round it, shading underneath and a highlight, a band where it meets the head, and the hair combed back
  with strands that sweep up from a softly uneven hairline and fade over the crown (gently waving for wavy hair).
- **Wisps on updos (v2.3.2, from collaborator feedback that the updo looked too neat):** the straight / wavy bun has
  loose tendrils at each temple in front of the ear (longer on one side), fine strands lifting off the head and the bun in
  soft loops that break the outline, and baby hairs along the hairline. The puff has stray curls / coils standing out
  round its edge (tiny loops for coily hair, single curls for curly) and a small loose curl at each temple. The wisps are
  part of the head drawing, so they turn and tilt with it. No stranger wears a bun or puff, so the stimulus files are
  unchanged; this affects participants who pick these styles for the known person (and so that person's unfamiliar
  match).
- **Hair in motion (v2.3):** in the scenes the head tilts toward the object (about 9°) and drops slightly. Before v2.3 all
  hair turned with the head as one rigid piece, so long hair, locs and braids swung their ends sideways, and the strands in
  front of the shoulders didn't move at all. Now short and rounded styles still move rigidly, but hair that hangs below the
  jaw (shoulder length, long, long curls, locs, braids, and slightly the bobs and medium curls) is drawn in horizontal bands
  (`HANG`, `hangBands`, `hairLayer` in `js/people.js`): above the jaw it turns with the head; the turn then fades out over 12
  steps, so the ends hang straight down and only move along with the head (sideways shift and drop). The strands in front of
  the shoulders follow the same rule. In the scenes (`cacheHair`) every hair layer is shown as a **bitmap**: it is drawn
  once onto a canvas as a PNG (3.5 px per unit, x the screen's pixel ratio, up to 7) and the bands show that picture
  (`layerImage`, `prerender`). The bitmaps for every scene are started during the scene instructions, and each scene waits
  (at most 2.5 s) for its own two figures, so after a reload they are rebuilt before the scene starts. Until a bitmap is
  ready the layer is shown as an SVG image and swapped in place; if a browser refuses the canvas, the SVG image stays.
  History: v2.3.0 drew the hair's paths in every band, and v2.3.1 drew them into an SVG image; the browser still replayed
  every path on every frame in both, so scenes with braids or locs lagged. Measured with two locs figures turning
  (the s05 / "mavo" stranger): 5.7 frames per second drawn as vectors, 54.5 as bitmaps (v2.3.3). Still pictures
  (designer, tests) keep the plain paths. `tools/hair_motion.html` loops every style through the scenes' own look at the partner
  and at the object, as the stranger and as the known / unfamiliar person.
- **Review page:** `tools/hair_review.html` shows every changed style old (v2.2, from `tools/legacy/people_v2.2.js`) beside
  new, across five skin-tone / hair-colour combinations, at designer and scene size. **These drawings still need sign-off
  from people who wear these styles before launch (§16).**
- **Strangers affected:** all 12 strangers and their foils (their IDs and feature vectors are unchanged; only the drawing
  changed). The SVG exports in
  `stimuli/svg/` were regenerated. Face-test difficulty could shift slightly: check it in the pilot.
- **Shirt palettes:** the designer's shirt colours and the stranger shirt colours are disjoint palettes.
- **Unfamiliar person** (`js/avatar_rules.js`, seeded by the participant `seed`):
  - **Copies** skin lightness and undertone, age and grey, lid type, iris colour, freckles, hair texture and length, head covering, facial hair present / absent.
  - **Moves** `AVATAR_UNFAM_K` = 4 random identity sliders (face width, jaw, eye size / tilt / spacing, nose width / length, lip fullness, mouth width, brow thickness / shape) by ±`AVATAR_UNFAM_STEP` = 0.35, flipping direction at a bound.
  - **3 categorical changes**, each visible at scene size: a hair style from the similar-style list (same length and texture; long straight / wavy hair may go to shoulder length; bob, bob with bangs and shoulder length are similar to each other), a different shirt colour (always), and either a hair-colour change of 1–2 steps on the natural scale (black – dark brown – brown – light brown – blonde, auburn next to brown; never when grey would hide it) or glasses added / removed.
  - Special cases: head covering → covering colour + shirt + glasses; bald with facial hair → facial-hair style (stays present) + shirt + glasses; bald without facial hair → shirt + glasses + a 5th identity slider.
- **Strangers and foils:** 12 strangers (`stimuli.json`) keep the IDs, gender presentation, ages and skin-tone bands of v1, so the matched pairs, list balancing and recorded voices are unchanged. They span all three lid types and all four hair textures; none wears a head covering.
  - Each foil keeps its stranger's group features, clothing and glasses, moves `FOIL_K` = 4 identity sliders by `FOIL_STEP` = 0.35, and makes one hand-picked hair change (`foil_change`): a similar style or a one-step colour change.
  - Foil rules (checked by `tools/make_foils.html`, which refuses to save otherwise): every new style or colour is also worn by a stranger; each target style is used by at most 2 foils; 6 style and 6 colour changes, 3 of each per half and per gender; style targets from the similar-style list; colour changes one step and never on grey hair.
  - Foils are frozen in the file so every participant sees the same faces. To change difficulty: edit `FOIL_STEP`, open `tools/make_foils.html` through the dev server, save, bump `VERSION`, redeploy.

## 10. Audio

The audio is generated with **ElevenLabs** (Starter plan; model `eleven_v4`). The manifest's `source` column records the model, voice and take for every clip. The earlier Windows text-to-speech placeholders can still be rebuilt with `tools/make_placeholder_audio.py`, which sets `is_placeholder = 1`.

### 10.1 ElevenLabs workflow (`tools/elevenlabs_tts.py`)

- **API key:** read from `ELEVENLABS_API_KEY` or `%USERPROFILE%\.elevenlabs_api_key`, outside the repo. It is only ever sent in the `xi-api-key` header. Permissions needed: Text to Speech, Voices (read), Models (read). Add Speech to Text if you want automatic transcription checks.
- **Casting:** `experiment/audio/voice_casting.json` maps each speaker to an ElevenLabs voice, matched on gender and age. On a paid plan, Voice Library voices are used directly by ID and take no voice slots; the free plan refuses them through the API.

  | Speaker | Wanted | Voice |
  |---|---|---|
  | str01 / str07 | female, young | Sarah / Jessica |
  | str02 / str08 | male, young | Will / Liam |
  | str03 / str09 | female, middle-aged | Bella / Adeline (library) |
  | str04 / str10 | male, middle-aged | Chris / Eric |
  | str05 / str11 | female, older | Carol / Julie (library) |
  | str06 / str12 | male, older | Bill / Marv (library) |
  | narrator | female, middle-aged | Matilda |

- **Steps:**
  1. `python tools/elevenlabs_tts.py generate --takes 3` writes `audio_src/elevenlabs/takes/` (git-ignored). Novel words are sent as inline IPA, e.g. `It's a /ˈboʊsɑ/!`. Pauses come from punctuation ("Look! ... It's a … ! ... A … !") because v4 has no `<break>` tag.
  2. `python tools/audio_qc.py` checks every take's duration and pause structure (the same detector the gaze timing uses) and writes a suggested selection.
  3. Open `http://localhost:8001/tools/audio_review.html` (with `python tools/dev_server.py 8001`). Listen, choose one take per clip, tick "needs regeneration" for bad ones, and click **Save selection**.
  4. Regenerate flagged clips with `generate --only <clip_ids> --force`. If v4 keeps mispronouncing a word, add `--model-for-words eleven_flash_v2`, which uses exact SSML `<phoneme>` tags.
  5. `python tools/elevenlabs_tts.py finalize` copies the chosen takes and runs `normalize_audio.py`, writing to `experiment/audio/`. Then commit and push.
- **Pronunciation check is by ear.** ElevenLabs says inline IPA "can still vary by voice and phrase", which is why there are 3 takes per clip. Make sure each word sounds the same from the stranger and from the narrator (stress on the first syllable).

### 10.2 General

- **Recording script:** `experiment/audio/audio_manifest.csv`, 58 clips (51 for unique12 + 7 label clips used only by repeat6, §18). Columns: `clip_id, speaker_id, speaker_gender, speaker_age, text, pronunciation, file, duration_ms, is_placeholder, ipa, stress, notes`. It contains:
  - per stranger (12 voices): `greet_sXX` ("Hi! Good to see you!") and `label_sXX` ("Look! It's a X! A X!")
  - narrator: `test_word_<word>`, `test_face`, `test_incid_<type>`, and `check_window` / `check_garden`
- **Swapping in human recordings** (optional):
  1. Record each clip and name it `<clip_id>.wav` (any format ffmpeg reads).
  2. Run `python tools/normalize_audio.py --src path/to/recordings`. It trims leading and trailing silence, normalizes to −16 LUFS integrated (iterating so the −1 dBFS limiter doesn't leave clips quiet), resamples to 44.1 kHz mono, writes MP3 + OGG over the old files, and updates `duration_ms` and `is_placeholder = 0` in the manifest.
  3. Nothing else changes. Lip-sync is computed from each file's amplitude envelope at load time, and the gaze timing comes from the label clip's two longest pauses.
- **Recording requirement:** label clips need a clear pause (≥ 100 ms, ideally 300–500 ms) after "Look!" and after the first "It's a X!".
- **Loudness:** every clip is normalized to −16 LUFS (within about 0.8 LU).
- **Playback:** all audio is preloaded with the Web Audio API before the study starts, and playback starts only after the participant's first click ("Start"). If audio can't play, the timeline still runs on the clip durations, and `audio_simulated_scenes` counts those scenes.

## 11. Data saving

- **Primary:** Qualtrics embedded data, set by `js/data.js` when the participant finishes the JS block.
  - Wide participant / familiarization / test fields (§13).
  - The complete trial-level JSON, split across `full_data_json_1..4`.
- **Secondary backup: DataPipe → OSF**, fully incremental. Saves happen after familiarization + filler 2, after each test block, and at the end. To set it up:
  1. Create an OSF project and component, and an OSF token.
  2. At pipe.jspsych.org, create an experiment, connect the component, and **enable data collection**. Condition assignment is not used; the Qualtrics Randomizer does it.
  3. Put the experiment ID in `DATAPIPE.EXPERIMENT_ID`.
  4. Files are named `<PROLIFIC_PID>_<ResponseID>_<stage>.json`.
- **Local / debug:** the jsPsych trial CSV and the field JSON are downloaded, or written into `sample_data/` with `devsave=1`.

## 12. Reshaping the Qualtrics export

Export from Qualtrics: **CSV, "Use numeric values"**. Then:

```bash
python analysis/reshape_qualtrics.py export.csv -o long.csv
```

- **Both versions:** each row is read with the field lists of its `design_version` (blank = unique12). repeat6 adds `presentation`, `lag` and `serial_position_2` (§18). Run the script once per survey export.
- **Output:** one row per trial. Participant columns are repeated on every row; then `phase` (familiarization / test), the trial fields, and the model coding:
  - `k` = closeness: IOS − 1 for known scenes, 0 for unfamiliar
  - `f` = `target` (word, face) or `incidental`
  - `correct`
- **Default filters:** participants with `reloaded_post_fam = 1` and debug runs are dropped. Use `--include-incomplete` / `--include-debug` to keep them.
- **Cross-check:** the script also reassembles `full_data_json_*` and checks every test trial against the wide fields.
- **Tested on:** `sample_data/mock_qualtrics_export.csv`, a fake export with real Qualtrics' 3-row header built from two debug runs by `tools/make_mock_export.py`. Its output is `sample_data/sample_long_format.csv`.
- **R:** not provided. R isn't installed on the build machine, so an R version couldn't be checked for identical output.

## 13. Data dictionary

### Qualtrics native / survey fields

| Field | Meaning |
|---|---|
| `PROLIFIC_PID`, `STUDY_ID`, `SESSION_ID` | from the Prolific URL |
| `debug` | `1` if the URL had `debug=1` (set by the URL) |
| `name_label` | `0`/`1` if set by the URL or survey flow (blank = use `SHOW_NAME_LABEL`, default shown) |
| `category`, `list` | set by the Randomizer (also written back by the experiment) |
| `device_ok`, `device_reason`, `device_screen`, `device_window`, `device_pointer` | device check before consent (`reason`: mobile / small_screen; `device_pointer` records `any-pointer: fine`, hover and touch points but no longer screens anyone out, because a MacBook trackpad was reported as no fine pointer; `device_screen` e.g. `1366x768 px (1093x614 at scale 1.25)`) |
| `consent` | 1 = agree, 2 = do not agree |
| `expected_test` | 1 Yes, 2 No, 3 Not sure |
| `strategy`, `tech_problems` | free text |
| `exp_easy`, `exp_sound` | 1–5 (strongly disagree → strongly agree) |
| `attention_check_1` | correct = **1** (Strongly disagree) |
| `attention_check_2` | correct = **4** (Somewhat agree) |
| `age`, `gender` (+ `gender_4_TEXT`) | demographics |
| `StartDate`, `EndDate`, `Duration (in seconds)` | Qualtrics timing (consent time ≈ `js_start_epoch_ms` − StartDate; post-test time ≈ EndDate − `js_end_epoch_ms`) |

### Participant-level fields written by the experiment

| Field | Meaning |
|---|---|
| `category` | acquaintance / moderate / close / control |
| `list` | A / B |
| `relationship_type` | Friend / Parent / Sibling / Grandparent / Other relative / Coworker or classmate / Neighbor / Other |
| `is_kin` | 1 if Parent, Sibling, Grandparent or Other relative |
| `ios` | 1–7 (Inclusion of Other in the Self) |
| `contact_inperson`, `contact_remote` | 1–7: how often they see the person in person / talk in other ways (7 = every day or almost, 6 = a few times a week, 5 = about once a week, 4 = a few times a month, 3 = about once a month, 2 = a few times a year, 1 = less than once a year) |
| `contact_max` | the higher of the two |
| `contact_freq` | before v2.3 only: the single question (text) |
| `duration` | Less than 1 year … More than 10 years (text) |
| `name_length` | characters in the typed name (the name itself is never stored) |
| `name_flagged_title` | 1 if the first entry matched a family title (e.g. "Mom") |
| `name_suspect` | 1 if the name looks like a non-name (no vowels, "asdf", repeated letters…) |
| `known_avatar`, `unfamiliar_avatar` | feature vectors `key=value;…` in the order of `FEATURE_KEYS` (js/people.js); sliders 0–1 to 2 decimals. `reshape_qualtrics.py` unpacks them into `known_<key>` / `unfam_<key>` columns |
| `unfam_changes` | the unfamiliar person's categorical changes, `feature:from>to`, `|`-separated |
| `unfam_k`, `unfam_identity_dist` | identity sliders moved (4, or 5 when bald without facial hair) and their Euclidean distance |
| `likeness_rating`, `likeness_rt_ms` | "How much does this avatar look like [name]?" 1–7 (control: "How much does your avatar look like the one you copied?"): the **final** rating (after any revision), and the first rating's response time |
| `likeness_1`, `likeness_2` | first rating; rating after the revision (blank if not revised) |
| `revision_offered`, `revised` | 1 if the revision was offered (first rating ≤ 4) / taken; blank when `REVISION_ENABLED` is off |
| `designer_ms_2`, `designer_edits_2` | time and edits in the revision visit |
| `recall_ms`, `recall_chars_1..3` | time on the two recall screens; characters typed in each note (the notes themselves are never stored) |
| `confirm_ms`, `jordan_intro_ms` | time on the confirmation screen and on the unfamiliar person's introduction |
| `match_keymap` | `F=match` or `J=match` |
| `match_acc_<type>`, `match_rt_med_<type>` | matching accuracy (timeouts count as errors) and median RT on correct trials, for `kk` (known avatar + known name), `uu`, `ku` (known avatar + Jordan), `uk` |
| `match_acc_total`, `match_n_timeout`, `match_flag` | overall accuracy; trials with no response within 2.5 s; 1 if accuracy < 0.75 (flag only) |
| `checkin_order` | the 3 questions in order, e.g. `feel>evening>dayoff` |
| `checkin_k_qid`, `checkin_k_first`, `checkin_k_after_trial` | check-in k = 1–3: question (`feel` / `evening` / `dayoff`), who was asked first (known / unfamiliar), the scene it followed |
| `checkin_k_known_resp`, `checkin_k_known_rt_ms`, `checkin_k_unf_resp`, `checkin_k_unf_rt_ms` | the option chosen (text) and response time, for each person |
| `represent_rating`, `represent_rt_ms` | "While watching the scenes, how much did the avatar feel like [name]?" 1–7 (blank in control) |
| `recall_enabled`, `revision_enabled`, `matching_enabled`, `checkins_enabled`, `steps_source` | which optional steps ran (1/0) and whether that came from config or a `binding` / `checkins` override |
| `designer_edits`, `designer_resets`, `designer_tabs_visited` | designer edits (a released slider or a clicked option), section resets, sections opened (of 6) |
| `designer_edits_<tab>`, `t_designer_<tab>_ms` | per section: skin, face, eyes, nosemouth, hair, extras |
| `unfamiliar_name` | name shown under the unfamiliar person |
| `control_name` | control only: the name given to the copied avatar (from `CONTROL_NAMES`; not personal, so it is recorded) |
| `target_avatar` | control only: the random avatar to copy (feature string like `known_avatar`, which holds the participant's copy) |
| `copy_intro_ms` | control only: time on the "Copy this avatar" screen |
| `copy_err_1`, `copy_n_miss_1`, `copy_miss_1` | control only, after the first designer visit: mean absolute difference from the target over the 16 sliders (0–1), the number of categorical features that differ, and which ones (`age\|lid\|iris\|texture\|length\|hairStyle\|facial\|glasses\|covering`) |
| `copy_err`, `copy_n_miss`, `copy_miss` | the same for the final avatar (after a revision, if taken) |
| `audio_check_pass` | 1 if either check word was typed correctly (one letter off accepted) |
| `audio_check_attempts` | 1–2 |
| `filler2_accuracy` | arithmetic accuracy = correct / attempted (missed deadlines count as errors) |
| `filler2_n_attempted` | problems attempted: answered or timed out (a problem cut off by the end of the 45 s is not counted) |
| `filler2_n_timeout` | problems not answered within the 3 s deadline (answered = attempted − timeout) |
| `filler2_low_engagement` | 1 if `filler2_accuracy` < `FILLER2_ENGAGEMENT_MIN` (0.70), or nothing was attempted |
| `fam_fast_advance_count` | scenes advanced within 300 ms of SPACE being enabled |
| `fam_timeout_count` | scenes that auto-advanced |
| `fullscreen_exits`, `tab_switches` | counts during the JS block (timestamps are in the JSON `events`) |
| `total_ms` | duration of the JS block |
| `test_block_order` | e.g. `word>face>incid` |
| `reload_pre_fam` | reloads before familiarization (participant restarted the block) |
| `reloaded_post_fam` | 1 if reloaded during or after familiarization → **exclude** |
| `reload_stage` | stage at that reload (fam / post_fam / test / done) |
| `t_intro_ms` … `t_test_ms` | time per section (§7 table): intro, setup, recall, designer, binding, matching, audio_check, filler1, fam, checkin, filler2, test |
| `js_start_epoch_ms`, `js_end_epoch_ms` | Unix ms at the start and end of the JS block |
| `design_version` | `unique12` / `repeat6` |
| `design_version_source` | `qsf` (the survey passed it), `url` (local run) or `config_fallback` (nothing passed: check that survey) |
| `stranger_set` | repeat6 only: X / Y |
| `exp_version`, `qualtrics_engine`, `surprise_test`, `mouseview_on`, `debug`, `seed` | run settings (`seed` reproduces every randomization) |
| `name_label_shown` | 1 = name text shown beneath the person in scenes, 0 = hidden |
| `browser`, `screen_w`, `screen_h`, `window_w`, `window_h`, `window_small_prompt` | display info |
| `audio_load_errors` | clips that failed to load (0 expected) |
| `audio_simulated_scenes` | scenes where audio could not play |
| `word_foil_vowel_relaxed` | word trials where the first-vowel rule had to be relaxed |
| `js_error` | first JS error message, if any |
| `full_data_json_1..4`, `full_data_json_n`, `full_data_json_truncated` | complete JSON backup in chunks; total length; 1 if it didn't fit |

### Familiarization fields: `fam_XX_*`, XX = 01–12 in presentation order

| Suffix | Meaning |
|---|---|
| `scene_set_id` | s01–s12 |
| `serial_position` | 1–12, the same as XX (stated explicitly for analysis; the reshape script also puts it on every test row of that scene set) |
| `condition` | known / unfamiliar |
| `stranger_id` | str01–str12 |
| `word` | novel word |
| `incidental_type`, `incidental_color` | incidental object and its color (green / orange / blue / pink) |
| `view_ms` | **viewing time: label-audio end → SPACE** (≥ 1000 by design; 15000 if timed out) |
| `timed_out` | 1 if auto-advanced |
| `label_audio_ms` | duration of the label clip (total scene time ≈ entry + greeting + response + label + view) |

### Test fields: `test_<type>_<scene_set_id>_*`, type = word / face / incid

| Suffix | Meaning |
|---|---|
| `choice` | chosen option: object id (word), stranger/foil id (face), color (incid) |
| `correct` | 0/1 |
| `rt_ms` | option onset → click |
| `foils` | foil ids, `|`-separated (word: 3 objects; face: the foil; incid: the 3 other colors) |
| `position` | **target's** position (1-based, left to right) |

The JSON backup (`full_data_json_*`) adds, per test trial:
- `response_position`, `option_order`, `foil_conditions`, `foil_scene_sets`
- `responded_before_prompt_end`, `vowel_rule_met`, `block_index`, `confidence`, `serial_position` (the scene set's familiarization position)

and per scene:
- `greet_audio_ms`, `label_segments_s`, `label_segment_source`, `audio_simulated`, `scene_total_ms`
- `dwell_*_ms` (MouseView)

It also has every arithmetic trial (`filler2`: equation, truth, response, `timed_out`, `correct`, `rt_ms`), all fullscreen and visibility events with timestamps (`events`), and the design
(`fam_order`, `incidental_colors`, `aoi_norm`, `assign_fallback`, `finish_reason`).

### Long format (output of `reshape_qualtrics.py`)

The participant columns above, plus:
- `phase`, `trial_index`, `serial_position` (familiarization position of the scene set), `scene_set_id`, `condition`, `stranger_id`, `word`, `incidental_type`, `incidental_color`
- familiarization rows: `viewing_time_ms`, `timed_out`, `label_audio_ms`
- test rows: `test_type`, `target_id`, `foil_ids`, `target_position`, `response_id_choice`, `correct`, `rt_ms`
- model coding: `k` (closeness: IOS − 1 for known, 0 for unfamiliar) and `f` (target / incidental)

## 14. Data quality and exclusion support

These are recorded, not enforced: the preregistered rules decide.

- **Attention checks:** `attention_check_1` (should be 1) and `attention_check_2` (should be 4).
- **Engagement:** `filler2_low_engagement` = 1 (`filler2_accuracy` < 0.70; missed 3 s deadlines count as errors). See `filler2_n_attempted` and `filler2_n_timeout` too.
- **Familiarization:** `fam_fast_advance_count` > 6 or many `fam_timeout_count`.
- **Display:** `fullscreen_exits`, `tab_switches` (with timestamps in the JSON).
- **Name:** `name_flagged_title`, `name_suspect`.
- **Audio:** `audio_check_pass`, `audio_load_errors`, `audio_simulated_scenes`.
- **Reloads:** `reloaded_post_fam` → exclude; `reload_pre_fam` → keep, but note it.
- **Manipulation check:** IOS by `category` (not asked in control).
- **Control (v2.4):** `copy_err`, `copy_n_miss` and `likeness_rating` show how carefully the avatar was copied. Flags only.
- **Binding (v2.3):** `match_flag` (matching accuracy < 75%), `likeness_rating`, `represent_rating`. Flags only.

## 15. Privacy

- **The typed name never leaves the browser.** It lives only in memory and is shown on screen.
  - It is not in any data field, the JSON backup, DataPipe, localStorage or the jsPsych data.
  - The name input has no `name` attribute, so the Qualtrics form can't submit it.
- **The recall notes (v2.3) never leave the browser either**, as the screen promises ("These notes stay in your browser, help
  you build the avatar, and are never saved or sent anywhere"):
  - They are held in one variable (`S.notes`) while the participant builds the avatar, shown in the designer's side panel,
    and set to `null` as soon as the last designer visit is over (after the revision, if one was taken).
  - Only their lengths are recorded (`recall_chars_1..3`). Nothing writes them to embedded data, the JSON backup, DataPipe,
    the jsPsych data or localStorage.
  - The text boxes have `spellcheck="false"` (some browsers' enhanced spell check sends typed text to a server) and
    `autocomplete="off"`, and are emptied when the page moves on. A reload during setup starts setup again, so the notes
    are simply gone.
- **Test: `tools/privacy_check.html`** (through the dev server; `?design=repeat6` or `unique12`, `&prototype=1`). It runs one
  full automatic session of the real code in Qualtrics mode, with a stand-in for `Qualtrics.SurveyEngine` that records every
  embedded-data value. The autopilot types a random made-up name and random made-up notes. The page then searches, for the
  name, each whole note and the random words in it: every embedded-data field name and value (including `full_data_json`),
  the full JSON backup (what DataPipe sends), the jsPsych trial data, localStorage, sessionStorage, cookies, every network
  request made during the run, and the page DOM; and checks that the notes are gone from the experiment's memory. It must
  find nothing. Result on 2026-11-18, both versions with Prototype.js: passed (details in §19).
- **Control condition (v2.4):** nothing is typed. The assigned name is not personal and is recorded (`control_name`).
- **No photo uploads.** The person is represented only by the designer avatar.
- **localStorage** holds only `{stage, reload_pre_fam}` under a key built from PROLIFIC_PID + STUDY_ID.
- **External calls:** no third-party analytics. The only external requests are to GitHub Pages (code and audio) and, if enabled, DataPipe.

## 16. What the researcher still needs to supply

- [ ] IRB-approved **consent** and **debrief** text (placeholders in the .qsf); confirm the **demographics** list.
- [ ] Prolific **completion code** and **screen-out code** (`config.js` + rebuild the .qsf).
- [ ] **GitHub repo** name → base URL → rebuild the .qsf (§3).
- [ ] **DataPipe** experiment ID + OSF component (§11).
- [ ] Confirm **custom JavaScript** is enabled on Harvard's Qualtrics (§4.1).
- [ ] **Approve the ElevenLabs audio**: listen to every clip in `tools/audio_review.html`, especially the 12 novel words from both stranger and narrator (§10.1).
- [ ] **Avatar review**: as suggested in the style sheet, have a few people from the communities represented look at the designer (`tools/designer_preview.html`) and the strangers (`tools/stimulus_sheet.html`) before launch. In particular, sign off on every redrawn hair style, the facial hair, and the hijab and turban in `tools/hair_review.html` (old vs. new); the hijab and turban are best reviewed by people who wear them.
- [ ] **Consent text**: keep the sentence about the avatar, the typed name and notes ("…Any name and notes you type are not saved.") in the IRB version. It now covers the control condition too (§20); the IRB amendment needs to add the control arm.
- [ ] **Payment**, after the pilot measures the median duration.
- [ ] **Pilot (~20 participants)**: check that face and word accuracy fall around 65–75% and incidental accuracy is above 25% but not near ceiling. Tuning knobs:
  - foil similarity (`FOIL_STEP` in config.js → `tools/make_foils.html` → redeploy)
  - filler length (`TIMING.FILLER1/2`)
  - auto-advance time
  - number of word tokens in the label clip

## 17. Known limitations and untested paths

- **The .qsf has not been imported into a real Qualtrics account.** It was generated by script from the QSF format as I know it. Survey options such as the layout theme may not carry over, so use the checklist in §4.3.
- **The NSTE engine path is untested** (§4.5).
- **Browser testing so far:** the full study was run end to end in the Claude desktop app's Chromium-based browser (autopilot runs, reload tests, layout checks). It has not yet been tried in Firefox or Safari. Safari decodes the MP3 files; OGG is the fallback.
- **MouseView** is implemented (blur mask + AOI dwell) but was not part of the end-to-end tests.
- **Prototype.js:** Qualtrics' classic layouts load Prototype.js 1.7.1, which replaces several built-ins with older versions: `Array.from` (ignores a mapping function), `Array.prototype.map / find / every / some / entries / reverse`, `Object.values`, `String.prototype.startsWith / endsWith`. In v2.0.0, `Array.from(…, fn)` crashed the study right after the avatar designer inside Qualtrics (fixed in v2.0.1 with plain loops). Serialization goes through `SRL.data.stringify`, which removes Prototype's `toJSON` for the call. **Before every deploy, run a full autopilot with `prototype=1`** (§2), which loads the real Prototype 1.7.1 first.
- **The experiment draws over the Qualtrics page** as a full-window overlay (`z-index` max), so Qualtrics theme CSS can't distort it. Qualtrics' own header and footer are hidden underneath until the participant clicks Continue.
- **Synthetic voices:** ElevenLabs audio is far more natural than the old placeholders, but novel-word pronunciation via inline IPA can vary between takes. It is checked by ear, not automatically. Check ElevenLabs' current terms for how the generated audio may be used and credited in publications.
- **Gaze direction:** eyes and head are aimed at the actual target, and the object sits below eye level so object looks and partner looks differ. It reads clearly in still frames and the style-sheet preview, but it's worth a look in the pilot.
- **Designer duration:** the v2 designer is longer than v1; the 20-minute estimate is a guess until the pilot (`t_designer_ms`, `t_designer_<tab>_ms`).
- **v2 has not been loaded from GitHub Pages yet** (it was built on the `avatar-v2` branch and tested locally); run `tools/remote_load_test.html` after merging and deploying.

## 18. Repeat6 version (6 scene sets, each shown twice)

A second study built from the same code. Everything not listed here is identical to unique12: avatar designer, unfamiliar
person, audio and animation, fillers (10 s countdown since v2.4.2, 45 s arithmetic), post-test, device check, Qualtrics / Prolific
setup. Spec: `REPEAT6_VERSION.md` (with the decisions made on 2026-11-17).

### 18.1 Version switch

- Each .qsf sets the embedded field `design_version` (`unique12` or `repeat6`) in its first flow element and passes it to
  the experiment. `DESIGN_VERSION` in config.js is only the fallback (both studies load the same files from GitHub Pages).
- Recorded: `design_version`, and `design_version_source` = `qsf` / `url` / `config_fallback`. A survey that doesn't pass
  the version shows up as `config_fallback`.
- Build / rebuild the survey: `python tools/build_qsf.py --design repeat6` → `qualtrics/repeat6/` (survey.qsf, the two
  question JS files, embedded_data_fields.txt: 327 fields). Import it as its own survey; setup is the same as §4, except the
  randomizer has **12** elements and the preview test field is `test_word_ss1_correct`.

### 18.2 Scene sets (`stimuli/stimuli_repeat6.json`)

| Scene set | Word | Object drawing | Incidental | List A | List B |
|---|---|---|---|---|---|
| ss1 | bosa | bosa | mug | known | unfamiliar |
| ss2 | daxa | daxa | vase | unfamiliar | known |
| ss3 | lufi | **cube** (unique12's "zibu" drawing) | lamp | known | unfamiliar |
| ss4 | tefo | tefo | clock | unfamiliar | known |
| ss5 | mavo | **teal blob with antennae** (unique12's "fiku" drawing) | book | known | unfamiliar |
| ss6 | gimu | gimu | candle | unfamiliar | known |

- lufi and mavo use the two drawings most different from the four kept objects and from each other (chosen in
  `design/repeat6_objects.html`). In the data, `object_id` names the drawing shown (`obj_zibu`, `obj_fiku`); `word` names the label.
- Incidental colour: random per participant (as in unique12), one colour per scene set, so both showings match.

### 18.3 Stranger sets (between subjects) and foils

Matched pairs (same gender presentation and age); the first-listed member is in the odd scene set (known in list A):

| Pair → scene sets | Set X | Set Y |
|---|---|---|
| 1 → ss1 / ss2 | str01 / str07 (young women) | **str13 / str14** (young men; repeat6 only, v2.4.1) |
| 2 → ss3 / ss4 | str04 / str10 (middle-aged men) | str03 / str09 (middle-aged women) |
| 3 → ss5 / ss6 | str05 / str11 (older women) | str06 / str12 (older men) |

- Known and unfamiliar strangers therefore always have identical gender presentation and age, and all 12 strangers are used
  across participants.
- **Set Y's young men (v2.4.1, after collaborator feedback).** They were str02 (long braids, which read as a woman against a
  male voice) and str08 (coily hair in a light brown that read as blonde). They are now **str13**, a white young man (light
  skin, brown side part, blue eyes), and **str14**, a Latino young man (warm medium skin, short dark curls, stubble), defined
  only in repeat6 (`NEW_STRANGERS` in `tools/build_repeat6_stimuli.py`). unique12 still uses str02 and str08. Each new man
  keeps the voice, greeting and label clip of the stranger he replaces (str13: ElevenLabs "Will", `label_str02_bosa`;
  str14: "Liam", `label_str08_daxa`), so no new audio was made. Trade-offs, accepted: set Y no longer has a Black
  stranger (set X still has two, the older women), and this one pair is less closely matched on skin tone (S1 / S3) than the
  others; lists A and B swap which of the two meets Alex.
- **str05's foil exception.** str05's foil (set X) changes locs to braids, and braids were worn only by str02. The rule "every
  foil's new style is also worn by a stranger" is therefore recorded as a documented exception (`foil_rule_exceptions` in
  the stimulus file, shown by `make_foils.html`). Set X never showed braids on a stranger, so nothing changed for set X.
- Foils are the frozen unique12 foils, except two repeat6-only changes (colour → style), so each young and middle-aged pair has
  one style and one colour foil: **str09** shoulder → long (`foil09b`). The new men's foils: **str13** side part → crop
  (`foil13`), **str14** black → dark brown (`foil14`), plus four identity sliders moved as for every foil.
- The first-listed member's foil type alternates across those pairs (X: colour, style; Y: style, colour), so each condition
  gets a mix within a participant (X odd: colour, style, style; even: style, colour, style).
- Older pairs keep two style foils: all four have mostly grey hair, which would hide a colour change. Across the two lists,
  each stranger appears in both conditions, so style and colour foils stay balanced across conditions.
- `tools/make_foils.html?design=repeat6` regenerates these foils and checks the rules (it refuses to save if one fails).
- Audio: each stranger keeps their voice and greeting. Strangers who say a different word than in unique12 have their own
  label clip (`label_<stranger>_<word>`: str10 tefo; str02 bosa, str08 daxa, str03 lufi, str09 tefo, str06 mavo, str12 gimu;
  the str02 and str08 clips are now spoken by str13 and str14).
  These 7 were generated on 2026-11-17 with the same model (eleven_v4), voices and IPA as the other clips, take 1, normalized
  with `normalize_audio.py`, and are in the manifest (**listen before launch**). To regenerate one:
  `python tools/elevenlabs_tts.py generate --takes 3 --only label_str10_tefo`, choose a take in `tools/audio_review.html`,
  then `python tools/elevenlabs_tts.py finalize --only label_str10_tefo` (`--only` leaves every other file untouched).

### 18.4 Familiarization order (12 trials)

- Block 1: the 6 scene sets in random order; block 2: all 6 again in a new random order.
- Resampled until all hold: (1) block 2 does not start with block 1's last scene set; (2) no more than 2 consecutive scenes of
  the same condition, **across the block boundary too**; (3) the last 2 trials are one known and one unfamiliar scene.
- A second showing is identical to the first: stranger, audio clips, object, word, incidental object and colour, animation, timing.
  The same unfamiliar avatar and name are used in all unfamiliar trials.
- Scene instructions add one sentence (unique12 wording otherwise unchanged): "Scenes may be shown more than once."

### 18.5 Tests (18 trials; word → face → incidental)

- **Word** (6 trials, 4 choices): 3 foils from the other 5 objects; each object is a foil exactly 3 times; every trial has foils
  from both conditions. daxa and mavo may appear together (the never-together rule can't coexist with exact balance: both
  could only be foils on the same 4 trials). Target positions: each of the 4 positions once or twice per participant.
- **Face** (6 trials): stranger vs. their foil; target on the left in exactly 3 trials.
- **Incidental** (6 trials): "What color was the [object]?", 4 colours.

### 18.6 Data

- Participant: adds `stranger_set` (and the `design_version` fields both versions have).
- Familiarization `fam_01`–`fam_12`: adds `presentation` (1 / 2) and `lag` (trials since that scene set's first showing; blank
  for presentation 1) next to `serial_position`. `view_ms` etc. are per showing.
- Tests: `test_<type>_<ss1…ss6>_*` (6 per type). The full-data JSON also gives each test trial `serial_position` (first
  showing) and `serial_position_2` (second showing).
- Long format (`reshape_qualtrics.py`): 12 familiarization rows (with `presentation`, `lag`) + 18 test rows (with
  `serial_position`, `serial_position_2`, `lag`). Sample: `sample_data/sample_long_format_repeat6.csv`.

### 18.7 Check script

`tools/check_repeat6.html` (through the dev server; `?n=5000` for more, `&prototype=1` to load Prototype.js first) builds
1,000 participants' designs with the experiment's own `stimuli.js`, both lists × both stranger sets, and checks every rule
above, then shows balance tables. Result on 2026-11-17 (with Prototype.js): all 26 checks passed; word-test target
positions 24.7–25.4% each; foil positions 24.9–25.1%; every scene set a foil 3,000 times; face targets 50.0% left;
last two trials known→unfamiliar 491, unfamiliar→known 509; lags 2–11.

### 18.8 Duration

Familiarization is still 12 scenes; the tests drop from 36 to 18 trials (about 1.5–2 min less), so the consent page says
about **17 minutes** (`ESTIMATED_MINUTES_REPEAT6`). Confirm with the pilot.

## 19. Linking the avatar to the person, and check-ins (v2.3)

Both versions. Specs: `PERSON_BINDING_SETUP.md` and `PERSON_CHECKINS.md` (copied into the repo; the defaults agreed on
2026-11-18 are the ones described here). The aim is that participants treat the avatar as
the real person they know before and during the scenes. **Everything the known avatar gets, the unfamiliar avatar gets too**
(screen time, training trials, name pairing, check-in questions), with the same layout and size. Nothing in these steps
mentions the scenes, objects, words or tests.

### 19.1 Setup order

name → relationship → IOS → **contact (two questions)** → duration → **recall prompts** → designer **with the notes beside it** →
likeness → **one-time revision** (if the rating is 4 or lower) → **confirmation** → **"This is Jordan"** → **avatar–name
matching** → sound check → scene instructions (**new framing**) → countdown → 12 scenes with **check-ins after 3, 6, 9** →
**"how much did the avatar feel like [name]?"** → arithmetic → tests.

- **Contact:** "How often do you see [name] in person?" and "How often do you talk with [name] in other ways (texting,
  messaging, phone or video calls)?" (with the note that only direct messages and calls count, group chats included, not
  seeing their posts). Same 7 options; `contact_inperson`, `contact_remote` (1–7), `contact_max`.
- **Recall:** screen 1, "Take a moment to picture the last time you saw [name]…", Continue enabled after 8 s. Screen 2, three
  boxes of up to 150 characters (where you were; what they were doing or wearing; their face when they smile or laugh); at
  least one must have text. The notes appear in the designer under the preview, titled "Your notes (not saved)". Privacy: §15.
- **Revision:** "Would you like to adjust the avatar? You can make changes once." Adjust reopens the designer with the current
  avatar, then asks the likeness rating again. `likeness_rating` is the final rating.
- **Confirmation and introduction:** the avatar large and centred with the name beneath; the button appears after 3 s. The
  unfamiliar person is generated from the final avatar (after any revision) and shown at the same size and position.
- **Matching** (after Sui, He & Humphreys, 2012): "Press F if the name matches the person and J if it doesn't" (or the
  reverse, `match_keymap`, 50/50). 6 trials each of known avatar + known name, Jordan + Jordan, known avatar + Jordan, Jordan
  + known name, in random order with no more than 3 of one type and no more than 4 of one correct answer in a row. Each trial:
  fixation 500 ms → avatar and name until response (max 2.5 s) → "Correct" / "Incorrect" / "Too slow" 400 ms → 300 ms blank.
  A key reminder stays at the bottom, laid out like the keyboard: F always on the left, J on the right (v2.3.1; in 2.3.0 the
  "matches" key was listed first, so J could appear on the left). Trial data (labels only: `known` / `unfamiliar` for the avatar and the name) are in the
  JSON backup under `match`; summaries are participant fields. `match_flag` never excludes anyone.
- **Scene instructions:** "Next you'll watch short moments from [name]'s and Jordan's days, as they run into people they know.
  Imagine you're really watching [name] and Jordan." (repeat6 adds "Scenes may be shown more than once."; with check-ins on:
  "Every few scenes, we'll ask a quick question about [name] and about Jordan. There are no right answers.") This replaces the
  earlier "people meeting each other" / "someone you haven't seen before" wording. The name text stays under both people in
  every scene (`SHOW_NAME_LABEL`).

### 19.2 Check-ins

After familiarization trials 3, 6 and 9 (never after 12), once SPACE has ended the scene, so `view_ms` is unaffected. Each
check-in asks one question about both people, one screen each, in random order; each screen shows that person's avatar
(same size and position) with their name. Header: "Quick question. Your best guess is fine." Self-paced; clicking an
option moves on. 300 ms blank between the two screens, 500 ms blank before the next scene.

| id | Question | Options |
|---|---|---|
| `feel` | How do you think [name] is feeling these days? | Not great / Okay / Good / Great / Not sure |
| `evening` | Would [name] rather spend a free evening at home or out somewhere? | At home / Out somewhere / Not sure |
| `dayoff` | With a day off tomorrow, would [name] plan it or play it by ear? | Plan it / Play it by ear / Not sure |

Each question is used once per participant; the order is one of the 3 rows of a Latin square (`checkin_order`). Checked
against every tested item (`tools/privacy_check.html`, "Check-in wording"): none of the three mentions a novel word, an
incidental object of either version (mug, lamp, clock, bowl, frame, watering can, vase, book, teapot, candle, jar, bottle),
a colour, objects, meeting people, learning, memory or tests. Data: `checkin_k_*` fields (§13), the JSON backup
(`checkins`, one record per response), and the long format (`phase = checkin`, one row per response).

### 19.3 Switches

`RECALL_ENABLED`, `REVISION_ENABLED`, `MATCHING_ENABLED`, `CHECKINS_ENABLED` (all `true`). A switched-off step is skipped and
its fields stay blank. `binding=0/1` (recall, revision and matching together) and `checkins=0/1` override them for one
participant, so a pilot can compare versions on `represent_rating` and the likeness rating within one deployment. The
confirmation, introduction and post-scene rating always run.

### 19.4 Checks run (2026-11-18)

- Full automatic runs of both versions with Prototype.js (`prototype=1`): every new field filled; the revision path taken
  (the autopilot rates 4 first); 24 matching trials; 3 check-ins after scenes 3, 6, 9; JSON backup about 31,000 characters
  for unique12 and 23,000 for repeat6 (limit 60,000, not truncated). A repeat6 run with `binding=0&checkins=0` left every
  recall, revision, matching and check-in field blank (`steps_source = override`).
- The reshape script reads the new samples (check-in rows included) and still reads the 2026-11-18 repeat6 pilot export
  (v2.2, `contact_freq`, no binding fields).
- `tools/check_repeat6.html` (400 designs, Prototype.js) and the foil rules of both stimulus files still pass after the
  similar-style list gained the plain bob.
- `tools/privacy_check.html`, both versions: the name and notes were found nowhere (embedded data, JSON backup, jsPsych data,
  storage, cookies, network requests, DOM), and the notes were gone from memory.

## 20. Control condition: copy a random avatar (v2.4)

A fourth between-subjects category, `control`, randomized alongside the three closeness categories (equal allocation:
8 Randomizer branches in unique12, 16 in repeat6). It gives a baseline in which the participant builds an avatar with the
same tool and the same effort, then sees it named and in the scenes, but there is no real person behind it.

### 20.1 What changes

| Step | Known-person categories | Control |
|---|---|---|
| Welcome | "answer a few questions about someone you know, make a simple cartoon avatar of them…" | "make a simple cartoon avatar by copying one we show you…" |
| Name, relationship, IOS, contact, duration, recall notes | asked | **skipped** (fields blank; `recall_enabled = 0`) |
| Before the designer | (recall notes) | **"Copy this avatar"**: the target alone, button after 3 s (`copy_intro_ms`) |
| Designer | "Make an avatar that looks like [name]" | **"Copy the avatar"**: the avatar to copy stays beside "Your avatar", at the same size |
| Likeness (1–7) | "How much does this avatar look like [name]?" | "How much does your avatar look like the one you copied?", both shown |
| Revision offer (≤ 4) | "Would you like to adjust the avatar?" | "…to look more like the one you copied?", both shown; same cutoff, one visit |
| Confirmation | "From here on, this avatar is [name]. Whenever you see it, picture [name]." | "From here on, this avatar is **Sam**." (the name is given here, from `CONTROL_NAMES`) |
| Unfamiliar person, matching, scenes, check-ins, tests | | **unchanged** (the copy takes the "known" role) |
| "Felt like [name]" rating after the scenes | asked | **skipped** |

In the data the copy keeps the **known** role everywhere (`known_avatar`, scene `condition = known`, `match_acc_kk`,
`checkin_k_known_resp`, test fields), so the analysis code needs no changes: filter or model by `category = control`. The
unfamiliar person is generated from the copy by the usual rule, and the name chooser keeps it from resembling the assigned
name. Control participants reach the scenes a few minutes sooner (no questions about a person); this was left as is.

### 20.2 The random target (`SRL.avatarRules.target`)

Drawn from a third random stream of the recorded seed (`seed ^ 0x27D4EB2F`), so it is reproducible and does not shift the
scene design or the binding steps:
- skin depth evenly over the six skin bands the strangers use; undertone 0.2–0.85
- age: young / middle-aged / older, equally
- face, eye, brow, nose and mouth sliders uniform in 0.25–0.75; eyelids double (half), hooded or monolid
- hair texture, hair colour and eye colour loosely follow skin depth, as among the strangers (e.g. mostly coily or curly
  hair and dark eyes for deep skin; any hair colour for light skin); grey hair by age; freckles sometimes on light skin
- a masculine or feminine presentation, half each (as among the strangers). Masculine: mostly short hair (75% short, 20%
  medium, 5% long) and facial hair in about 45%. Feminine: 20% short, 40% medium, 40% long, no facial hair. Then any hair
  style that fits the texture and length, with a bun at 0.4 and a buzz cut at 0.5 weight (they fit every texture); a buzz cut only for masculine
  targets, bald only for older masculine ones
- glasses in 1 in 4, **no head covering** (a covering is personal, so it is never assigned at random); a designer shirt
  colour (never a stranger's)
- never a near-twin of a stranger in the participant's set (same style, same age and skin within 0.15)

### 20.3 Checks run (2026-11-19)

- Full automatic runs with Prototype.js: control in unique12 and in repeat6 (stranger set Y), and a `close` run in unique12
  to confirm the known-person flow is unchanged. All finished with no errors; the control runs filled `control_name`,
  `target_avatar` and the copy fields, left every known-person field and `represent_rating` blank, and took the revision path.
- Screenshots of every new screen at 1280 × 800 (the avatar to copy, the designer with both avatars, the rating, the
  revision offer, the naming screen).
- A sheet of 32 random targets and the style mix over 2,000 draws, to check variety and that no combination looks odd.
- `sample_data/u12_auto2_control_B_*` (saved control run) goes through `tools/make_mock_export.py` and
  `analysis/reshape_qualtrics.py`: 12 familiarization, 36 test and 6 check-in rows, control fields filled, known-person
  fields blank.
- `tools/privacy_check.html` (unique12, Prototype.js; a `close` run, since only the known-person categories type anything)
  still passes after the setup steps were made conditional.
