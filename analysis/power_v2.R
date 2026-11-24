# Power for v2: condition (known vs control) effect on word and identity accuracy.
# Simulates the planned model, correct ~ condition + test_position + (1 | subject) + (1 | item), one model per test,
# Wald test on condition, two-sided alpha = .05.
#
#   Rscript analysis/power_v2.R [pilot_data_dir] [n_sim] [out_dir]
#
# pilot_data_dir: folder with pilot_participants.csv and pilot_test_trials.csv (pilot 1, not in this repo). Without it,
# the variance estimates below (from the 24 analysed pilot-1 participants) are used.
suppressMessages({ library(lme4); library(parallel); library(ggplot2) })
args <- commandArgs(TRUE)
pilot_dir <- if (length(args) >= 1 && nzchar(args[1])) args[1] else NA
n_sim <- if (length(args) >= 2) as.integer(args[2]) else 500
out_dir <- if (length(args) >= 3) args[3] else "analysis/power_out"
dir.create(out_dir, showWarnings = FALSE, recursive = TRUE)

## 1. Assumptions ------------------------------------------------------------------------------------------------------
EXCLUDED <- c("P09", "P10", "P12", "P13", "P16", "P19", "P24", "P30")   # pilot-1 rule-based exclusions
SD_SUBJ <- 1.59; SD_ITEM_PILOT <- 0                                     # pilot-1 word test, logit scale
if (!is.na(pilot_dir)) {
  p <- read.csv(file.path(pilot_dir, "pilot_participants.csv"))
  t <- read.csv(file.path(pilot_dir, "pilot_test_trials.csv"))
  w <- merge(t[t$test == "word" & !t$subject %in% EXCLUDED, ], p[, c("subject", "condition")])
  vc <- as.data.frame(VarCorr(glmer(correct ~ 1 + (1 | subject) + (1 | scene_set), w, family = binomial)))
  SD_SUBJ <- vc$sdcor[vc$grp == "subject"]; SD_ITEM_PILOT <- vc$sdcor[vc$grp == "scene_set"]
  # Pilot-observed effect, for reference only (about 6 per group; not used to set N). Closest analogue to v2: word
  # accuracy in scenes with the avatar, close condition vs controls. In pilot 1 the stranger did the talking.
  k <- w[w$scene_condition == "known" & w$condition %in% c("close", "control"), ]
  obs_n <- tapply(k$subject, k$condition, function(s) length(unique(s)))
  cat(sprintf("Pilot-observed (reference only): word accuracy close = %.0f%% (n = %d), control = %.0f%% (n = %d)\n",
              100 * mean(k$correct[k$condition == "close"]), obs_n["close"],
              100 * mean(k$correct[k$condition == "control"]), obs_n["control"]))
}
SD_ITEM <- max(SD_ITEM_PILOT, 0.3)        # 6 items give a singular (0) estimate; assume a modest item SD
BASE <- c(word = 0.58, identity = 0.40)   # word: pilot mean; identity (4AFC name -> face): assumed, no pilot analogue
POS <- c(0, -0.15, -0.30)                 # assumed logit drop for a test in 2nd / 3rd position (balanced by design)
N_ITEMS <- c(word = 6, identity = 12)     # identity items = faces: 6 per stranger set
cat(sprintf("SD subject = %.2f, SD item = %.2f (pilot %.2f), %d simulations per cell\n", SD_SUBJ, SD_ITEM, SD_ITEM_PILOT, n_sim))

## 2. Calibration: effects are differences in mean accuracy (averaged over people, items and positions) ----------------
marg <- function(b, sd) mean(sapply(POS, function(ps) integrate(function(z) plogis(b + ps + z * sd) * dnorm(z), -Inf, Inf)$value))
intercepts <- function(test, diff, sd_subj) {
  sd <- sqrt(sd_subj^2 + SD_ITEM^2)
  sapply(c(control = -0.5, known = 0.5), function(s) uniroot(function(b) marg(b, sd) - (BASE[[test]] + s * diff), c(-10, 10))$root)
}

## 3. One simulated study ----------------------------------------------------------------------------------------------
ORDERS <- list(c(1, 2, 3), c(1, 3, 2), c(2, 1, 3), c(2, 3, 1), c(3, 1, 2), c(3, 2, 1))  # position of word / identity / colour
sim_p <- function(n_total, test, b, sd_subj) {
  s <- data.frame(subj = seq_len(n_total), cond = rep(c("control", "known"), length.out = n_total))
  s$set <- ave(s$subj, s$cond, FUN = function(i) rep(1:2, length.out = length(i)))          # stranger set within condition
  s$ord <- ave(s$subj, s$cond, s$set, FUN = function(i) rep(1:6, length.out = length(i)))   # order within condition x set
  s$pos <- sapply(s$ord, function(o) ORDERS[[o]][if (test == "word") 1 else 2])
  s$u <- rnorm(n_total, 0, sd_subj)
  w <- rnorm(N_ITEMS[[test]], 0, SD_ITEM)
  d <- s[rep(s$subj, each = 6), ]
  d$item <- if (test == "word") rep(1:6, n_total) else (d$set - 1) * 6 + rep(1:6, n_total)
  d$y <- rbinom(nrow(d), 1, plogis(b[d$cond] + POS[d$pos] + d$u + w[d$item]))
  d$pos <- factor(d$pos)
  fit <- tryCatch(suppressMessages(glmer(y ~ cond + pos + (1 | subj) + (1 | item), d, family = binomial,
                                         control = glmerControl(optimizer = "bobyqa", calc.derivs = FALSE))), error = function(e) NULL)
  if (is.null(fit)) return(NA_real_)
  coef(summary(fit))["condknown", "Pr(>|z|)"]
}

## 4. Grid ---------------------------------------------------------------------------------------------------------------
grid <- rbind(
  expand.grid(test = c("word", "identity"), n = c(100, 200, 300, 400, 500, 600), diff = 0.10, sd_subj = SD_SUBJ, set = "N for a 10-point difference"),
  expand.grid(test = c("word", "identity"), n = c(100, 200, 300, 400, 500, 600), diff = 0.10, sd_subj = 1.0, set = "Sensitivity: SD subject = 1.0"),
  expand.grid(test = c("word", "identity"), n = 100, diff = c(0.15, 0.20, 0.25, 0.30), sd_subj = SD_SUBJ, set = "What N = 100 can detect"),
  stringsAsFactors = FALSE)
grid$test <- as.character(grid$test)

cl <- makeCluster(max(1, min(detectCores() - 2, 16)))
clusterSetRNGStream(cl, 20261124)
clusterExport(cl, c("sim_p", "ORDERS", "POS", "N_ITEMS", "SD_ITEM"))
invisible(clusterEvalQ(cl, suppressMessages(library(lme4))))
res <- do.call(rbind, lapply(seq_len(nrow(grid)), function(i) {
  g <- grid[i, ]; b <- intercepts(g$test, g$diff, g$sd_subj)
  ps <- unlist(parLapply(cl, seq_len(n_sim), function(k, n, test, b, sd) sim_p(n, test, b, sd), g$n, g$test, b, g$sd_subj))
  ok <- !is.na(ps)
  cat(sprintf("[%d/%d] %s, %s, N = %d, %.0f points: power %.2f\n", i, nrow(grid), g$set, g$test, g$n, 100 * g$diff, mean(ps[ok] < 0.05)))
  flush.console()
  cbind(g, power = mean(ps[ok] < 0.05), mc_se = sqrt(mean(ps[ok] < 0.05) * (1 - mean(ps[ok] < 0.05)) / sum(ok)), failed = sum(!ok))
}))
stopCluster(cl)
res$diff <- 100 * res$diff
write.csv(res, file.path(out_dir, "power_results.csv"), row.names = FALSE)

## 5. Summary --------------------------------------------------------------------------------------------------------------
cross <- function(x, y, target) { i <- which(y >= target)[1]; if (is.na(i)) return(NA); if (i == 1) return(x[1]); x[i - 1] + (target - y[i - 1]) * (x[i] - x[i - 1]) / (y[i] - y[i - 1]) }
for (st in unique(res$set)) {
  r <- res[res$set == st, ]
  cat("\n==", st, "==\n"); print(r[, c("test", "n", "diff", "power", "mc_se", "failed")], row.names = FALSE, digits = 2)
  for (tt in c("word", "identity")) {
    q <- r[r$test == tt, ]
    if (st == "What N = 100 can detect") {
      q <- rbind(res[res$set == "N for a 10-point difference" & res$test == tt & res$n == 100, ], q)
      cat(sprintf("%s: N = 100 has 80%% power for a difference of about %.0f points\n", tt, cross(q$diff, q$power, 0.8)))
    } else {
      cat(sprintf("%s: total N for 80%% power = %s, for 90%% power = %s\n", tt,
                  round(cross(q$n, q$power, 0.8)), round(cross(q$n, q$power, 0.9))))
    }
  }
}

pc <- res[res$set != "What N = 100 can detect", ]
gp <- ggplot(pc, aes(n, power, colour = test, linetype = set)) +
  geom_hline(yintercept = c(0.8, 0.9), colour = "grey70", linewidth = 0.4) +
  geom_line(linewidth = 0.8) + geom_point(size = 2) +
  scale_colour_manual(values = c(word = "#3A9AB8", identity = "#D4956A")) +
  scale_y_continuous(limits = c(0, 1), breaks = seq(0, 1, 0.2)) + scale_x_continuous(breaks = unique(pc$n)) +
  labs(x = "Total N (half per condition)", y = "Power", colour = NULL, linetype = NULL,
       title = "Power for a 10-point accuracy difference between conditions") +
  theme_minimal(base_size = 12) + theme(legend.position = "bottom", legend.box = "vertical")
ggsave(file.path(out_dir, "power_curve.png"), gp, width = 7, height = 5, dpi = 200, bg = "white")
cat("\nSaved", file.path(out_dir, "power_results.csv"), "and power_curve.png\n")
