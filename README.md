# Social relevance and learning from strangers: adult Prolific experiment (v2)

jsPsych 8.2.1 experiment, embedded in a **Qualtrics** survey (classic layout), recruited on **Prolific**. The full design
and every decision behind it is in **[docs/V2_SPEC.md](docs/V2_SPEC.md)**; this README covers how to run, deploy and
analyse it. Experiment version: `3.1.0` (`VERSION` in `experiment/config.js`).

This repo started from the pilot-1 code (`rbzsparks/srl-adult-prolific`, tag `v2.4.2-pilot1`), which stays frozen
there with its data.

## Contents

1. [The study in short](#1-the-study-in-short)
2. [Files](#2-files)
3. [Run it locally](#3-run-it-locally)
4. [Deploy to GitHub Pages](#4-deploy-to-github-pages)
5. [Qualtrics setup](#5-qualtrics-setup)
6. [Prolific setup (pilot 2: N = 100)](#6-prolific-setup-pilot-2-n--100)
7. [Configuration](#7-configuration)
8. [Audio](#8-audio)
9. [Data, exclusions and analysis](#9-data-exclusions-and-analysis)
10. [Privacy](#10-privacy)
11. [Known limitations and untested paths](#11-known-limitations-and-untested-paths)

## 1. The study in short

Between subjects, two conditions:

| | Known | Control |
|---|---|---|
| The avatar stands for | one of the participant's **closest** people (first name typed) | an assigned name (Sam, Alex or Jamie), introduced with one of 6 fixed avatars |
| Questions | relationship, closeness (1–7), contact (2), how long known | none |
| Picture + notes (8 s minimum, notes never saved) | recall: the last time they saw them | imagine: what Sam might be like, with Sam's avatar on screen |
| Avatar | designed from memory | copied from Sam's avatar, shown beside the preview (copy error recorded) |
| Voice | chosen from 6 | assigned: the voice that matches Sam's avatar |
| Likeness | "How much does this avatar look like [name]?" | "How much does your avatar look like the one you copied?" |
| Confirmation, matching | same screens | same screens |
| Extra rating | "How close is this voice to [name]'s?" (1–7) | none |

Then, for everyone:
1. An audio check in the chosen voice.
2. A 10 s countdown.
3. **12 scenes** (6 scene sets × 2). The avatar walks in and says **"Hi, [stranger]!"**. The stranger smiles and gives
   one small nod. Then the avatar says **"Look! It's a bosa! A bosa!"**, and the stranger follows the
   avatar's gaze and nods.
4. Three check-ins about the avatar person.
5. "While watching, how much did [name] feel like someone you know?" (1–7).
6. A **30 s odd/even task**.
7. Three surprise 4-option tests, in one of 6 counterbalanced orders: **word**, **identity** ("Which one is
   Riley?") and **colour**.

**Assignment.** Condition, stranger set (X / Y: 3 women + 3 men each) and test order come from nested,
evenly-presented Qualtrics randomizers (2 × 2 × 6). Two things are set in the JS per participant:
- the 6 stranger names are shuffled across the 6 faces;
- the matching keymap (F or J for "matches") is randomized.

## 2. Files

```
experiment/                 everything GitHub Pages serves
  config.js                 every count, timing, name list and switch
  index.html                local runner (same code as Qualtrics)
  js/loader.js              loads CSS + scripts from a base URL, then starts the experiment
  js/main.js                timeline (order of steps), assignment, saving at the end
  js/names.js               stranger names, foil name, clash checks
  js/binding.js             closeness, contact, picture + notes, voice selector, confirmation, matching, check-ins, "felt like"
  js/designer.js            avatar designer + likeness rating
  js/scene.js               one scene (layout, animation, audio timing)
  js/people.js              avatar drawing and animation
  js/avatar_rules.js        the foil avatar for the matching task
  js/stimuli.js             participant design: scene order, test foils and positions, colours
  js/tests.js               the three tests
  js/fillers.js             countdown, odd/even task (and the pilot-1 arithmetic task)
  js/screens.js             intro, name, relationship, duration, audio check, messages
  js/fields.js              the list of Qualtrics embedded-data fields (also read by the Python tools)
  js/data.js                saving: Qualtrics fields, JSON backup, DataPipe, local downloads
  stimuli/stimuli.json      scene sets, words, faces (stranger sets X / Y), colours
  audio/                    MP3 + OGG clips, audio_manifest.csv, voice_casting.json
qualtrics/survey.qsf        importable survey (placeholder Prolific codes) + the question JS as plain files
tools/build_qsf.py          builds the .qsf
tools/elevenlabs_tts.py     audio generation (with audio_qc.py, normalize_audio.py, audio_review.html)
tools/dev_server.py         local server (with POST /__save for debug runs)
tools/make_mock_export.py   mock Qualtrics export from debug runs (to test the analysis)
tools/control_targets.html  candidate copy targets for the control condition (contact sheet + JSON)
tools/set_control_targets.py  installs the chosen targets into stimuli.json
tools/privacy_check.html    checks that the typed name and notes never reach the data
analysis/reshape_qualtrics.py   Qualtrics export -> participants.csv, test_trials.csv, id_key.csv
analysis/v2_analysis.R      exclusions, accuracy, planned models, figures
analysis/power_v2.R         power simulation (results in analysis/power_out/)
docs/V2_SPEC.md             the design
```

## 3. Run it locally

```bash
python tools/dev_server.py
```

Then open `http://localhost:8000/experiment/index.html?debug=1`. URL parameters:

| Parameter | Meaning |
|---|---|
| `PROLIFIC_PID`, `STUDY_ID`, `SESSION_ID` | as Prolific sends them |
| `condition` | `known` \| `control` |
| `stranger_set` | `X` \| `Y` |
| `test_order` | e.g. `colour-word-identity` (any order of the three) |
| `control_target` | `1`–`6`: which fixed avatar a control participant copies |
| `debug=1` | short fillers (countdown 5 s, delay task 10 s), IDs on screen, no DataPipe, data downloaded |
| `auto=1` | with `debug=1`: autopilot clicks through the whole study |
| `devsave=1` | with the dev server: write the output files into `sample_data/` instead of downloading |
| `reset=1` | clear the reload marker for this PROLIFIC_PID |
| `name_label` | `0` / `1`: hide / show the avatar's name under it in the scenes |
| `binding` | `0` / `1`: turn the picture/notes, revision and matching steps off / on |
| `checkins` | `0` / `1`: turn the check-ins off / on |
| `prototype=1` | load Prototype.js 1.7.1 first, as Qualtrics' classic layouts do (run this before every deploy) |

Notes:
- Any of `condition`, `stranger_set` or `test_order` that is missing is drawn at random, and `assign_fallback = 1` is
  recorded.
- Example: `…/index.html?debug=1&auto=1&devsave=1&PROLIFIC_PID=T1&condition=known&stranger_set=X&test_order=word-identity-colour&reset=1`.

## 4. Deploy to GitHub Pages

1. Repo **Settings → Pages → Deploy from a branch → main / root**.
2. The experiment base URL is then `https://rbzsparks.github.io/srl-adult-v2/experiment/`. This is the default in
   `tools/build_qsf.py`.
3. To update the live study, commit and push; Pages redeploys in about a minute. The question JS appends
   `?v=<VERSION>` to every file, so **bump `VERSION`** in `config.js` and rebuild the .qsf (or edit `VERSION` in the
   question JS) when files change mid-study.
4. CORS: GitHub Pages sends `Access-Control-Allow-Origin: *`, which the audio and `stimuli.json` fetches need. To check
   the live site from another origin without Qualtrics, use `tools/remote_load_test.html` (served by the dev server).

## 5. Qualtrics setup

1. **Custom JavaScript** must be allowed on the account (pilot 1 confirmed it is).
2. **Import:** Create project → Survey → From a file → `qualtrics/survey.qsf` (or the copy built with the real codes, §6).
3. **Survey flow:**
   1. Embedded Data (all fields; list in `qualtrics/embedded_data_fields.txt`).
   2. Device check → screen-out redirect.
   3. Consent → no-consent redirect.
   4. **Randomizer (condition) → Group → Randomizer (stranger set) → Group → Randomizer (test order)**, every
      randomizer "present 1", **evenly present** on. The control group also has a 6-way randomizer for
      `control_target` (which fixed avatar to copy).
   5. Experiment (JS).
   6. Post-test questions.
   7. Demographics.
   8. Debrief.
   9. End of Survey → completion redirect.

Checklist after import:
- [ ] **The nested randomizers imported as built:** 2 condition groups, each with a 2-way stranger-set randomizer, each
  of those with a 6-way test-order randomizer (24 leaves), every one with *Evenly present elements* checked. The
  generated file uses `Group` elements, which I could not test-import. If they don't come through, rebuild them by
  hand in the flow editor, or tell me and I'll switch test-order assignment to a balanced counter in the JS.
- [ ] Layout = Flat (or Modern); the new survey-taking experience is OFF; Back button OFF.
- [ ] The Embedded Data element is first in the flow.
- [ ] All three End of Survey redirects carry the right codes.
- [ ] Replace the consent and debrief placeholders (IRB). The consent text mentions the voice choice and the two
  kinds of avatar.
- [ ] Preview with `?PROLIFIC_PID=test1&STUDY_ID=x&SESSION_ID=y&debug=1`, run to the end, then check in Data &
  Analysis that `condition`, `test_order`, `voice_id`, `fam_01_view_ms`, `test_identity_ss1_correct` and
  `full_data_json_1` are filled.
- [ ] Check the counts in each randomizer leaf after the first batch. Qualtrics counts started sessions, not
  completes, so returns can unbalance the cells.

Limits:
- Embedded-data values are capped at 20 KB, so the trial-level JSON backup is split across `full_data_json_1..4`.
- Embedded data is saved only when the experiment clicks Next at the end. DataPipe backups (if configured) survive a
  closed tab.

## 6. Prolific setup (pilot 2: N = 100)

- **Study URL:** `https://<your>.qualtrics.com/jfe/form/SV_xxx?PROLIFIC_PID={{%PROLIFIC_PID%}}&STUDY_ID={{%STUDY_ID%}}&SESSION_ID={{%SESSION_ID%}}`
- **Places:** 100 (50 per condition via the randomizer).
- **Run in two batches:** publish with 10 places first, check the data (reshape + `v2_analysis.R`, the cell counts,
  `audio_load_errors`, `js_error`), then raise to 100.
- **Estimated time:** **17 min** (`ESTIMATED_MINUTES`, also on the consent page). The pilot-1 median was 14.0 min.
  v2 adds the voice selector (about 1 min) and the control picture/notes and free design (about 1.5–2 min for
  controls). Pay at the pilot-1 hourly rate for 17 min, and re-check the median after the first batch.
- **Screening:**
  - Desktop only.
  - Listing text: "Requires audio (headphones or speakers)".
  - **Exclude participants from the pilot-1 study:** Participants → Screeners → "Exclude participants from previous
    studies".
- **Completion paths:**
  - **Completed:** approve and pay, `COMPLETION_CODE`.
  - **Screened out** (device check): fixed screen-out reward (minimum £0.10 / $0.14), cap about 30,
    `SCREENOUT_CODE`.
  - **No consent:** "Request a return", `NOCONSENT_CODE`.
- **Build the survey with the real codes into a folder outside the repo** (the repo is public):
  ```bash
  python tools/build_qsf.py --completion-code … --screenout-code … --noconsent-code … --out <folder outside the repo>/survey.qsf
  ```
- **Nobody is rejected or paid less because of the analysis exclusions** (§9). They are analysis decisions only.

## 7. Configuration

Everything is in `experiment/config.js`; each entry is commented. The ones most likely to change:

| Setting | Default | What it does |
|---|---|---|
| `COLOUR_CHOICES` | `4` | options in the colour test; `2` = target + one other (fallback if pilot 2 is at chance) |
| `FILLER_TASK` | `'parity'` | delay task: `'parity'` (odd/even) or `'arithmetic'` (pilot 1) |
| `TIMING.FILLER2`, `PARITY_MAX_MS` | 30000, 2000 | delay length; the odd/even task is self-paced, each number up to 2 s |
| `PARITY_FLAG_ACC`, `PARITY_FLAG_MISSES` | 0.75, 4 | `parity_flag` thresholds |
| `STRANGER_NAMES`, `FOIL_NAMES`, `CONTROL_NAMES` | see file | names, backups and first sounds |
| `NAME_CLASH_MAX_EDIT`, `NAME_CLASH_PREFIX` | 2, 3 | clash rule against the typed name |
| `VOICES`, `VOICE_SAMPLE_TEXT` | 6 voices | voice selector |
| `MATCH_*` | 6 per type, 2.5 s, flag < 0.75 | matching task |
| `CHECKINS_ENABLED`, `CHECKIN_AFTER_TRIALS` | on, 3/6/9 | check-ins |
| `TIMING.*` | | scene animation and delays |

## 8. Audio

**Clip list:** `tools/audio_common.py` builds it from `stimuli.json` and `config.js` (150 clips).

**Per avatar voice** (`fy my fm mm fo mo` = woman/man × young/middle-aged/older):
- `sel_<voice>`: the selector sample
- `greet_<name>_<voice>`: "Hi, Riley!", for all 12 names
- `label_<word>_<voice>`: "Look! It's a bosa! A bosa!", for 6 words
- `check_<word>_<voice>`: the audio check, 2 words

**Narrator:**
- `test_word_<word>`: "Which one is the bosa?"
- `test_identity_<name>`: "Which one is Riley?"
- `test_incid_<object>`: "What color was the mug?"

**Casting** is in `experiment/audio/voice_casting.json`: the six pilot-1 ElevenLabs voices plus the pilot-1 narrator.

**Workflow** (the ElevenLabs key stays in `%USERPROFILE%\.elevenlabs_api_key`, never in the repo):

```bash
python tools/elevenlabs_tts.py generate --takes 2 [--only <clip ids>]
```
```bash
python tools/audio_qc.py
```
```bash
python tools/elevenlabs_tts.py finalize
```

`audio_qc.py` checks the pause structure of each label clip (the gaze timing needs 2 pauses) and flags long takes. It
then writes a suggested `selection.json`. Listen and change the picks in `tools/audio_review.html` before `finalize`.
`finalize` trims each clip, normalizes it to −16 LUFS, writes MP3 + OGG into `experiment/audio/`, and updates the
manifest. Sources are under `audio_src/` (gitignored).

**At run time**, the narrator prompts and the 6 selector samples load first. The chosen voice's clips (6 greetings for
the names in use, 6 labels, 2 checks) load in the background during the likeness, confirmation and matching steps, and
the audio check waits for them. Any clip that fails to load plays as silence and is counted in `audio_load_errors`.

## 9. Data, exclusions and analysis

**Saving.**
- Wide fields go to Qualtrics embedded data (`js/fields.js`):
  - one set of participant fields;
  - `fam_01..12_*` per scene;
  - `test_<word|identity|colour>_<ss1..ss6>_*`.
- The trial-level JSON backup goes to `full_data_json_1..4`. It holds every test trial in order, the odd/even
  trials, the matching trials and the check-ins.
- An optional DataPipe → OSF copy is sent if `DATAPIPE.EXPERIMENT_ID` is set.

**Key fields.**
- **Assignment:** `condition`, `stranger_set`, `test_order` (e.g. `colour>word>identity`), and `pos_word`,
  `pos_identity`, `pos_colour` (1–3).
- **Names and voice:**
  - `name_face_map` (e.g. `str01=Quinn;…`)
  - `name_swaps` and `swapped_names`: which list names were replaced, never the typed name
  - `foil_name`
  - `voice_id`, `voice_order`, `voice_closeness` (known only)
- **Control copy task:** `control_target` (1–6), `target_avatar`, `copy_err` / `copy_n_miss` / `copy_miss` (final; `_1` =
  before any revision).
- **Ratings:**
  - `closeness` (known only, 1–7)
  - `likeness_rating` (known: looks like the person; control: looks like the copied avatar)
  - `represent_rating` ("felt like someone you know", both conditions)
- **Matching:** `match_acc_kk / ff / kf / fk / total`, `match_no_response`, `match_flag` (< 0.75, flag only).
- **Odd/even task:** `parity_trials`, `parity_correct`, `parity_misses`, `parity_acc` (among answered),
  `parity_rt_median`, `parity_flag`.
- **Quality:** `audio_check_pass`, `fam_timeout_count`, `reloaded_post_fam`, `tab_switches`, `fullscreen_exits`,
  `audio_load_errors`, `js_error`.

**Reshape.**
```bash
python analysis/reshape_qualtrics.py <export.csv> -o data/pilot2
```
- It writes `participants.csv` (subject IDs S001…), `test_trials.csv` (one row per test trial, in presentation order,
  with `test_position`) and `id_key.csv` (subject → Prolific ID; keep private).
- Keep the output in `data/`, which is gitignored.
- Then code `external_aid` (0/1) in `participants.csv` from the `strategy` answers.

**Preregistered exclusions** (`analysis/v2_analysis.R`). These are **analysis exclusions only: nobody is rejected
or paid less on Prolific because of them.** A participant is excluded for any of:
1. failed either attention check;
2. `parity_flag` (accuracy < 75% among answered, or ≥ 4 misses);
3. matching accuracy < 50%, or no matching responses;
4. self-reported external aid;
5. 3 or more scene timeouts;
6. failed the audio check on both attempts;
7. reloaded the page after the scenes started.

Low closeness is **not** an exclusion (it's a covariate), and `match_flag` is a flag only.

**Analysis.**
```bash
Rscript analysis/v2_analysis.R data/pilot2
```
It reports:
- exclusions by rule;
- cell balance;
- accuracy by condition × test and by test × position, including colour when it came first vs chance;
- the planned models `correct ~ condition + test_position + (1 | subject) + (1 | item)` per test;
- the exploratory condition × position model;
- the "felt like" manipulation check;
- known-condition rating covariates.

It also saves three figures.

To test the pipeline before real data: run a few autopilot sessions with `devsave=1`, then
`python tools/make_mock_export.py sample_data/*_qualtrics_fields.json -o sample_data/mock_qualtrics_export.csv`, then
reshape with `--include-debug`.

**Power:** `analysis/power_v2.R`, results in `analysis/power_out/` and summarised in the spec (§12).

## 10. Privacy

- **The typed name** (known condition) and **the notes** (both conditions) stay in browser memory only. They are
  never in any data field, the JSON backup, DataPipe, `localStorage` or the console. The notes are deleted from memory
  after the last designer visit. `tools/privacy_check.html` runs the autopilot with marker text and searches every
  output for it.
- **Name clash checks** compare stranger and foil names with the typed name in memory. Only which *list* names were
  swapped is recorded.
- **`localStorage`** holds only a stage marker and a reload counter, keyed by Prolific ID.
- **Prolific IDs** are in the Qualtrics export. `reshape_qualtrics.py` replaces them with subject IDs and writes the
  key to a separate file.
- **The repo is public.** Real completion codes, the ElevenLabs key and participant data never go in it.

## 11. Known limitations and untested paths

- **The nested randomizer** (`Group` elements in the .qsf) has not been test-imported; see the §5 checklist.
- **The new Qualtrics survey-taking experience** (`QUALTRICS_ENGINE: 'nste'`) is untested, as in pilot 1.
- **Stranger voices:** the strangers never speak.
- **The narrator** says "color" (American spelling), and so does the on-screen text.
- **Identity-test difficulty** is unknown: pilot 1 had a 2-option recognition test, not name–face binding.
  `COLOUR_CHOICES` exists for the colour test, but there is no equivalent switch for identity.
- **Stranger sets** were rebalanced from pilot 1 (which had 4 women + 2 men in set X and 2 + 4 in set Y) to 3 + 3,
  with one woman and one man per age band. The faces themselves are unchanged.
