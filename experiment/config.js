/* =====================================================================
 * config.js: every count, timing, code and [DECISION] flag lives here.
 * Edit this file, push to GitHub Pages, and the live study picks it up.
 * ===================================================================== */
window.SRL_CONFIG = {
  VERSION: '2.4.2',

  /* ---------- Design version ---------- */
  // 'unique12' = 12 scene sets, each shown once (36 test trials).
  // 'repeat6'  = 6 scene sets, each shown twice (18 test trials), with a stranger set X / Y.
  // Each .qsf passes design_version to the experiment; this value is only the fallback, recorded as
  // design_version_source = 'config_fallback' (a survey that did not pass it through then shows up in the data).
  DESIGN_VERSION: 'unique12',

  /* ---------- Qualtrics ---------- */
  // 'legacy' = classic layouts (Flat / Modern / Classic): Qualtrics.SurveyEngine.setEmbeddedData
  // 'nste'   = New Survey Taking Experience: Qualtrics.SurveyEngine.setJSEmbeddedData and
  //            __js_-prefixed fields in the survey flow. UNTESTED, see README.
  QUALTRICS_ENGINE: 'legacy',
  // Max characters per full_data_json_N chunk (Qualtrics limit is 20 KB per value).
  JSON_CHUNK_CHARS: 15000,
  JSON_CHUNKS: 4,

  /* ---------- Prolific ---------- */
  COMPLETION_CODE: 'COMPLETION_CODE',   // placeholder; also set in the .qsf end-of-survey redirect
  SCREENOUT_CODE: 'SCREENOUT_CODE',     // placeholder; used only by the device-check branch in Qualtrics
  NOCONSENT_CODE: 'NOCONSENT_CODE',     // placeholder; consent-declined branch (Prolific path "No consent" -> Request a return)
  // The repo is public: keep these as placeholders and pass the real codes to tools/build_qsf.py with --out outside the repo.

  /* ---------- Secondary backup: DataPipe -> OSF ---------- */
  DATAPIPE: {
    ENABLED: true,                       // skipped automatically in debug mode or while the ID is a placeholder
    EXPERIMENT_ID: 'DATAPIPE_EXPERIMENT_ID',
    URL: 'https://pipe.jspsych.org/api/data/'
  },

  /* ---------- [DECISION] flags ---------- */
  SURPRISE_TEST: true,          // true = incidental learning (no mention of a memory test)
  SHOW_NAME_LABEL: true,        // true = the known/unfamiliar person's name is shown as text beneath them in every scene.
                                // Per-participant override: URL / Qualtrics embedded field name_label=1 (show) or 0 (hide).
                                // Recorded as name_label_shown.
  MOUSEVIEW: false,             // blur-except-cursor spotlight + AOI dwell logging during scenes
  MOUSEVIEW_RADIUS: 0.08,       // spotlight radius as a fraction of stage width
  MOUSEVIEW_BLUR_PX: 12,
  TEST_BLOCK_ORDER_MODE: 'fixed',               // 'fixed' or 'counterbalanced' (random of 6 orders)
  TEST_BLOCK_ORDER_FIXED: ['word', 'face', 'incid'],
  CONFIDENCE_RATINGS: false,    // 1-4 confidence after each test trial
  AUDIO_CHECK_EXCLUDES: false,  // false = failed audio check is flagged only (never screened out)

  /* ---------- Timing (ms) ---------- */
  TIMING: {
    STRANGER_ENTER: 600,
    AFTER_ENTER_PAUSE: 300,
    RESPONSE: 900,              // other person's nonverbal response after greeting
    BEFORE_LABEL_PAUSE: 300,
    JOINT_ATTENTION_LAG: 300,   // other person's eyes follow stranger's gaze to the object
    OBJECT_PULSE: 300,
    SPACE_ENABLE_AFTER_LABEL: 1000,
    AUTO_ADVANCE_AFTER_LABEL: 15000,
    ISI: 500,
    FILLER1: 10000,             // "Get ready" countdown (15 s before v2.4.2) between the scene instructions and the first scene
    FILLER2: 45000,             // arithmetic verification after the scenes (retention delay)
    FILLER2_DEADLINE: 3000,     // response deadline per arithmetic problem (counts as an error if missed)
    TEST_ITI: 400
  },
  // Overrides applied when ?debug=1 (or Qualtrics embedded field debug=1)
  DEBUG_TIMING: {
    FILLER1: 5000,
    FILLER2: 15000
  },
  FILLER2_ENGAGEMENT_MIN: 0.70, // filler2_low_engagement = 1 when arithmetic accuracy is below this

  /* ---------- Device ---------- */
  DEVICE: {
    MIN_SCREEN_W: 1024,         // screen check (screen.width/height) runs in Qualtrics before consent
    MIN_SCREEN_H: 650,
    WINDOW_PROMPT_W: 1000,      // if the browser window is smaller, ask to maximize (never reject)
    WINDOW_PROMPT_H: 600
  },

  /* ---------- Stage (logical coordinates; scaled to fit the window) ---------- */
  STAGE_W: 1000,
  STAGE_H: 625,

  /* ---------- Closeness categories (between subjects; set by Qualtrics Randomizer) ---------- */
  CATEGORIES: {
    acquaintance: 'Think of an <b>acquaintance</b>: someone you know by name and see from time to time, but are not close to (for example, a coworker, classmate, neighbor, or distant relative).',
    moderate: 'Think of a <b>friend or family member you are somewhat close to</b>, but who is not one of your very closest people.',
    close: 'Think of one of your <b>closest friends or family members</b>: someone you feel very close to.',
    // Control (v2.4): no real person. The participant copies a random target avatar, which is then given a name from
    // CONTROL_NAMES. The questions about the known person (name, relationship, closeness, contact, duration, recall
    // notes, the post-scene "felt like" rating) are skipped; everything from the confirmation screen on is the same.
    control: null
  },
  CONTROL_NAMES: ['Sam', 'Robin', 'Drew', 'Kendall', 'Blake', 'Harper', 'Parker', 'Logan'],
  NAME_INSTRUCTION: "Please type their first name, not a family title like 'Mom' or 'Grandpa.' Please do not name a romantic partner.",
  FAMILY_TITLES: ['mom', 'mum', 'mommy', 'mummy', 'mother', 'ma', 'mama', 'momma', 'dad', 'daddy', 'father', 'pa', 'papa', 'pop', 'pops',
    'grandma', 'grandpa', 'grandmother', 'grandfather', 'granny', 'gran', 'grandad', 'granddad', 'gramps', 'nana', 'nan', 'nanna',
    'abuela', 'abuelo', 'oma', 'opa', 'auntie', 'aunty', 'aunt', 'uncle', 'sis', 'sister', 'bro', 'brother', 'cousin',
    'son', 'daughter', 'niece', 'nephew', 'stepmom', 'stepdad', 'friend', 'boss', 'neighbor', 'neighbour', 'coworker'],

  RELATIONSHIP_TYPES: ['Friend', 'Parent', 'Sibling', 'Grandparent', 'Other relative', 'Coworker or classmate', 'Neighbor', 'Other'],
  KIN_TYPES: ['Parent', 'Sibling', 'Grandparent', 'Other relative'],
  // Both contact questions (in person / other ways) use these options, most to least often; coded 7 .. 1.
  CONTACT_FREQ: ['Every day or almost every day', 'A few times a week', 'About once a week', 'A few times a month', 'About once a month',
    'A few times a year', 'Less than once a year'],
  DURATION: ['Less than 1 year', '1–3 years', '3–5 years', '5–10 years', 'More than 10 years'],

  /* ---------- Linking the avatar to the person (PERSON_BINDING_SETUP.md) ---------- */
  // Each switch skips its step and leaves its fields blank. binding=0/1 (URL / Qualtrics embedded data) overrides the
  // first three for one participant; recorded as recall_enabled, revision_enabled, matching_enabled, steps_source.
  RECALL_ENABLED: true,         // recall prompts + notes shown beside the designer (notes never saved)
  REVISION_ENABLED: true,       // one-time "adjust the avatar?" offer after a low likeness rating
  REVISION_MAX_RATING: 4,       // offered when the likeness rating is this or lower
  MATCHING_ENABLED: true,       // avatar–name matching task
  MATCH_TRIALS_PER_TYPE: 6,     // 4 types (kk, uu, ku, uk) -> 24 trials
  MATCH_MAX_RT_MS: 2500,
  MATCH_FLAG_BELOW: 0.75,       // match_flag = 1 when total accuracy is below this (flag only)

  /* ---------- Person check-ins during familiarization (PERSON_CHECKINS.md) ---------- */
  // checkins=0/1 overrides CHECKINS_ENABLED for one participant (recorded as checkins_enabled, steps_source).
  CHECKINS_ENABLED: true,
  CHECKIN_AFTER_TRIALS: [3, 6, 9],

  /* ---------- Unfamiliar person ---------- */
  UNFAMILIAR_NAMES: ['Jordan', 'Taylor', 'Casey', 'Morgan', 'Riley', 'Avery', 'Quinn', 'Jamie', 'Rowan', 'Emery', 'Reese', 'Sasha'],
  // The unfamiliar person copies the group features and differs as an individual (rules in js/avatar_rules.js).
  AVATAR_UNFAM_K: 4,                       // identity sliders moved
  AVATAR_UNFAM_K_BALD_NO_FACIAL_HAIR: 5,   // identity sliders moved when the known person is bald with no facial hair
  AVATAR_UNFAM_STEP: 0.35,                 // move per identity slider (sliders run 0-1)
  AVATAR_UNFAM_COLOUR_MAX_STEPS: 2,        // largest hair-colour change on the natural scale

  /* ---------- Face-test foils ----------
   * Foils are FIXED in stimuli/stimuli.json. These two values are read by tools/make_foils.html when the foils are
   * (re)generated; changing them here does nothing until the foils are regenerated and the stimulus file redeployed. */
  FOIL_K: 4,                               // identity sliders moved per foil
  FOIL_STEP: 0.35,                         // foil difficulty: move per identity slider

  /* ---------- Audio check ---------- */
  AUDIO_CHECK_WORDS: ['window', 'garden'],

  /* ---------- Paths (relative to the experiment base URL) ---------- */
  AUDIO_DIR: 'audio/',
  STIMULI_JSON: 'stimuli/stimuli.json',
  STIMULI_JSON_REPEAT6: 'stimuli/stimuli_repeat6.json',

  /* ---------- Copy ---------- */
  // v2.3 adds about 2 min 40 s (recall, confirmation, introduction, matching, check-ins). The repeat6 pilot of
  // 2026-11-18 took 10.4 min before these steps, so both numbers are probably generous; revisit after more pilots.
  ESTIMATED_MINUTES: 22,          // unique12 (consent page of qualtrics/survey.qsf)
  ESTIMATED_MINUTES_REPEAT6: 20   // repeat6 (consent page of qualtrics/repeat6/survey.qsf)
};
