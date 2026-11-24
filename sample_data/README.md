# Sample data (v2.3.0 debug runs with Prototype.js loaded; fillers shortened to 5 s countdown + 15 s arithmetic; autopilot responses)

| File | What it is |
|---|---|
| `u12_auto1_close_A_*` | a complete **unique12** run, started without `design_version` (so `design_version_source = config_fallback`), with every v2.3 step on. `_trials.csv` = jsPsych trial-level CSV (participant columns repeated); `_qualtrics_fields.json` = exactly what would be written to Qualtrics embedded data |
| `u12_auto2_control_B_*` | a complete **unique12** run in the **control** category (v2.4; list B): copy a random avatar (`target_avatar`, `copy_*`), named `control_name`; every known-person field and `represent_rating` blank |
| `r6_auto1_close_AY_*` | a complete **repeat6** run (list A / stranger set Y), every v2.3 step on: recall, revision (the autopilot rates 4 first, so the revision is always taken), matching (24 trials in the JSON `match`), 3 check-ins (JSON `checkins`) |
| `r6_auto2_moderate_BX_*` | a complete **repeat6** run (list B / set X) with `binding=0&checkins=0`: the recall, revision, matching and check-in fields are blank, `steps_source = override` |
| `r6_reload_acquaintance_AX_*` | a repeat6 run reloaded during familiarization → `reloaded_post_fam = 1`, `reload_stage = fam`, no trial data |
| `mock_qualtrics_export.csv`, `mock_qualtrics_export_repeat6.csv` | fake Qualtrics exports (3-row header), one per survey (the unique12 one has the close and the control run), built by `tools/make_mock_export.py` (`--design repeat6`) |
| `sample_long_format.csv`, `sample_long_format_repeat6.csv` | `analysis/reshape_qualtrics.py <export> --include-debug` → one row per trial (familiarization, test, and `phase = checkin` rows), with `serial_position` (and for repeat6 `presentation`, `lag`, `serial_position_2`), `k`, `f` and the unpacked `known_*` / `unfam_*` feature columns |
| `_preview/*.png` | rendered unique12 stimuli from v2.2: novel objects, strangers + foils, incidental objects × 4 colors, a scene's final frame, the face test, and four designer sections. The curly / coily styles and the bob were redrawn in v2.3; see `tools/hair_review.html` for the current drawings |

Autopilot responses are random, so accuracy values are meaningless.
