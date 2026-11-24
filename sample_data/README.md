# sample_data

Autopilot runs of v3.0, saved with `devsave=1` through `tools/dev_server.py`. They contain no real participant data.

| File | What it is |
|---|---|
| `T_known_known_Y_identity-colour-word_*` | complete known-condition run: stranger set Y, test order identity → colour → word, loaded with Prototype.js (`prototype=1`) |
| `T_control_control_X_word-colour-identity_*` | complete control-condition run: stranger set X, test order word → colour → identity |
| `mock_qualtrics_export.csv` | the two runs above as a Qualtrics export (3 header rows), made with `tools/make_mock_export.py` |

`*_qualtrics_fields.json` is every embedded-data field the experiment would write to Qualtrics (including the
`full_data_json_*` backup). `*_trials.csv` is jsPsych's own trial-level data.

To test the analysis pipeline:

```bash
python analysis/reshape_qualtrics.py sample_data/mock_qualtrics_export.csv -o data/mock --include-debug
```
```bash
Rscript analysis/v2_analysis.R data/mock
```

Two participants are too few for the mixed models; the script reports "(model failed)" or singular fits for them.
