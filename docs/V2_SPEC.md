# SRL adult v2: design spec

Status: **signed off** (2026-11-24). Pilot 1 code is frozen at `rbzsparks/srl-adult-prolific`, tag
`v2.4.2-pilot1`. Everything below is decided unless marked **Check**.

## 1. Design in one paragraph

Between subjects, two conditions: **known** (the avatar stands for one of the participant's closest people) and
**control** (the avatar stands for an assigned name: Sam, Alex or Jamie). Each participant designs one avatar, picks a
voice for it, and links it to its name in a matching task. In all 12 familiarization scenes (repeat6: 6 scene sets,
each shown twice), that avatar walks in, greets a stranger by name ("Hi, Riley!"), and labels a novel object ("Look! It's
a bosa! A bosa!"). A 30 s odd/even task follows, then three surprise 4-option tests in one of 6 counterbalanced orders:
**word** (which object was the bosa), **identity** (which one is Riley), **colour** (what colour was the background object).

## 2. Conditions and counterbalancing

| Factor | Levels | How assigned |
|---|---|---|
| Condition | known, control | Qualtrics randomizer, evenly presented (outer) |
| Stranger set | X, Y (3 women + 3 men each, across age bands) | nested randomizer inside each condition |
| Test order | all 6 orders of word / identity / colour | nested randomizer inside each condition × set |
| Name → face mapping | 6 names shuffled over the 6 strangers | JS, per participant (seeded) |
| Control name | Sam, Alex, Jamie | JS, random (control only) |
| Matching keymap | F = match / J = match | JS, random (as in pilot 1) |

- **Nested randomizer:** 2 → 2 → 6 = 24 leaves. Each inner randomizer counts on its own, so even presentation balances
  set within condition, and order within condition × set. The builder will write this into the .qsf. If Qualtrics won't
  import the nesting, the fallback is to assign order in JS with a balanced counter. The README will say which was used.
- **`list` is dropped.** In pilot 1 it only decided which half of the scene sets were "known" and which "unfamiliar".
  Word–object pairs, strangers and incidental objects are fixed per stranger set. With one talker in every scene it
  balances nothing.
- With N = 100, Qualtrics counts started sessions, not completes. Check the cell counts after the first batch.

## 3. Participant flow

| # | Step | Known | Control |
|---|---|---|---|
| 1 | Consent, device check (Qualtrics) | same | same |
| 2 | Intro | same | same |
| 3 | Person setup | "Think of one of your **closest** friends or family members" → first name (no family titles, no romantic partner) → relationship type → closeness 1–7 → contact (in person, remote) → how long known | "In this study you'll create a person named **Sam**" (no questions) |
| 4 | Picture page (8 s minimum) | "Picture the last time you saw [name]…" | "Picture what Sam might be like: where you might run into them, what they might wear, what their smile is like." |
| 5 | Notes beside the designer (never saved) | Where were you? / What was [name] doing or wearing? / What does [name]'s face look like when they smile or laugh? | Where might you run into Sam? / What might Sam be doing or wearing? / What does Sam's face look like when they smile or laugh? |
| 6 | Designer | design [name] | design Sam (pilot-1 controls copied a random avatar; v2 controls design freely) |
| 7 | Voice selector | pick the voice closest to [name]'s, then "How close is this voice to [name]'s?" (1–7) | pick a voice for Sam |
| 8 | Likeness (+ the existing revision offer) | "How much does this avatar look like [name]?" | "How much does this avatar look the way you pictured Sam?" |
| 9 | Confirmation | "From here on, this avatar is [name]" | "From here on, this avatar is Sam" |
| 10 | Matching task (24 trials) | see §5 | same, with Sam |
| 11 | Audio check (2 attempts) | same | same |
| 12 | Scene instructions, 10 s countdown | same | same |
| 13 | 12 scenes + 3 check-ins (after scenes 3, 6, 9: Latin square of feel / evening / day off, about the avatar person only) | same | same ("How do you think Sam is feeling these days?" has a "Not sure" option) |
| 14 | "While watching, how much did [name] feel like someone you know?" (1–7) | same wording | same wording |
| 15 | Odd/even task (30 s) | same | same |
| 16 | Tests in the assigned order | same | same |
| 17 | Strategy, expected test, attention checks, demographics (Qualtrics) | same | same |

The avatar's name (typed name or control name) shows under the avatar wherever it appears. The typed name stays in
memory only, as in pilot 1.

## 4. Voice

- **6 voices:** woman and man × young, middle-aged, older. I'll reuse the 6 pilot-1 ElevenLabs voices (Sarah, Will, Bella,
  Chris, Carol, Bill). An androgynous voice is added only if one sounds natural.
- **Selector:** "Hi! It's so nice to see you." plays in each voice, in random order. Each voice can be replayed. A choice is
  required.
- **Recorded:** `voice_id`, `voice_order`, `voice_replays`, and `voice_closeness` (known only).

## 5. Matching task

- **Foil avatar:** generated from the designed avatar by the existing unfamiliar-avatar rule.
- **Foil name:** the first of Morgan, Taylor, Casey, Kendall, Emerson, Dakota that passes the clash check (§8).
- **Trials:** 4 types × 6 = 24:
  - avatar + its name (match)
  - foil + foil name (match)
  - avatar + foil name (mismatch)
  - foil + avatar's name (mismatch)
- **Timing, feedback and keys:** as in pilot 1 (2.5 s limit; F on the left, J on the right; keymap randomized).
- **Flag:** `match_flag` = accuracy < 75% (flag only).
- The foil avatar and foil name appear nowhere else.

## 6. Scenes

- **Structure:** repeat6. 12 trials, each set shown twice. The pilot-1 order constraints that used known/unfamiliar
  conditions are dropped. Kept: block 2 doesn't start with block 1's last set.
- **Timeline per scene:**
  1. The stranger is in place.
  2. The avatar enters and says "Hi, [stranger name]!"
  3. The stranger smiles, waves and raises their eyebrows.
  4. The avatar looks at the object: "Look! It's a [word]! A [word]!"
  5. The stranger follows the avatar's gaze to the object and nods.
  6. Same idle and exit as in pilot 1.
- **Pauses:** gaze shifts stay timed to the pauses in the label clip, as in pilot 1.
- **Stranger names:** never on screen. They're heard only in the greeting, twice per stranger (once per showing).
- **Background (colour) object:**
  - about 1.5× its pilot-1 size;
  - never blocked by anything;
  - same position and colour in both showings of a scene.
- **Colours:** red `#B3122E`, blue `#2D6FD6`, yellow `#FFD000`, green `#2FB36A`. The smallest pairwise OKLab ΔE is
  26 with normal vision, 16 protan, 18 deutan and 12 tritan (target ≥ 8).
  Each colour is the target 1–2 times across the 6 sets, balanced. `COLOUR_CHOICES` in config (4 now; 2 is the fallback).
- **Timeouts:** `fam_timeout_count` is kept, as are view times and fast advances (recorded, not used as attention measures).

## 7. Tests

- **Order:** one of 6 orders, from Qualtrics. Recorded as `test_order` (e.g. `colour>word>identity`) and `pos_word`,
  `pos_identity`, `pos_colour` (1–3).
- **Word (4AFC):** as in pilot 1, minus the rule that every trial has a foil from each condition. Each object is a foil
  exactly 3 times, and target positions are balanced.
- **Identity (4AFC):**
  - The narrator asks "Which one is Riley?", and the question also appears on screen.
  - The options are 4 stranger faces. The wrong answers are the other strangers from the scenes.
  - Each stranger is a wrong answer exactly 3 times across the 6 trials, and target positions are balanced (each
    position 1–2 times).
- **Colour (4AFC):** "What colour was the [object]?" with the 4 colours (or 2, from config). Order of the colour options
  is shuffled per trial.

## 8. Names and clash checks

| Stranger | Backup |
|---|---|
| Riley | Rowan |
| Quinn | Blair |
| Drew | Jesse |
| Parker | Charlie |
| Avery | Hayden |
| Frankie | Jordan |

- **Control names:** Sam, Alex, Jamie.
- **Foil names:** Morgan, Taylor, Casey, Kendall, Emerson, Dakota.
- **Rules,** all checked in the browser:
  1. A stranger or foil name is swapped if it matches the typed name, ignoring case. It's also swapped if it nearly
     matches: edit distance ≤ 2, or the same first 3 letters.
  2. A stranger name is swapped if it starts with the same sound as the control name (onset table: Sam /s/, Alex /æ/,
     Jamie /dʒ/). None of the 6 main names does; Avery (/eɪ/) is not swapped for Alex.
  3. A swapped name takes its own backup. If the backup also fails, it takes the next unused backup.
- **Recorded:** `name_swaps` (count), `swapped_names` (which list names were replaced, never the typed name), and
  `name_face_map` (e.g. `str01=Quinn;str02=Riley;…`).

## 9. Audio inventory

- **Per voice (6 voices):**
  - 12 greetings ("Hi, [name]!" for the 6 names + 6 backups)
  - 6 label lines
  - 2 audio-check clips
  - 1 selector line
  - that's 21 clips per voice, 126 in all.
- **Shuffling needs no new audio.** Greetings are recorded per name and per voice, and the greeting clip is picked by
  name at run time.
- **Narrator:** 12 identity prompts ("Which one is [name]?"), plus the colour prompts and the existing word prompts.
- **Generation:** ElevenLabs through the existing pipeline (`tools/elevenlabs_tts.py`, `normalize_audio.py`,
  `audio_qc.py`). The key stays in `%USERPROFILE%\.elevenlabs_api_key`.

## 10. Odd/even delay task

- **Trials (v3.0.4, self-paced):** two-digit numbers for 30 s under the same countdown bar.
  - Each number stays up until F or J is pressed, for at most 2 s (`PARITY_MAX_MS`). No response in 2 s counts as a
    miss.
  - The pressed key lights up for 250 ms. This only shows the press was registered; there is no right/wrong
    feedback. A 150 ms blank follows, then the next number.
  - The number of trials depends on speed: about 30–40 for a typical responder, 15 if every number is missed. A
    number cut off by the end of the task isn't counted.
  - Parity is random, with no more than 4 of one parity in a row, and no number repeats back to back.
  - History: until v3.0.3, numbers came at a fixed pace (1.25 s, then 2 s) with no sign that a press had registered.
- **Keys:** F = odd, J = even, fixed for everyone. This is also the faster-to-respond mapping.
- **Recorded:** `parity_trials`, `parity_correct`, `parity_misses`, `parity_acc` (among answered trials),
  `parity_rt_median`.
- **Flag:** `parity_flag` = accuracy < 75% or 4 or more misses.
- **Config:** `FILLER_TASK: 'parity' | 'arithmetic'`. Arithmetic is kept as the alternative.

## 11. Exclusions (preregistration) and flags

Analysis exclusions only. Nobody is rejected or paid less on Prolific because of them. The README and the
preregistration draft will both say this.

A participant is excluded if any of these apply:
1. failed either attention check
2. `parity_flag`
3. matching accuracy < 50%, or no matching responses
4. self-reported external aid (coded from the strategy question)
5. 3 or more scene timeouts
6. failed the audio check on both attempts
7. reloaded the page after familiarization started

Not exclusions:
- **Low closeness:** closeness is a covariate.
- **`match_flag`** (matching < 75%): a flag only.

## 12. Analysis plan (for the preregistration)

- **Model:** trial-level mixed logistic regression, one per test:
  `correct ~ condition + test_position + (1 | subject) + (1 | item)`.
- **Test position:** a covariate. Its interaction with condition is exploratory.
- **Descriptives:** accuracy by test × position, so we can see whether colour is above chance when it comes first.
- **Known condition only:** closeness, voice closeness, likeness and "felt like" as predictors (exploratory).
- **Manipulation check:** "felt like" known vs. control.
- **Hypothesis signatures:** the four accounts map onto the condition × test pattern for word, identity and colour.
- **Power** (`analysis/power_v2.R`, 1,000 simulations per cell; results in `analysis/power_out/`):
  - Effect: a 10-point difference in mean accuracy between conditions, word and identity tested separately.
  - Total N needed (half per condition): 80% power at about 290, 90% at about 400–420.
  - If the participant SD is 1.0 rather than the pilot's 1.59: 80% at about 210–225, 90% at about 300.
  - Pilot 2 (N = 100) has 80% power only for a difference of about 17 points. It is sized for feasibility, not for the
    confirmatory test.

## 13. Pilot 2 logistics

- **N:** 100, with 50 per condition.
- **Expected duration:** the pilot-1 median was 14.0 min.
  - v2 adds the voice selector (about +1 min).
  - Controls now get the picture/notes pages and design freely, so the control condition gets about 1.5–2 min longer.
  - The odd/even task is about 15 s shorter than arithmetic.
  - Expected median: about 15–16 min. Set Prolific's estimate to **17 min** and the consent text to "about 17 minutes".
    Pay at the pilot-1 hourly rate.
- **Prolific settings:**
  - 100 places;
  - block pilot-1 participants (exclude participants from the pilot-1 study);
  - screen-out cap about 30;
  - the same three completion paths;
  - run in batches: 10 first, check the data, then the remaining 90.

## 14. Removed from pilot 1

- The 4 closeness categories and their prompts, IOS.
- The unfamiliar person ("Jordan") and unfamiliar-avatar scenes.
- Stranger-voiced greetings and labels, and the known/unfamiliar scene condition.
- `list`.
- The 2-option face test.
- The 45 s arithmetic as the default.
- The unique12 design.

Changed during the build:
- **Stranger sets.** In pilot 1, set X had 4 women and 2 men, and set Y had 2 women and 4 men. They are now
  rebalanced to 3 + 3, with one woman and one man per age band, using the same 12 faces:
  - X: str01, str13, str04, str03, str05, str06
  - Y: str07, str14, str10, str09, str11, str12

## 15. Decided at sign-off (2026-11-24)

- Relationship duration is kept, known condition only.
- Avery is not swapped when the control name is Alex.
