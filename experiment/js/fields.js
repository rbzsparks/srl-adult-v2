/* fields.js: the single list of Qualtrics embedded-data fields written by the experiment.
 * Read by data.js (JS) and by tools/build_qsf.py and analysis/reshape_qualtrics.py (Python parses the object
 * literal after "window.SRL_FIELDS ="). Keep it valid JSON.
 * "designs" overrides the lists for the repeat6 version (participant_extra is appended to participant). */
window.SRL_FIELDS = {
  "participant": [
    "design_version", "design_version_source",
    "category", "list", "relationship_type", "is_kin", "ios", "contact_inperson", "contact_remote", "contact_max", "duration",
    "name_length", "name_flagged_title", "name_suspect",
    "recall_enabled", "revision_enabled", "matching_enabled", "checkins_enabled", "steps_source",
    "recall_ms", "recall_chars_1", "recall_chars_2", "recall_chars_3",
    "known_avatar", "unfamiliar_avatar", "unfam_changes", "unfam_k", "unfam_identity_dist", "unfamiliar_name",
    "control_name", "target_avatar", "copy_intro_ms", "copy_err_1", "copy_n_miss_1", "copy_miss_1", "copy_err", "copy_n_miss", "copy_miss",
    "likeness_rating", "likeness_rt_ms", "likeness_1", "revision_offered", "revised", "likeness_2", "designer_ms_2", "designer_edits_2",
    "confirm_ms", "jordan_intro_ms",
    "match_keymap", "match_acc_kk", "match_acc_uu", "match_acc_ku", "match_acc_uk",
    "match_rt_med_kk", "match_rt_med_uu", "match_rt_med_ku", "match_rt_med_uk", "match_acc_total", "match_n_timeout", "match_flag",
    "checkin_order",
    "checkin_1_qid", "checkin_1_first", "checkin_1_after_trial", "checkin_1_known_resp", "checkin_1_known_rt_ms", "checkin_1_unf_resp", "checkin_1_unf_rt_ms",
    "checkin_2_qid", "checkin_2_first", "checkin_2_after_trial", "checkin_2_known_resp", "checkin_2_known_rt_ms", "checkin_2_unf_resp", "checkin_2_unf_rt_ms",
    "checkin_3_qid", "checkin_3_first", "checkin_3_after_trial", "checkin_3_known_resp", "checkin_3_known_rt_ms", "checkin_3_unf_resp", "checkin_3_unf_rt_ms",
    "represent_rating", "represent_rt_ms",
    "designer_edits", "designer_resets", "designer_tabs_visited",
    "designer_edits_skin", "designer_edits_face", "designer_edits_eyes", "designer_edits_nosemouth", "designer_edits_hair", "designer_edits_extras",
    "t_designer_skin_ms", "t_designer_face_ms", "t_designer_eyes_ms", "t_designer_nosemouth_ms", "t_designer_hair_ms", "t_designer_extras_ms",
    "audio_check_pass", "audio_check_attempts",
    "filler2_accuracy", "filler2_n_attempted", "filler2_n_timeout", "filler2_low_engagement",
    "fam_fast_advance_count", "fam_timeout_count",
    "fullscreen_exits", "tab_switches", "total_ms", "test_block_order",
    "reload_pre_fam", "reloaded_post_fam", "reload_stage",
    "t_intro_ms", "t_setup_ms", "t_recall_ms", "t_designer_ms", "t_binding_ms", "t_matching_ms", "t_audio_check_ms", "t_filler1_ms", "t_fam_ms",
    "t_checkin_ms", "t_filler2_ms", "t_test_ms",
    "js_start_epoch_ms", "js_end_epoch_ms",
    "exp_version", "qualtrics_engine", "surprise_test", "name_label_shown", "mouseview_on", "debug", "seed",
    "browser", "screen_w", "screen_h", "window_w", "window_h", "window_small_prompt",
    "audio_load_errors", "audio_simulated_scenes", "word_foil_vowel_relaxed", "js_error"
  ],
  "fam_prefix": "fam_",
  "fam_count": 12,
  "fam_per_scene": ["scene_set_id", "serial_position", "condition", "stranger_id", "word", "incidental_type", "incidental_color", "view_ms", "timed_out", "label_audio_ms"],
  "test_types": ["word", "face", "incid"],
  "scene_set_ids": ["s01", "s02", "s03", "s04", "s05", "s06", "s07", "s08", "s09", "s10", "s11", "s12"],
  "test_per_trial": ["choice", "correct", "rt_ms", "foils", "position"],
  "json_prefix": "full_data_json_",
  "json_chunks": 4,
  "json_meta": ["full_data_json_n", "full_data_json_truncated"],
  "designs": {
    "repeat6": {
      "participant_extra": ["stranger_set"],
      "fam_per_scene": ["scene_set_id", "presentation", "serial_position", "lag", "condition", "stranger_id", "word", "incidental_type", "incidental_color", "view_ms", "timed_out", "label_audio_ms"],
      "scene_set_ids": ["ss1", "ss2", "ss3", "ss4", "ss5", "ss6"]
    }
  }
};
