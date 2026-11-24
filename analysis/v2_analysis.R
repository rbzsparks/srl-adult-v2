# SRL adult v2: analysis of the files written by analysis/reshape_qualtrics.py (docs/V2_SPEC.md §11-12).
#   Rscript analysis/v2_analysis.R <data_dir> [fig_dir]
# data_dir holds participants.csv and test_trials.csv. Code external_aid (0/1) in participants.csv from `strategy` first.
# Exclusions are analysis exclusions only: nobody is rejected or paid less on Prolific because of them.
suppressMessages({ library(dplyr); library(tidyr); library(ggplot2); library(lme4) })
args <- commandArgs(TRUE)
data_dir <- if (length(args) >= 1) args[1] else "data/pilot2"
fig_dir <- if (length(args) >= 2) args[2] else file.path(data_dir, "figures")
dir.create(fig_dir, showWarnings = FALSE, recursive = TRUE)
CHANCE <- c(word = 0.25, identity = 0.25, colour = 0.25)   # colour: 0.5 if colour_choices = 2
TESTS <- c("word", "identity", "colour")

p <- read.csv(file.path(data_dir, "participants.csv"), stringsAsFactors = FALSE)
tr <- read.csv(file.path(data_dir, "test_trials.csv"), stringsAsFactors = FALSE)
if (any(p$colour_choices == 2, na.rm = TRUE)) CHANCE["colour"] <- 0.5

## 1. Exclusions ----------------------------------------------------------------------------------------------------------
is1 <- function(x) !is.na(x) & x == 1
p <- p %>% mutate(
  ex_attention = is1(1 - attention_check_1_pass) | is1(1 - attention_check_2_pass),
  ex_delay     = ifelse(filler_task == "arithmetic", !is.na(filler2_accuracy) & filler2_accuracy < 0.6, is1(parity_flag)),
  ex_matching  = (!is.na(match_acc_total) & match_acc_total < 0.5) | is1(match_no_response),
  ex_aid       = is1(external_aid),
  ex_timeouts  = !is.na(fam_timeout_count) & fam_timeout_count >= 3,
  ex_audio     = !is.na(audio_check_pass) & audio_check_pass == 0,
  ex_reload    = is1(reloaded_post_fam),
  excluded     = ex_attention | ex_delay | ex_matching | ex_aid | ex_timeouts | ex_audio | ex_reload)
if (all(is.na(p$external_aid))) message("NOTE: external_aid is not coded yet (all blank): code it from `strategy`.")
cat("\n== Exclusions (a participant can meet several rules) ==\n")
print(p %>% group_by(condition) %>% summarise(n = n(), across(starts_with("ex_"), sum), excluded = sum(excluded)), width = 200)
print(p %>% filter(excluded) %>% select(subject, condition, starts_with("ex_")), row.names = FALSE)
pa <- p %>% filter(!excluded)
d <- tr %>% semi_join(pa, by = "subject") %>%
  left_join(pa %>% select(subject, closeness, voice_closeness, likeness_rating, represent_rating), by = "subject") %>%
  mutate(condition = factor(condition, c("control", "known")), test = factor(test, TESTS), position = factor(test_position),
         item = ifelse(test == "identity", stranger_id, scene_set))

## 2. Sample and balance ----------------------------------------------------------------------------------------------------
cat("\n== Analysed sample ==\n")
print(with(pa, table(condition, stranger_set)))
print(with(pa, table(test_order, condition)))

## 3. Accuracy by condition x test, and by test x position ----------------------------------------------------------------------
ci <- function(x) { m <- mean(x); s <- sd(x) / sqrt(length(x)); q <- qt(0.975, max(1, length(x) - 1)); c(mean = m, lo = m - q * s, hi = m + q * s, n = length(x)) }
subj <- d %>% group_by(subject, condition, test, position) %>% summarise(acc = mean(correct), .groups = "drop")
by_cond <- subj %>% group_by(test, condition) %>% summarise(as.data.frame(t(ci(acc))), .groups = "drop")
by_pos <- subj %>% group_by(test, position) %>% summarise(as.data.frame(t(ci(acc))), .groups = "drop")
cat("\n== Accuracy by condition (participant means, 95% CI) ==\n"); print(by_cond, digits = 3)
cat("\n== Accuracy by test position ==\n"); print(by_pos, digits = 3)
cat("\n== Pooled accuracy vs chance (exact binomial) ==\n")
for (t in TESTS) { x <- d$correct[d$test == t]; b <- binom.test(sum(x), length(x), CHANCE[[t]])
  cat(sprintf("%-8s %.3f (chance %.2f), p = %.3g\n", t, mean(x), CHANCE[[t]], b$p.value)) }
cat("\n== Colour accuracy when colour came first, vs chance ==\n")
x <- d$correct[d$test == "colour" & d$test_position == 1]
if (length(x)) { b <- binom.test(sum(x), length(x), CHANCE[["colour"]]); cat(sprintf("%.3f, n trials = %d, p = %.3g\n", mean(x), length(x), b$p.value)) }

## 4. Planned models: correct ~ condition + test_position + (1 | subject) + (1 | item), one per test --------------------------------
fit <- function(f, dd) tryCatch(suppressMessages(glmer(f, dd, family = binomial, control = glmerControl(optimizer = "bobyqa"))), error = function(e) NULL)
report <- function(m, term) {
  if (is.null(m)) return(cat("  (model failed)\n"))
  cf <- coef(summary(m)); r <- cf[grep(term, rownames(cf)), , drop = FALSE]
  for (i in seq_len(nrow(r))) cat(sprintf("  %-22s OR %.2f [%.2f, %.2f], z = %.2f, p = %.3g%s\n", rownames(r)[i], exp(r[i, 1]),
    exp(r[i, 1] - 1.96 * r[i, 2]), exp(r[i, 1] + 1.96 * r[i, 2]), r[i, 3], r[i, 4], if (isSingular(m)) "  (singular fit)" else ""))
}
cat("\n== Planned: condition effect (known vs control), adjusting for test position ==\n")
for (t in TESTS) { cat(t, "\n"); report(fit(correct ~ condition + position + (1 | subject) + (1 | item), filter(d, test == t)), "condition|position") }
cat("\n== Exploratory: condition x position ==\n")
for (t in TESTS) { cat(t, "\n"); report(fit(correct ~ condition * position + (1 | subject) + (1 | item), filter(d, test == t)), ":") }

## 5. Manipulation check and known-condition covariates -----------------------------------------------------------------------
cat("\n== 'How much did [name] feel like someone you know?' (1-7) ==\n")
print(pa %>% group_by(condition) %>% summarise(n = n(), mean = mean(represent_rating, na.rm = TRUE), sd = sd(represent_rating, na.rm = TRUE)))
if (length(unique(pa$condition)) == 2) print(wilcox.test(represent_rating ~ condition, pa, exact = FALSE))
cat("\n== Known condition: ratings as predictors of accuracy (z-scored; exploratory) ==\n")
dk <- filter(d, condition == "known")
for (v in c("closeness", "voice_closeness", "likeness_rating", "represent_rating")) for (t in TESTS) {
  dd <- filter(dk, test == t, !is.na(.data[[v]])) %>% mutate(z = as.numeric(scale(.data[[v]])))
  if (nrow(dd) == 0 || sd(dd[[v]]) == 0) next
  cat(sprintf("%s -> %s\n", v, t)); report(fit(correct ~ z + position + (1 | subject) + (1 | item), dd), "^z$")
}

## 6. Descriptives: flags, voices, names ------------------------------------------------------------------------------------------
cat("\n== Flags and choices (analysed sample) ==\n")
print(pa %>% group_by(condition) %>% summarise(match_acc = mean(match_acc_total, na.rm = TRUE), match_flag = sum(match_flag == 1, na.rm = TRUE),
  parity_acc = mean(parity_acc, na.rm = TRUE), parity_misses = mean(parity_misses, na.rm = TRUE), name_swaps = sum(name_swaps > 0, na.rm = TRUE),
  likeness = mean(likeness_rating, na.rm = TRUE), revised = sum(revised == 1, na.rm = TRUE)))
print(with(pa, table(voice_id, condition)))
cat("
== Control: copy targets (balanced by the Qualtrics randomizer) and how closely they were copied ==
")
print(pa %>% filter(condition == "control") %>% group_by(control_target) %>%
  summarise(n = n(), copy_err = mean(copy_err, na.rm = TRUE), features_missed = mean(copy_n_miss, na.rm = TRUE),
            likeness_to_target = mean(likeness_rating, na.rm = TRUE), revised = sum(revised == 1, na.rm = TRUE)))

## 7. Figures -----------------------------------------------------------------------------------------------------------------
pal <- c(control = "#7C8B95", known = "#3A9AB8")
chance_df <- data.frame(test = factor(TESTS, TESTS), chance = CHANCE[TESTS])
g1 <- ggplot(by_cond, aes(condition, mean, colour = condition)) +
  geom_hline(data = chance_df, aes(yintercept = chance), linetype = "dashed", colour = "grey60") +
  geom_jitter(data = subj %>% group_by(subject, condition, test) %>% summarise(acc = mean(acc), .groups = "drop"), aes(y = acc),
              width = 0.12, height = 0.02, alpha = 0.3, size = 1.4) +
  geom_pointrange(aes(ymin = lo, ymax = hi), size = 0.6, linewidth = 0.9) + facet_wrap(~test) +
  scale_colour_manual(values = pal, guide = "none") + coord_cartesian(ylim = c(0, 1)) +
  labs(x = NULL, y = "Accuracy (participant mean, 95% CI)", title = "Accuracy by condition") + theme_minimal(base_size = 12)
g2 <- ggplot(subj %>% group_by(test, position, condition) %>% summarise(as.data.frame(t(ci(acc))), .groups = "drop"),
             aes(position, mean, colour = condition)) +
  geom_hline(data = chance_df, aes(yintercept = chance), linetype = "dashed", colour = "grey60") +
  geom_pointrange(aes(ymin = lo, ymax = hi), position = position_dodge(0.4)) + facet_wrap(~test) +
  scale_colour_manual(values = pal) + coord_cartesian(ylim = c(0, 1)) +
  labs(x = "Test position (block)", y = "Accuracy (95% CI)", colour = NULL, title = "Accuracy by test position") + theme_minimal(base_size = 12) +
  theme(legend.position = "bottom")
g3 <- ggplot(pa, aes(condition, represent_rating, colour = condition)) + geom_jitter(width = 0.15, height = 0.1, alpha = 0.5) +
  stat_summary(fun.data = mean_cl_normal, colour = "black") + scale_colour_manual(values = pal, guide = "none") +
  scale_y_continuous(breaks = 1:7) + coord_cartesian(ylim = c(0.8, 7.2)) + labs(x = NULL, y = "Felt like someone you know (1-7)") + theme_minimal(base_size = 12)
ggsave(file.path(fig_dir, "accuracy_by_condition.png"), g1, width = 8, height = 4, dpi = 200, bg = "white")
ggsave(file.path(fig_dir, "accuracy_by_position.png"), g2, width = 8, height = 4.2, dpi = 200, bg = "white")
ggsave(file.path(fig_dir, "felt_like_by_condition.png"), g3, width = 4, height = 4, dpi = 200, bg = "white")
cat("\nFigures saved to", fig_dir, "\n")
