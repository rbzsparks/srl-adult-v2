/* =====================================================================
 * config.js: every count, timing, name list and switch lives here.
 * Edit this file, push to GitHub Pages, and the live study picks it up.
 * Design: docs/V2_SPEC.md.
 * ===================================================================== */
window.SRL_CONFIG = {
  VERSION: '3.1.2',

  /* ---------- Qualtrics ---------- */
  // 'legacy' = classic layouts: Qualtrics.SurveyEngine.setEmbeddedData. 'nste' = New Survey Taking Experience (UNTESTED).
  QUALTRICS_ENGINE: 'legacy',
  JSON_CHUNK_CHARS: 15000,      // max characters per full_data_json_N chunk (Qualtrics limit is 20 KB per value)
  JSON_CHUNKS: 4,

  /* ---------- Prolific ---------- */
  // Placeholders. The repo is public: pass the real codes to tools/build_qsf.py with --out outside the repo.
  COMPLETION_CODE: 'COMPLETION_CODE',
  SCREENOUT_CODE: 'SCREENOUT_CODE',
  NOCONSENT_CODE: 'NOCONSENT_CODE',

  /* ---------- Secondary backup: DataPipe -> OSF (skipped in debug mode or while the ID is a placeholder) ---------- */
  DATAPIPE: { ENABLED: true, EXPERIMENT_ID: 'DATAPIPE_EXPERIMENT_ID', URL: 'https://pipe.jspsych.org/api/data/' },

  /* ---------- Assignment ---------- */
  // condition, stranger_set and test_order come from the Qualtrics randomizer (or the URL locally). If one is missing it
  // is drawn at random here and assign_fallback = 1 is recorded.
  CONDITIONS: ['known', 'control'],
  STRANGER_SETS: ['X', 'Y'],
  TEST_ORDERS: [
    ['word', 'identity', 'colour'], ['word', 'colour', 'identity'], ['identity', 'word', 'colour'],
    ['identity', 'colour', 'word'], ['colour', 'word', 'identity'], ['colour', 'identity', 'word']
  ],

  /* ---------- Switches ---------- */
  SURPRISE_TEST: true,          // true = incidental learning (no mention of a memory test)
  SHOW_NAME_LABEL: true,        // the avatar's name under the avatar in every scene (never the stranger's). name_label=0/1 overrides.
  MOUSEVIEW: false,             // blur-except-cursor spotlight + AOI dwell logging during scenes
  MOUSEVIEW_RADIUS: 0.08,
  MOUSEVIEW_BLUR_PX: 12,
  CONFIDENCE_RATINGS: false,    // 1-4 confidence after each test trial
  COLOUR_CHOICES: 4,            // options in the colour test: 4 (all colours) or 2 (target + one other)

  /* ---------- Timing (ms) ---------- */
  TIMING: {
    AVATAR_ENTER: 600,
    AFTER_ENTER_PAUSE: 300,
    RESPONSE: 900,              // stranger's response to the greeting: smile and one small nod
    BEFORE_LABEL_PAUSE: 300,
    JOINT_ATTENTION_LAG: 300,   // the stranger's eyes follow the avatar's gaze to the object
    OBJECT_PULSE: 300,
    SPACE_ENABLE_AFTER_LABEL: 1000,
    AUTO_ADVANCE_AFTER_LABEL: 15000,
    ISI: 500,
    FILLER1: 10000,             // "Get ready" countdown before the first scene
    FILLER2: 30000,             // delay task after the scenes (odd/even or arithmetic)
    PARITY_MAX_MS: 2000,        // odd/even is self-paced: a number stays up until F/J, at most this long (then a miss)
    FILLER2_DEADLINE: 3000,     // arithmetic only: response deadline per problem
    TEST_ITI: 400
  },
  DEBUG_TIMING: { FILLER1: 5000, FILLER2: 10000 },   // applied with ?debug=1

  /* ---------- Delay task ---------- */
  FILLER_TASK: 'parity',        // 'parity' (odd/even, F = odd, J = even) or 'arithmetic' (pilot 1)
  PARITY_FLAG_ACC: 0.75,        // parity_flag = 1 when accuracy among answered trials is below this ...
  PARITY_FLAG_MISSES: 4,        // ... or when this many numbers or more get no response
  FILLER2_ENGAGEMENT_MIN: 0.70, // arithmetic only: filler2_low_engagement = 1 below this accuracy

  /* ---------- Device ---------- */
  DEVICE: { MIN_SCREEN_W: 1024, MIN_SCREEN_H: 650, WINDOW_PROMPT_W: 1000, WINDOW_PROMPT_H: 600 },

  /* ---------- Stage (logical coordinates; scaled to fit the window) ---------- */
  STAGE_W: 1000,
  STAGE_H: 625,

  /* ---------- The avatar person ---------- */
  KNOWN_PROMPT: 'Think of one of your <b>closest friends or family members</b>: someone you feel very close to.',
  CLOSENESS_Q: 'How close is your relationship with <b>{name}</b>?',
  CLOSENESS_ANCHORS: { 1: 'Not close at all', 7: 'One of the closest people to me' },
  // Control: the avatar is for one of these names (gender-neutral, so any design and voice fits). onset = first sound.
  CONTROL_NAMES: [{ name: 'Sam', onset: 's' }, { name: 'Alex', onset: 'ae' }, { name: 'Jamie', onset: 'dj' }],
  NAME_INSTRUCTION: "Please type their first name, not a family title like 'Mom' or 'Grandpa.' Please do not name a romantic partner.",
  FAMILY_TITLES: ['mom', 'mum', 'mommy', 'mummy', 'mother', 'ma', 'mama', 'momma', 'dad', 'daddy', 'father', 'pa', 'papa', 'pop', 'pops',
    'grandma', 'grandpa', 'grandmother', 'grandfather', 'granny', 'gran', 'grandad', 'granddad', 'gramps', 'nana', 'nan', 'nanna',
    'abuela', 'abuelo', 'oma', 'opa', 'auntie', 'aunty', 'aunt', 'uncle', 'sis', 'sister', 'bro', 'brother', 'cousin',
    'son', 'daughter', 'niece', 'nephew', 'stepmom', 'stepdad', 'friend', 'boss', 'neighbor', 'neighbour', 'coworker'],
  RELATIONSHIP_TYPES: ['Friend', 'Parent', 'Sibling', 'Grandparent', 'Other relative', 'Coworker or classmate', 'Neighbor', 'Other'],
  KIN_TYPES: ['Parent', 'Sibling', 'Grandparent', 'Other relative'],
  CONTACT_FREQ: ['Every day or almost every day', 'A few times a week', 'About once a week', 'A few times a month', 'About once a month',
    'A few times a year', 'Less than once a year'],   // most to least often; coded 7 .. 1
  DURATION: ['Less than 1 year', '1–3 years', '3–5 years', '5–10 years', 'More than 10 years'],

  /* ---------- Stranger names (heard only, never shown in the scenes) ---------- */
  // Each name has its own backup. A name is swapped when it clashes with the typed name (same ignoring case, edit
  // distance <= NAME_CLASH_MAX_EDIT, or the same first NAME_CLASH_PREFIX letters), or when it starts with the same sound
  // as the control name. A swapped name takes its own backup, else the next unused backup that passes.
  STRANGER_NAMES: [
    { name: 'Riley', onset: 'r', backup: 'Rowan', backup_onset: 'r' },
    { name: 'Quinn', onset: 'kw', backup: 'Blair', backup_onset: 'b' },
    { name: 'Drew', onset: 'd', backup: 'Jesse', backup_onset: 'dj' },
    { name: 'Parker', onset: 'p', backup: 'Charlie', backup_onset: 'ch' },
    { name: 'Avery', onset: 'ei', backup: 'Hayden', backup_onset: 'h' },
    { name: 'Frankie', onset: 'f', backup: 'Jordan', backup_onset: 'dj' }
  ],
  FOIL_NAMES: ['Morgan', 'Taylor', 'Casey', 'Kendall', 'Emerson', 'Dakota'],   // matching-task foil only (shown, never heard)
  NAME_CLASH_MAX_EDIT: 2,
  NAME_CLASH_PREFIX: 3,

  /* ---------- Voices for the avatar ---------- */
  // Audio per voice: sel_<id>, greet_<name>_<id> (12 names), label_<word>_<id>, check_<word>_<id>. Casting:
  // experiment/audio/voice_casting.json.
  VOICES: [
    { id: 'fy', gender: 'woman', age: 'young' }, { id: 'my', gender: 'man', age: 'young' },
    { id: 'fm', gender: 'woman', age: 'middle' }, { id: 'mm', gender: 'man', age: 'middle' },
    { id: 'fo', gender: 'woman', age: 'older' }, { id: 'mo', gender: 'man', age: 'older' }
  ],
  VOICE_SAMPLE_TEXT: "Hi! It's so nice to see you.",

  /* ---------- Linking the avatar to the person ---------- */
  // binding=0/1 (URL / Qualtrics) overrides the first three for one participant.
  RECALL_ENABLED: true,         // known: recall prompts; control: the parallel "imagine" prompts. Notes shown beside the designer, never saved.
  REVISION_ENABLED: true,       // one-time "adjust the avatar?" offer after a low likeness rating
  REVISION_MAX_RATING: 4,
  MATCHING_ENABLED: true,       // avatar-name matching task (avatar vs a foil avatar with a foil name)
  MATCH_TRIALS_PER_TYPE: 6,     // 4 types (kk, ff, kf, fk) -> 24 trials
  MATCH_MAX_RT_MS: 2500,
  MATCH_FLAG_BELOW: 0.75,       // match_flag = 1 below this accuracy (flag only)
  // The foil avatar copies the group features of the designed avatar and differs as an individual (js/avatar_rules.js).
  AVATAR_UNFAM_K: 4,
  AVATAR_UNFAM_K_BALD_NO_FACIAL_HAIR: 5,
  AVATAR_UNFAM_STEP: 0.35,
  AVATAR_UNFAM_COLOUR_MAX_STEPS: 2,

  /* ---------- Check-ins during the scenes (about the avatar person only) ---------- */
  CHECKINS_ENABLED: true,       // checkins=0/1 overrides
  CHECKIN_AFTER_TRIALS: [3, 6, 9],

  /* ---------- Audio check ---------- */
  AUDIO_CHECK_WORDS: ['window', 'garden'],

  /* ---------- Paths (relative to the experiment base URL) ---------- */
  AUDIO_DIR: 'audio/',
  STIMULI_JSON: 'stimuli/stimuli.json',

  /* ---------- Copy ---------- */
  ESTIMATED_MINUTES: 17         // consent page (pilot 1 median 14 min; v2 adds the voice selector and the control picture/notes steps)
};
