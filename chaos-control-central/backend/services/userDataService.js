const pool = require("../config/db");
const { emitUserRefresh, emitSocialEvent } = require("../socket/realtime");
const { computeXp, unlockDynamicAchievements, ensureMilestone } = require("./achievementEngine");

const legacyDefaultBlockedApps = [
  { appName: "Amazon", packageName: "com.amazon.mShop.android.shopping" },
  { appName: "Zomato", packageName: "com.application.zomato" },
  { appName: "Tinder", packageName: "com.tinder" },
  { appName: "Binance", packageName: "com.binance.dev" },
  { appName: "Ex", packageName: "lastpuff.ex.contact" },
];

function toNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getFocusLevel(score) {
  if (score >= 80) {
    return "HIGH";
  }
  if (score >= 60) {
    return "GOOD";
  }
  if (score >= 40) {
    return "LOW";
  }
  return "CRITICAL";
}

function getCommitment(streakPoints) {
  if (streakPoints >= 100) {
    return "Locked In";
  }
  if (streakPoints >= 50) {
    return "Steady";
  }
  if (streakPoints >= 20) {
    return "Building";
  }
  return "Starting";
}

function getRecoveryStage(smokeFreeHours) {
  if (smokeFreeHours < 24) {
    return "Oxygen improving";
  }
  if (smokeFreeHours < 24 * 7) {
    return "Lungs healing";
  }
  if (smokeFreeHours < 24 * 30) {
    return "Breathing easier";
  }
  return "Circulation improving";
}

function formatRelativeDuration(seconds) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const days = Math.floor(hours / 24);

  if (days >= 1) {
    return `${days} day${days === 1 ? "" : "s"} smoke free`;
  }
  if (hours >= 1) {
    return `${hours} hour${hours === 1 ? "" : "s"} smoke free`;
  }

  const minutes = Math.floor(safeSeconds / 60);
  return `${minutes} minute${minutes === 1 ? "" : "s"} smoke free`;
}

function haversineDistanceKm(latitude1, longitude1, latitude2, longitude2) {
  const toRadians = (value) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const latitudeDelta = toRadians(latitude2 - latitude1);
  const longitudeDelta = toRadians(longitude2 - longitude1);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(toRadians(latitude1)) *
      Math.cos(toRadians(latitude2)) *
      Math.sin(longitudeDelta / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getOnlineStatus(lastActive) {
  if (!lastActive) {
    return "OFFLINE";
  }

  const elapsedMinutes = (Date.now() - new Date(lastActive).getTime()) / 60000;

  if (elapsedMinutes <= 2) {
    return "ONLINE";
  }
  if (elapsedMinutes <= 10) {
    return "RECENTLY ACTIVE";
  }
  return "OFFLINE";
}

async function ensureUserBootstrap(userId, db = pool) {
  const userResult = await db.query(
    "SELECT cigarette_price FROM public.users WHERE id = $1 LIMIT 1",
    [userId],
  );

  if (!userResult.rows.length) {
    const error = new Error("Session user was not found in the database. Please log in again.");
    error.status = 401;
    throw error;
  }

  const cigarettePrice = toNumber(userResult.rows[0]?.cigarette_price, 20);
  const statsExists = await db.query("SELECT 1 FROM public.user_stats WHERE user_id = $1 LIMIT 1", [userId]);

  if (!statsExists.rows.length) {
    await db.query(
      `
        INSERT INTO public.user_stats (
          user_id,
          today_cigarettes,
          total_cigarettes,
          money_burned,
          savings,
          blocked_buys,
          focus_level,
          regret_level,
          stability_level,
          updated_at,
          current_streak,
          highest_streak,
          current_level,
          smoke_free_started_at,
          lungs_recovery_percent,
          cigarettes_avoided_today,
          cigarettes_avoided_total,
          daily_smoking_average,
          price_per_cigarette
        )
        VALUES ($1, 0, 0, 0, 0, 0, 'HIGH', 0, 100, NOW(), 0, 0, 1, NULL, 0, 0, 0, 10, $2)
      `,
      [userId, cigarettePrice],
    );
  } else {
    await db.query(
      `
        UPDATE public.user_stats
        SET
          price_per_cigarette = COALESCE(price_per_cigarette, $2),
          daily_smoking_average = COALESCE(NULLIF(daily_smoking_average, 0), 10)
        WHERE user_id = $1
      `,
      [userId, cigarettePrice],
    );
  }

  const blockedAppsResult = await db.query(
    `
      SELECT id, app_name, package_name
      FROM public.blocked_apps
      WHERE user_id = $1
      ORDER BY id
    `,
    [userId],
  );

  const blockedApps = blockedAppsResult.rows;
  const matchesLegacyDefaults =
    blockedApps.length === legacyDefaultBlockedApps.length &&
    blockedApps.every((app) =>
      legacyDefaultBlockedApps.some(
        (legacyApp) =>
          legacyApp.appName === app.app_name &&
          legacyApp.packageName === app.package_name,
      ),
    );

  // Remove the old demo seed so existing users start with an empty list
  // until they explicitly choose apps themselves.
  if (matchesLegacyDefaults) {
    await db.query("DELETE FROM public.blocked_apps WHERE user_id = $1", [userId]);
  }
}

async function addActivity(userId, activityType, title, description, db = pool) {
  await db.query(
    `
      INSERT INTO public.activity_feed (user_id, activity_type, title, description, created_at)
      VALUES ($1, $2, $3, $4, NOW())
    `,
    [userId, activityType, title, description],
  );
}

async function ensureAchievementUnlocked(userId, title, db = pool) {
  const achievementResult = await db.query(
    "SELECT id FROM public.achievements WHERE title = $1 LIMIT 1",
    [title],
  );
  const achievementId = achievementResult.rows[0]?.id;

  if (!achievementId) {
    return false;
  }

  const insertResult = await db.query(
    `
      INSERT INTO public.user_achievements (user_id, achievement_id, unlocked_at)
      SELECT $1, $2, NOW()
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.user_achievements
        WHERE user_id = $1 AND achievement_id = $2
      )
      RETURNING id
    `,
    [userId, achievementId],
  );

  return insertResult.rows.length > 0;
}

function generateVerificationCode(userId) {
  return `LP-${String(userId).padStart(4, "0")}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function generateCertificateId(userId) {
  return `LP-CERT-${userId}-${Date.now()}`;
}

function createPdfBuffer(lines) {
  const width = 595;
  const height = 842;
  const content = [
    "0.96 0.95 0.92 rg",
    "0 0 595 842 re f",
    "0.17 0.17 0.19 RG",
    "1.2 w",
    "36 36 523 770 re S",
    "0.32 0.32 0.36 RG",
    "0.8 w",
    "54 748 m 541 748 l S",
    "54 120 m 541 120 l S",
  ];

  for (const line of lines) {
    const safeText = String(line.text).replace(/[()\\]/g, "\\$&");
    content.push("BT");
    content.push(`/F${line.font || 1} ${line.size || 12} Tf`);
    content.push(`1 0 0 1 ${line.x || 72} ${line.y || 700} Tm`);
    content.push(`(${safeText}) Tj`);
    content.push("ET");
  }

  const objects = [];
  const addObject = (body) => {
    objects.push(body);
  };

  addObject("<< /Type /Catalog /Pages 2 0 R >>");
  addObject("<< /Type /Pages /Count 1 /Kids [3 0 R] >>");
  addObject(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`);
  addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  addObject(`<< /Length ${Buffer.byteLength(content.join("\n"), "utf8")} >>\nstream\n${content.join("\n")}\nendstream`);

  let offset = 0;
  const parts = ["%PDF-1.4\n"];
  offset = Buffer.byteLength(parts[0], "utf8");
  const xref = ["xref", `0 ${objects.length + 1}`, "0000000000 65535 f "];

  objects.forEach((object, index) => {
    const objectString = `${index + 1} 0 obj\n${object}\nendobj\n`;
    xref.push(`${String(offset).padStart(10, "0")} 00000 n `);
    parts.push(objectString);
    offset += Buffer.byteLength(objectString, "utf8");
  });

  const xrefOffset = offset;
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  parts.push(`${xref.join("\n")}\n${trailer}`);
  return Buffer.from(parts.join(""), "utf8");
}

async function buildSnapshot(userId, db = pool) {
  await ensureUserBootstrap(userId, db);

  const [
    userResult,
    statsResult,
    totalResult,
    todayResult,
    weeklyResult,
    quitResult,
    activeQuitResult,
    blockedResult,
    longestQuitResult,
    monthlyResult,
    dailyResult,
    levelsResult,
    insightsResult,
  ] = await Promise.all([
    db.query("SELECT id, name, email, created_at, cigarette_price, visibility_enabled FROM public.users WHERE id = $1", [userId]),
    db.query("SELECT * FROM public.user_stats WHERE user_id = $1 LIMIT 1", [userId]),
    db.query(
      `
        SELECT
          COALESCE(SUM(cigarettes_count), 0)::int AS total_cigarettes,
          COALESCE(SUM(cigarettes_count * price_per_unit), 0)::numeric AS total_money
        FROM public.cigarette_logs
        WHERE user_id = $1
      `,
      [userId],
    ),
    db.query(
      `
        SELECT COALESCE(SUM(cigarettes_count), 0)::int AS today_cigarettes
        FROM public.cigarette_logs
        WHERE user_id = $1 AND logged_at::date = CURRENT_DATE
      `,
      [userId],
    ),
    db.query(
      `
        SELECT COALESCE(SUM(cigarettes_count), 0)::int AS weekly_cigarettes
        FROM public.cigarette_logs
        WHERE user_id = $1 AND logged_at >= NOW() - INTERVAL '7 days'
      `,
      [userId],
    ),
    db.query("SELECT COUNT(*)::int AS quit_count FROM public.quit_attempts WHERE user_id = $1", [userId]),
    db.query(
      `
        SELECT id, start_date, streak_points, active
        FROM public.quit_attempts
        WHERE user_id = $1 AND active = TRUE
        ORDER BY start_date DESC
        LIMIT 1
      `,
      [userId],
    ),
    db.query(
      `
        SELECT
          COUNT(*)::int AS blocked_buys,
          COALESCE(SUM(money_saved), 0)::numeric AS blocked_money_saved
        FROM public.blocked_activity_logs
        WHERE user_id = $1
      `,
      [userId],
    ),
    db.query(
      `
        SELECT COALESCE(MAX(GREATEST(COALESCE(smoke_free_seconds, 0), COALESCE(duration_hours, 0) * 3600)), 0)::bigint AS longest_seconds
        FROM public.quit_attempts
        WHERE user_id = $1
      `,
      [userId],
    ),
    db.query(
      `
        WITH month_series AS (
          SELECT generate_series(
            date_trunc('month', CURRENT_DATE) - interval '11 months',
            date_trunc('month', CURRENT_DATE),
            interval '1 month'
          ) AS month_start
        )
        SELECT
          month_series.month_start,
          COALESCE(SUM(cl.cigarettes_count), 0)::int AS total
        FROM month_series
        LEFT JOIN public.cigarette_logs cl
          ON cl.user_id = $1
         AND date_trunc('month', cl.logged_at) = month_series.month_start
        GROUP BY month_series.month_start
        ORDER BY month_series.month_start
      `,
      [userId],
    ),
    db.query(
      `
        WITH day_series AS (
          SELECT generate_series(CURRENT_DATE - interval '6 days', CURRENT_DATE, interval '1 day')::date AS day_start
        )
        SELECT
          day_series.day_start,
          COALESCE(SUM(cl.cigarettes_count), 0)::int AS total
        FROM day_series
        LEFT JOIN public.cigarette_logs cl
          ON cl.user_id = $1
         AND cl.logged_at::date = day_series.day_start
        GROUP BY day_series.day_start
        ORDER BY day_series.day_start
      `,
      [userId],
    ),
    db.query(
      `
        SELECT id, level_number, level_name, required_points, reward_title
        FROM public.levels
        ORDER BY required_points ASC, level_number ASC
      `,
    ),
    db.query(
      `
        SELECT
          (SELECT COUNT(*)::int FROM public.smoke_dna WHERE user_id = $1) AS smoke_dna_count,
          (SELECT COUNT(*)::int FROM public.smoke_replay WHERE user_id = $1) AS replay_count,
          (SELECT COUNT(*)::int FROM public.craving_predictions WHERE user_id = $1) AS craving_prediction_count,
          (SELECT COUNT(*)::int FROM public.voice_commands WHERE user_id = $1) AS voice_command_count,
          (SELECT COUNT(*)::int FROM public.scanner_history WHERE user_id = $1) AS scanner_history_count,
          (SELECT COUNT(*)::int FROM public.activity_feed WHERE user_id = $1) AS activity_count,
          (SELECT COUNT(*)::int FROM public.activity_feed WHERE user_id = $1 AND activity_type = 'radar_scan') AS radar_scan_count,
          (SELECT COUNT(*)::int FROM public.activity_feed WHERE user_id = $1 AND activity_type IN ('schedule_updated', 'blocked_app_added', 'blocked_app_toggled', 'blocked_apps_saved')) AS control_update_count,
          (SELECT COUNT(*)::int FROM public.favorite_stores WHERE user_id = $1) AS store_visit_count
      `,
      [userId],
    ),
  ]);

  const user = userResult.rows[0];
  const statsRow = statsResult.rows[0];
  const levels = levelsResult.rows;
  const totalCigarettes = toNumber(totalResult.rows[0]?.total_cigarettes);
  const totalMoneyBurned = toNumber(totalResult.rows[0]?.total_money);
  const todayCigarettes = toNumber(todayResult.rows[0]?.today_cigarettes);
  const weeklyCigarettes = toNumber(weeklyResult.rows[0]?.weekly_cigarettes);
  const quitCount = toNumber(quitResult.rows[0]?.quit_count);
  const blockedBuys = toNumber(blockedResult.rows[0]?.blocked_buys);
  const blockedMoneySaved = toNumber(blockedResult.rows[0]?.blocked_money_saved);
  const longestQuitSeconds = toNumber(longestQuitResult.rows[0]?.longest_seconds);
  const monthlyCigarettes = monthlyResult.rows.map((row) => toNumber(row.total));
  const dailyCigarettes = dailyResult.rows.map((row) => toNumber(row.total));
  const cigarettePrice = toNumber(statsRow?.price_per_cigarette, toNumber(user?.cigarette_price, 20));
  const dailySmokingAverage = Math.max(1, toNumber(statsRow?.daily_smoking_average, 10));
  const trackingStartDate = new Date(user?.created_at || Date.now()).toISOString().slice(0, 10);
  const avoidedResult = await db.query(
    `
      WITH day_series AS (
        SELECT generate_series($2::date, CURRENT_DATE, interval '1 day')::date AS day_start
      ),
      daily_totals AS (
        SELECT logged_at::date AS day_start, COALESCE(SUM(cigarettes_count), 0)::int AS total
        FROM public.cigarette_logs
        WHERE user_id = $1
        GROUP BY logged_at::date
      )
      SELECT
        COALESCE(SUM(GREATEST($3 - COALESCE(daily_totals.total, 0), 0)), 0)::int AS cumulative_avoided,
        COALESCE(SUM(GREATEST(COALESCE(daily_totals.total, 0) - $3, 0)), 0)::int AS cumulative_over,
        COALESCE(
          SUM(
            CASE
              WHEN day_series.day_start >= CURRENT_DATE - interval '6 days'
                THEN GREATEST($3 - COALESCE(daily_totals.total, 0), 0)
              ELSE 0
            END
          ),
          0
        )::int AS weekly_avoided,
        COALESCE(
          SUM(
            CASE
              WHEN day_series.day_start >= CURRENT_DATE - interval '6 days'
                THEN GREATEST(COALESCE(daily_totals.total, 0) - $3, 0)
              ELSE 0
            END
          ),
          0
        )::int AS weekly_over
      FROM day_series
      LEFT JOIN daily_totals
        ON daily_totals.day_start = day_series.day_start
    `,
    [userId, trackingStartDate, dailySmokingAverage],
  );
  const smokeFreeStartedAt = statsRow?.smoke_free_started_at ? new Date(statsRow.smoke_free_started_at) : null;
  const smokeFreeSeconds = smokeFreeStartedAt ? Math.max(0, Math.floor((Date.now() - smokeFreeStartedAt.getTime()) / 1000)) : 0;
  const smokeFreeHours = smokeFreeSeconds / 3600;
  const insightMetrics = insightsResult.rows[0] || {};
  const currentStreak = Math.floor(smokeFreeHours / 24);
  const highestStreak = Math.max(toNumber(statsRow?.highest_streak), Math.floor(longestQuitSeconds / 86400), currentStreak);
  const focusScore = clamp(Math.round(100 - todayCigarettes * 5 + smokeFreeHours * 0.5), 0, 100);
  const focusLevel = getFocusLevel(focusScore);
  const regretLevel = clamp(Math.round(todayCigarettes * 7 - smokeFreeHours * 0.2 + (todayCigarettes > 0 ? 12 : 0)), 0, 100);
  const stabilityLevel = clamp(Math.round(100 - todayCigarettes * 4 + smokeFreeHours * 0.35 + currentStreak * 2), 0, 100);
  const cigarettesAvoidedToday = Math.max(dailySmokingAverage - todayCigarettes, 0);
  const cigarettesOverBaselineToday = Math.max(todayCigarettes - dailySmokingAverage, 0);
  const cigarettesAvoidedWeekly = toNumber(avoidedResult.rows[0]?.weekly_avoided);
  const cigarettesAvoidedTotal = toNumber(avoidedResult.rows[0]?.cumulative_avoided);
  const cigarettesOverBaselineWeekly = toNumber(avoidedResult.rows[0]?.weekly_over);
  const cigarettesOverBaselineTotal = toNumber(avoidedResult.rows[0]?.cumulative_over);
  const todaySavings = cigarettesAvoidedToday * cigarettePrice;
  const weeklySavings = cigarettesAvoidedWeekly * cigarettePrice;
  const totalSavings = cigarettesAvoidedTotal * cigarettePrice;
  const reducedSmokingRatio = dailySmokingAverage > 0 ? cigarettesAvoidedToday / dailySmokingAverage : 1;
  const lungsRecoveryPercent = clamp(
    Math.round(smokeFreeHours * 1.3 + currentStreak * 3 + reducedSmokingRatio * 20),
    0,
    100,
  );
  const recoveryStage = getRecoveryStage(smokeFreeHours);
  const smokeDnaCount = toNumber(insightMetrics.smoke_dna_count);
  const replayCount = toNumber(insightMetrics.replay_count);
  const cravingPredictionCount = toNumber(insightMetrics.craving_prediction_count);
  const voiceCommandCount = toNumber(insightMetrics.voice_command_count);
  const scannerHistoryCount = toNumber(insightMetrics.scanner_history_count);
  const activityCount = toNumber(insightMetrics.activity_count);
  const radarScanCount = toNumber(insightMetrics.radar_scan_count);
  const controlUpdateCount = toNumber(insightMetrics.control_update_count);
  const storeVisitCount = toNumber(insightMetrics.store_visit_count);
  const xpPoints = computeXp({
    totalCigarettes,
    cigarettesAvoidedToday,
    cigarettesAvoidedTotal,
    cigarettesOverBaselineToday,
    cigarettesOverBaselineTotal,
    blockedBuys,
    quitCount,
    lungsRecoveryPercent,
    smokeDnaCount,
    replayCount,
    cravingPredictionCount,
    voiceCommandCount,
    radarScanCount,
    smokeFreeHours,
  });
  const currentLevel =
    levels
      .filter((level) => toNumber(level.required_points) <= xpPoints)
      .slice(-1)[0] || levels[0] || { level_number: 1, level_name: "Starter", required_points: 0, reward_title: "One breath at a time" };
  const nextLevel =
    levels.find((level) => toNumber(level.required_points) > xpPoints) || null;
  const currentLevelRequired = toNumber(currentLevel.required_points);
  const nextLevelRequired = toNumber(nextLevel?.required_points, currentLevelRequired);
  const levelProgressPercent = nextLevel
    ? clamp(Math.round(((xpPoints - currentLevelRequired) / Math.max(1, nextLevelRequired - currentLevelRequired)) * 100), 0, 100)
    : 100;

  return {
    user,
    levels,
    statsRow,
    activeQuitAttempt: activeQuitResult.rows[0] || null,
    totalCigarettes,
    totalMoneyBurned,
    todayCigarettes,
    weeklyCigarettes,
    quitCount,
    blockedBuys,
    blockedMoneySaved,
    monthlyCigarettes,
    dailyCigarettes,
    cigarettePrice,
    dailySmokingAverage,
    smokeFreeStartedAt,
    smokeFreeSeconds,
    smokeFreeHours,
    currentStreak,
    highestStreak,
    xpPoints,
    focusScore,
    focusLevel,
    regretLevel,
    stabilityLevel,
    cigarettesAvoidedToday,
    cigarettesAvoidedWeekly,
    cigarettesAvoidedTotal,
    cigarettesOverBaselineToday,
    cigarettesOverBaselineWeekly,
    cigarettesOverBaselineTotal,
    todaySavings,
    weeklySavings,
    totalSavings,
    lungsRecoveryPercent,
    recoveryStage,
    smokeDnaCount,
    replayCount,
    cravingPredictionCount,
    voiceCommandCount,
    scannerHistoryCount,
    activityCount,
    radarScanCount,
    controlUpdateCount,
    storeVisitCount,
    currentLevel,
    currentLevelNumber: toNumber(currentLevel.level_number, 1),
    nextLevel,
    levelProgressPercent,
    longestQuitSeconds: Math.max(longestQuitSeconds, smokeFreeSeconds),
    commitment: getCommitment(xpPoints),
  };
}

async function syncUserState(userId, db = pool) {
  const snapshot = await buildSnapshot(userId, db);
  const previousLevel = toNumber(snapshot.statsRow?.current_level, 1);
  const previousHighestStreak = toNumber(snapshot.statsRow?.highest_streak);
  const previousStreak = toNumber(snapshot.statsRow?.current_streak, 0);
  const notifications = [];

  await db.query(
    `
      UPDATE public.user_stats
      SET
        today_cigarettes = $2,
        total_cigarettes = $3,
        money_burned = $4,
        savings = $5,
        blocked_buys = $6,
        focus_level = $7,
        regret_level = $8,
        stability_level = $9,
        current_streak = $10,
        highest_streak = $11,
        current_level = $12,
        smoke_free_started_at = $13,
        lungs_recovery_percent = $14,
        cigarettes_avoided_today = $15,
        cigarettes_avoided_total = $16,
        daily_smoking_average = $17,
        price_per_cigarette = $18,
        updated_at = NOW()
      WHERE user_id = $1
    `,
    [
      userId,
      snapshot.todayCigarettes,
      snapshot.totalCigarettes,
      snapshot.totalMoneyBurned,
      snapshot.totalSavings,
      snapshot.blockedBuys,
      snapshot.focusLevel,
      snapshot.regretLevel,
      snapshot.stabilityLevel,
      snapshot.currentStreak,
      snapshot.highestStreak,
      toNumber(snapshot.currentLevel.level_number, 1),
      snapshot.smokeFreeStartedAt,
      snapshot.lungsRecoveryPercent,
      snapshot.cigarettesAvoidedToday,
      snapshot.cigarettesAvoidedTotal,
      snapshot.dailySmokingAverage,
      snapshot.cigarettePrice,
    ],
  );

  if (snapshot.currentStreak >= 1 && previousHighestStreak < snapshot.currentStreak) {
    await addActivity(
      userId,
      "streak_progress",
      "Streak moved forward",
      `${snapshot.currentStreak} smoke-free day${snapshot.currentStreak === 1 ? "" : "s"} reached.`,
      db,
    );
  }

  if (snapshot.currentStreak !== previousStreak) {
    emitSocialEvent("streak-updated", {
      userId,
      streak: snapshot.currentStreak,
      highestStreak: snapshot.highestStreak,
    });
  }

  if (toNumber(snapshot.currentLevel.level_number, 1) > previousLevel) {
    const title = `LEVEL ${snapshot.currentLevel.level_number} UNLOCKED`;
    const description = snapshot.currentLevel.reward_title || snapshot.currentLevel.level_name || "New milestone reached.";
    await addActivity(userId, "level_up", title, description, db);
    notifications.push({
      type: "level_up",
      title,
      description,
      level: toNumber(snapshot.currentLevel.level_number, 1),
    });
    emitSocialEvent("level-updated", {
      userId,
      level: toNumber(snapshot.currentLevel.level_number, 1),
      title,
      description,
    });
  }

  if (toNumber(snapshot.currentLevel.level_number, 1) < previousLevel) {
    await addActivity(
      userId,
      "level_down",
      `LEVEL ${previousLevel} LOST`,
      `Your score dropped to level ${toNumber(snapshot.currentLevel.level_number, 1)}. Get back under your daily baseline to recover points.`,
      db,
    );
    notifications.push({
      type: "level_down",
      title: `Level down to ${toNumber(snapshot.currentLevel.level_number, 1)}`,
      description: "Smoking above your daily baseline removed points.",
      level: toNumber(snapshot.currentLevel.level_number, 1),
    });
  }

  if (toNumber(snapshot.currentLevel.level_number, 1) >= 15) {
    const unlocked = await ensureAchievementUnlocked(userId, "Smoking Gone From My Life", db);
    if (unlocked) {
      await addActivity(
        userId,
        "milestone",
        "SMOKING GONE FROM MY LIFE",
        "Level 15 reached. This chapter is closing.",
        db,
      );
      notifications.push({
        type: "final_achievement",
        title: "SMOKING GONE FROM MY LIFE",
        description: "Level 15 reached.",
        level: 15,
      });
    }
  }

  return { snapshot, notifications };
}

function createDashboardPayload(snapshot, notifications = []) {
  return {
    user: {
      id: snapshot.user.id,
      name: snapshot.user.name,
      email: snapshot.user.email,
      cigarettePrice: snapshot.cigarettePrice,
      visibilityEnabled: Boolean(snapshot.user.visibility_enabled),
    },
    dailyStatus: {
      regretLevel: snapshot.regretLevel,
      stabilityLevel: snapshot.stabilityLevel,
      focusLevel: snapshot.focusLevel,
      focusScore: snapshot.focusScore,
      score: snapshot.focusScore,
      recoveryStage: snapshot.recoveryStage,
    },
    smokeFree: {
      startedAt: snapshot.smokeFreeStartedAt ? snapshot.smokeFreeStartedAt.toISOString() : null,
      seconds: snapshot.smokeFreeSeconds,
    },
    streak: {
      current: snapshot.currentStreak,
      highest: snapshot.highestStreak,
    },
    level: {
      current: toNumber(snapshot.currentLevel.level_number, 1),
      name: snapshot.currentLevel.level_name,
      rewardTitle: snapshot.currentLevel.reward_title,
      next: snapshot.nextLevel
        ? {
            level: toNumber(snapshot.nextLevel.level_number),
            name: snapshot.nextLevel.level_name,
            requiredPoints: toNumber(snapshot.nextLevel.required_points),
          }
        : null,
      progressPercent: snapshot.levelProgressPercent,
    },
    lungs: {
      percent: snapshot.lungsRecoveryPercent,
      stage: snapshot.recoveryStage,
    },
    savings: {
      today: snapshot.todaySavings,
      weekly: snapshot.weeklySavings,
      total: snapshot.totalSavings,
      avoidedToday: snapshot.cigarettesAvoidedToday,
      avoidedTotal: snapshot.cigarettesAvoidedTotal,
    },
    stats: {
      todayCount: snapshot.todayCigarettes,
      quitsCount: snapshot.quitCount,
      totalCigarettes: snapshot.totalCigarettes,
      moneyBurned: snapshot.totalMoneyBurned,
      blockedBuys: snapshot.blockedBuys,
      focusLevel: snapshot.focusLevel,
      dailySmokingAverage: snapshot.dailySmokingAverage,
      cigarettePrice: snapshot.cigarettePrice,
      longestSmokeFreeSeconds: snapshot.longestQuitSeconds,
    },
    notifications,
  };
}

async function getDashboardData(userId) {
  const { snapshot, notifications } = await syncUserState(userId);
  return createDashboardPayload(snapshot, notifications);
}

async function logCigarette(userId, payload) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await ensureUserBootstrap(userId, client);

    const count = Math.max(1, toNumber(payload.cigarettesCount, 1));
    const mood = String(payload.mood || "tracked").trim().slice(0, 120);
    const priceResult = await client.query(
      "SELECT price_per_cigarette FROM public.user_stats WHERE user_id = $1 LIMIT 1",
      [userId],
    );
    const pricePerUnit = toNumber(priceResult.rows[0]?.price_per_cigarette, 20);

    await client.query(
      `
        INSERT INTO public.cigarette_logs (user_id, cigarettes_count, price_per_unit, mood, logged_at)
        VALUES ($1, $2, $3, $4, NOW())
      `,
      [userId, count, pricePerUnit, mood],
    );

    await client.query(
      `
        UPDATE public.quit_attempts
        SET
          active = FALSE,
          end_date = NOW(),
          duration_hours = GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - start_date)) / 3600)),
          smoke_free_seconds = GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - start_date))))
        WHERE user_id = $1 AND active = TRUE
      `,
      [userId],
    );

    await client.query(
      `
        UPDATE public.user_stats
        SET
          smoke_free_started_at = NOW() + INTERVAL '5 minutes',
          current_streak = 0,
          lungs_recovery_percent = 0
        WHERE user_id = $1
      `,
      [userId],
    );

    await addActivity(userId, "cigarette_logged", "Smoking session recorded", `Logged ${count} cigarette${count === 1 ? "" : "s"}.`, client);
    const { snapshot, notifications } = await syncUserState(userId, client);
    await client.query("COMMIT");

    await ensureUserAchievements(userId, snapshot);
    await emitUserRealtimeState(userId, { source: "cigarette_logged", notifications });

    return {
      message: "Cigarette recorded successfully.",
      dashboard: createDashboardPayload(snapshot, notifications),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function startQuitAttempt(userId) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await ensureUserBootstrap(userId, client);
    await client.query("UPDATE public.quit_attempts SET active = FALSE WHERE user_id = $1 AND active = TRUE", [userId]);
    await client.query(
      `
        INSERT INTO public.quit_attempts (user_id, start_date, active, streak_points, created_at, success, smoke_free_seconds)
        VALUES ($1, NOW(), TRUE, 0, NOW(), FALSE, 0)
      `,
      [userId],
    );
    await client.query(
      `
        UPDATE public.user_stats
        SET smoke_free_started_at = NULL, current_streak = 0
        WHERE user_id = $1
      `,
      [userId],
    );
    await addActivity(userId, "quit_started", "Quit attempt started", "Your future self approves.", client);
    const { snapshot, notifications } = await syncUserState(userId, client);
    await client.query("COMMIT");

    await ensureUserAchievements(userId, snapshot);
    await emitUserRealtimeState(userId, { source: "quit_started", notifications });

    return {
      message: "Quit attempt started.",
      dashboard: createDashboardPayload(snapshot, notifications),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function ensureUserAchievements(userId, snapshot, db = pool) {
  let unlockedAchievements = [];
  try {
    unlockedAchievements = await unlockDynamicAchievements(userId, snapshot, db);
  } catch (error) {
    console.warn("Achievement sync skipped after recoverable failure", {
      userId,
      message: error.message,
    });
  }

  const milestoneDefinitions = [
    { key: "smoke-free-24h", condition: snapshot.smokeFreeHours >= 24, activityType: "smoke_free_milestone", title: "Smoke-free milestone reached", description: "24 hours smoke-free completed." },
    { key: "smoke-free-week", condition: snapshot.smokeFreeHours >= 168, activityType: "streak_milestone", title: "Streak milestone reached", description: "1 week smoke-free secured." },
    { key: "recovery-40", condition: snapshot.lungsRecoveryPercent >= 40, activityType: "recovery_milestone", title: "Recovery milestone reached", description: "Recovery metrics entered a stronger phase." },
    { key: "lung-70", condition: snapshot.lungsRecoveryPercent >= 70, activityType: "lung_recovery_milestone", title: "Lung recovery milestone reached", description: "Lung recovery crossed 70%." },
    { key: "daily-goal", condition: snapshot.cigarettesAvoidedToday >= 1, activityType: "daily_goal_completed", title: "Daily goal completed", description: "You stayed under your usual daily smoking average." },
    { key: "weekly-target", condition: snapshot.cigarettesAvoidedWeekly >= 5, activityType: "weekly_target_completed", title: "Weekly target completed", description: "Weekly avoidance progress is now visible." },
    { key: "spending-saved", condition: snapshot.totalSavings >= 1000, activityType: "spending_saved_milestone", title: "Spending saved milestone", description: `Saved Rs${Math.round(snapshot.totalSavings).toLocaleString("en-IN")} so far.` },
    { key: "final-level", condition: snapshot.currentLevelNumber >= 15, activityType: "final_level_unlocked", title: "Final level unlocked", description: "Final Recovery has been unlocked." },
  ];

  for (const achievement of unlockedAchievements) {
    try {
      await addActivity(userId, "achievement_unlocked", "Achievement unlocked", achievement.title, db);
    } catch (error) {
      console.warn("Failed to record unlocked achievement activity", {
        userId,
        achievementKey: achievement.achievement_key,
        message: error.message,
      });
    }
  }

  for (const milestone of milestoneDefinitions) {
    if (!milestone.condition) {
      continue;
    }
    let created = false;
    try {
      created = await ensureMilestone(userId, milestone.key, { currentLevel: snapshot.currentLevelNumber }, db);
    } catch (error) {
      console.warn("Milestone sync skipped after recoverable failure", {
        userId,
        milestoneKey: milestone.key,
        message: error.message,
      });
      continue;
    }
    if (created) {
      try {
        await addActivity(userId, milestone.activityType, milestone.title, milestone.description, db);
      } catch (error) {
        console.warn("Failed to record milestone activity", {
          userId,
          milestoneKey: milestone.key,
          message: error.message,
        });
      }
    }
  }

  if (snapshot.currentLevelNumber >= 15) {
    let rewardUnlocked = false;
    try {
      rewardUnlocked = await ensureMilestone(userId, "final-reward-unlocked", {
        badge: "Freedom Badge",
        certificate: true,
      }, db);
    } catch (error) {
      console.warn("Final reward sync skipped after recoverable failure", {
        userId,
        message: error.message,
      });
      rewardUnlocked = false;
    }

    if (rewardUnlocked) {
      try {
        await db.query(
          `
            INSERT INTO public.user_rewards (user_id, reward_key, reward_name, reward_type, status, metadata, unlocked_at)
            VALUES ($1, 'freedom-badge', 'Freedom Badge', 'badge', 'unlocked', $2::jsonb, NOW())
            ON CONFLICT (user_id, reward_key)
            DO NOTHING
          `,
          [userId, JSON.stringify({ theme: "premium-final-recovery" })],
        );
      } catch (error) {
        console.warn("Failed to store final reward", {
          userId,
          message: error.message,
        });
      }
      try {
        await addActivity(userId, "final_reward", "Premium reward unlocked", "Freedom Badge and completion rewards are now available.", db);
      } catch (error) {
        console.warn("Failed to record final reward activity", {
          userId,
          message: error.message,
        });
      }
    }
  }
}

async function getRecentActivity(userId, limit = 5, db = pool) {
  const { rows } = await db.query(
    `
      SELECT id, activity_type, title, description, created_at
      FROM public.activity_feed
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [userId, limit],
  );

  return rows;
}

async function emitUserRealtimeState(userId, payload = {}) {
  try {
    const recentActivity = await getRecentActivity(userId, 5);
    emitUserRefresh(userId, {
      ...payload,
      recentActivity,
    });
  } catch (error) {
    console.warn("Realtime refresh skipped after recoverable failure", {
      userId,
      message: error.message,
    });
  }
}

async function getAppsData(userId) {
  await ensureUserBootstrap(userId);
  const [appsResult, scheduleResult] = await Promise.all([
    pool.query(
      `
        SELECT id, app_name, package_name, app_icon, warning_message, is_active, created_at
        FROM public.blocked_apps
        WHERE user_id = $1
        ORDER BY id
      `,
      [userId],
    ),
    pool.query(
      `
        SELECT id, block_time, frequency, enabled, created_at
        FROM public.block_schedules
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [userId],
    ),
  ]);

  return {
    apps: appsResult.rows,
    schedule: scheduleResult.rows[0] || null,
  };
}

async function addBlockedApp(userId, payload) {
  const appName = String(payload.appName || "").trim();

  if (!appName) {
    throw new Error("App name is required.");
  }

  const appIcon = String(payload.appIcon || "ShieldAlert").trim();
  const packageName = String(payload.packageName || "").trim() || null;
  const warningMessage = String(payload.warningMessage || "Protected by Last Puff.").trim();
  const { rows } = await pool.query(
    `
      INSERT INTO public.blocked_apps (user_id, app_name, package_name, app_icon, warning_message, is_active, created_at)
      VALUES ($1, $2, $3, $4, $5, TRUE, NOW())
      RETURNING id, app_name, package_name, app_icon, warning_message, is_active, created_at
    `,
    [userId, appName, packageName, appIcon, warningMessage],
  );

  await addActivity(userId, "blocked_app_added", "Blocked app added", `${appName} added to protected apps.`);
  await emitUserRealtimeState(userId, { source: "blocked_app_added" });
  return rows[0];
}

async function saveBlockedAppsSelection(userId, payload) {
  const apps = Array.isArray(payload.apps) ? payload.apps : [];

  if (!apps.length) {
    return getAppsData(userId);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (const app of apps) {
      const appName = String(app.appName || "").trim();
      if (!appName) {
        continue;
      }

      const packageName = String(app.packageName || "").trim() || null;
      const appIcon = String(app.appIcon || "ShieldAlert").trim();
      const warningMessage = String(app.warningMessage || "Protected by Last Puff.").trim();

      const existingResult = await client.query(
        `
          SELECT id
          FROM public.blocked_apps
          WHERE user_id = $1 AND (
            ($2::varchar IS NOT NULL AND package_name = $2)
            OR app_name = $3
          )
          LIMIT 1
        `,
        [userId, packageName, appName],
      );

      if (existingResult.rows[0]?.id) {
        await client.query(
          `
            UPDATE public.blocked_apps
            SET
              app_name = $3,
              package_name = $4,
              app_icon = $5,
              warning_message = $6,
              is_active = TRUE
            WHERE id = $2 AND user_id = $1
          `,
          [userId, existingResult.rows[0].id, appName, packageName, appIcon, warningMessage],
        );
      } else {
        await client.query(
          `
            INSERT INTO public.blocked_apps (user_id, app_name, package_name, app_icon, warning_message, is_active, created_at)
            VALUES ($1, $2, $3, $4, $5, TRUE, NOW())
          `,
          [userId, appName, packageName, appIcon, warningMessage],
        );
      }
    }

    await addActivity(userId, "blocked_app_added", "Protected apps updated", `${apps.length} app${apps.length === 1 ? "" : "s"} selected.`, client);
    await client.query("COMMIT");
    await emitUserRealtimeState(userId, { source: "blocked_apps_saved" });
    return getAppsData(userId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function toggleBlockedApp(userId, payload) {
  const appId = toNumber(payload.id);
  const isActive = Boolean(payload.isActive);
  const { rows } = await pool.query(
    `
      UPDATE public.blocked_apps
      SET is_active = $3
      WHERE id = $1 AND user_id = $2
      RETURNING id, app_name, package_name, app_icon, warning_message, is_active, created_at
    `,
    [appId, userId, isActive],
  );

  const app = rows[0];
  if (!app) {
    return null;
  }

  await addActivity(userId, "blocked_app_toggled", "Blocked app updated", `${app.app_name} is now ${isActive ? "active" : "inactive"}.`);
  await emitUserRealtimeState(userId, { source: "blocked_app_toggled" });
  return app;
}

async function deleteBlockedApp(userId, appId) {
  const { rows } = await pool.query(
    `
      DELETE FROM public.blocked_apps
      WHERE id = $1 AND user_id = $2
      RETURNING id, app_name
    `,
    [appId, userId],
  );

  if (rows[0]) {
    await addActivity(userId, "blocked_app_deleted", "Blocked app removed", `${rows[0].app_name} removed from protected apps.`);
    await emitUserRealtimeState(userId, { source: "blocked_app_deleted" });
  }

  return rows[0] || null;
}

async function saveBlockSchedule(userId, payload) {
  const blockTime = String(payload.blockTime || "").trim();
  const frequency = String(payload.frequency || "daily").trim() || "daily";
  const enabled = payload.enabled !== false;

  const { rows } = await pool.query(
    `
      INSERT INTO public.block_schedules (user_id, block_time, frequency, enabled, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING id, block_time, frequency, enabled, created_at
    `,
    [userId, blockTime, frequency, enabled],
  );

  await addActivity(userId, "schedule_updated", "Block schedule saved", `Daily block schedule updated to ${blockTime}.`);
  await emitUserRealtimeState(userId, { source: "schedule_updated" });
  return rows[0];
}

async function saveVerificationAttempt(userId, payload) {
  const passed = Boolean(payload.passed);
  await addActivity(userId, "verification", "Verification challenge completed", passed ? "Verification challenge passed." : "Verification challenge failed.");
  await emitUserRealtimeState(userId, { source: "verification" });

  return {
    passed,
    attempts: Math.max(1, toNumber(payload.attempts, 1)),
  };
}

async function getRoastAnalytics(userId) {
  const { snapshot } = await syncUserState(userId);
  const monthlyProjection = Math.round(snapshot.dailySmokingAverage * 30 * snapshot.cigarettePrice);
  const annualSpend = Math.round(snapshot.totalMoneyBurned);
  const dailyAverageSpend = Math.round(snapshot.dailySmokingAverage * snapshot.cigarettePrice);

  const worstDayResult = await pool.query(
    `
      SELECT logged_at::date AS day, SUM(cigarettes_count)::int AS total
      FROM public.cigarette_logs
      WHERE user_id = $1
      GROUP BY logged_at::date
      ORDER BY total DESC, day DESC
      LIMIT 1
    `,
    [userId],
  );

  return {
    annualSpend,
    dailyAverage: dailyAverageSpend,
    monthlyProjection,
    worstDay: worstDayResult.rows[0] || null,
    peakSingleDay: snapshot.dailyCigarettes.length ? Math.max(...snapshot.dailyCigarettes) : 0,
    highestDailySpend: (snapshot.dailyCigarettes.length ? Math.max(...snapshot.dailyCigarettes) : 0) * snapshot.cigarettePrice,
    blockedPurchases: snapshot.blockedBuys,
    monthlyCigarettes: snapshot.monthlyCigarettes,
    cigarettePrice: snapshot.cigarettePrice,
    currencySymbol: "Rs",
    todaySavings: snapshot.todaySavings,
    weeklySavings: snapshot.weeklySavings,
    totalSavings: snapshot.totalSavings,
    currentStreak: snapshot.currentStreak,
    lungsRecoveryPercent: snapshot.lungsRecoveryPercent,
    recoveryStage: snapshot.recoveryStage,
    cigarettesAvoidedTotal: snapshot.cigarettesAvoidedTotal,
  };
}

async function getRoastHighlights(userId) {
  const analytics = await getRoastAnalytics(userId);
  const blockedLogs = await pool.query(
    `
      SELECT id, app_name, message, money_saved, blocked_at
      FROM public.blocked_activity_logs
      WHERE user_id = $1
      ORDER BY blocked_at DESC
      LIMIT 5
    `,
    [userId],
  );

  return {
    ...analytics,
    blockedLogs: blockedLogs.rows,
  };
}

async function getNearbyUsers(userId) {
  const userResult = await pool.query(
    `
      SELECT id, latitude, longitude
      FROM public.users
      WHERE id = $1
      LIMIT 1
    `,
    [userId],
  );

  const currentUser = userResult.rows[0];
  const baseLatitude = toNumber(currentUser?.latitude, NaN);
  const baseLongitude = toNumber(currentUser?.longitude, NaN);

  if (!Number.isFinite(baseLatitude) || !Number.isFinite(baseLongitude)) {
    return [];
  }

  const { rows } = await pool.query(
    `
      SELECT
        u.id,
        u.name,
        u.profile_image,
        u.last_active,
        u.current_status,
        u.latitude,
        u.longitude,
        us.current_streak,
        us.current_level,
        us.smoke_free_started_at,
        l.level_name
      FROM public.users u
      LEFT JOIN public.user_stats us ON us.user_id = u.id
      LEFT JOIN public.levels l ON l.level_number = us.current_level
      WHERE
        u.id <> $1
        AND COALESCE(u.is_visible, COALESCE(u.visibility_enabled, FALSE)) = TRUE
        AND u.latitude IS NOT NULL
        AND u.longitude IS NOT NULL
        AND u.last_active >= NOW() - INTERVAL '10 minutes'
      ORDER BY u.last_active DESC
    `,
    [userId],
  );

  return rows
    .map((row) => {
      const distanceKm = haversineDistanceKm(
        baseLatitude,
        baseLongitude,
        toNumber(row.latitude),
        toNumber(row.longitude),
      );
      const smokeFreeSeconds = row.smoke_free_started_at
        ? Math.max(0, Math.floor((Date.now() - new Date(row.smoke_free_started_at).getTime()) / 1000))
        : 0;
      const onlineStatus = getOnlineStatus(row.last_active);
      const firstName = String(row.name || "User").trim();

      return {
        id: String(row.id),
        username: firstName,
        avatar: row.profile_image || firstName.slice(0, 1).toUpperCase(),
        distanceMeters: Math.round(distanceKm * 1000),
        status: `🔥 Streak: ${toNumber(row.current_streak)} · 🏆 Level ${toNumber(row.current_level, 1)} · ⏱ Smoke-free ${formatRelativeDuration(smokeFreeSeconds)}`,
        mood: row.level_name || `Level ${toNumber(row.current_level, 1)}`,
        chaosLevel: clamp(Math.round((10 - Math.min(distanceKm, 10)) * 10), 8, 100),
        online: onlineStatus === "ONLINE",
        streak: toNumber(row.current_streak),
        level: toNumber(row.current_level, 1),
        smokeFreeSeconds,
        smokeFreeLabel: formatRelativeDuration(smokeFreeSeconds),
        onlineStatus,
      };
    })
    .filter((row) => row.distanceMeters <= 10000)
    .sort((left, right) => left.distanceMeters - right.distanceMeters);
}

async function updateVisibility(userId, enabled) {
  await pool.query(
    `
      UPDATE public.users
      SET visibility_enabled = $2
        , is_visible = $2
        , current_status = $3
        , last_active = NOW()
      WHERE id = $1
    `,
    [userId, enabled, enabled ? "online" : "offline"],
  );
  await addActivity(userId, "visibility", "Radar visibility updated", enabled ? "Visibility enabled on radar." : "Visibility hidden from radar.");
  await emitUserRealtimeState(userId, { source: "visibility" });
  emitSocialEvent(enabled ? "user-online" : "user-offline", {
    userId,
    isVisible: enabled,
  });
  return { enabled };
}

async function updateUserLocation(userId, payload) {
  const latitude = toNumber(payload.latitude, NaN);
  const longitude = toNumber(payload.longitude, NaN);
  const isVisible = payload.is_visible !== false;

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error("A valid latitude and longitude are required.");
  }

  await pool.query(
    `
      UPDATE public.users
      SET
        latitude = $2,
        longitude = $3,
        is_visible = $4,
        visibility_enabled = $4,
        last_active = NOW(),
        current_status = 'online'
      WHERE id = $1
    `,
    [userId, latitude, longitude, isVisible],
  );

  emitSocialEvent("user-location-update", {
    userId,
    isVisible,
  });

  return { ok: true };
}

async function runRadarScan(userId) {
  const users = await getNearbyUsers(userId);

  await pool.query("DELETE FROM public.nearby_users WHERE user_id = $1", [userId]);

  for (const nearbyUser of users) {
    await pool.query(
      `
        INSERT INTO public.nearby_users (user_id, nearby_user_id, distance_km, detected_at)
        VALUES ($1, $2, $3, NOW())
      `,
      [userId, Number(nearbyUser.id), nearbyUser.distanceMeters / 1000],
    );
  }

  await addActivity(userId, "radar_scan", "Radar scan completed", users.length ? `Found ${users.length} nearby user${users.length === 1 ? "" : "s"}.` : "No nearby visible users found.");
  await emitUserRealtimeState(userId, { source: "radar_scan" });
  return users;
}

async function buildFinalRewardState(userId, snapshot, db = pool) {
  const rewardsResult = await db.query(
    `
      SELECT reward_key, reward_name, reward_type, status, metadata, unlocked_at
      FROM public.user_rewards
      WHERE user_id = $1
      ORDER BY unlocked_at DESC
    `,
    [userId],
  );

  const certificateResult = await db.query(
    `
      SELECT certificate_id, verification_code, created_at, metadata
      FROM public.completion_certificates
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [userId],
  );

  const unlockedAchievements = await db.query(
    `
      SELECT COUNT(*)::int AS total
      FROM public.user_achievements
      WHERE user_id = $1
    `,
    [userId],
  );

  const isFinalLevel = snapshot.currentLevelNumber >= 15;
  const badge = rewardsResult.rows.find((row) => row.reward_type === "badge") || null;
  const certificate = certificateResult.rows[0] || null;

  return {
    isFinalLevel,
    badge: badge
      ? {
          name: badge.reward_name,
          status: badge.status,
          unlockedAt: badge.unlocked_at,
          metadata: badge.metadata || {},
        }
      : null,
    certificate: certificate
      ? {
          certificateId: certificate.certificate_id,
          verificationCode: certificate.verification_code,
          createdAt: certificate.created_at,
          metadata: certificate.metadata || {},
        }
      : null,
    report: isFinalLevel
      ? {
          finalLevel: snapshot.currentLevelNumber,
          smokeFreeHours: snapshot.smokeFreeHours,
          totalCigarettesAvoided: snapshot.cigarettesAvoidedTotal,
          totalMoneySaved: snapshot.totalSavings,
          achievementsUnlocked: toNumber(unlockedAchievements.rows[0]?.total),
        }
      : null,
  };
}

async function getProfileData(userId) {
  const { snapshot, notifications } = await syncUserState(userId);
  await ensureUserAchievements(userId, snapshot);
  const finalRewards = await buildFinalRewardState(userId, snapshot);

  return {
    user: {
      id: snapshot.user.id,
      name: snapshot.user.name,
      email: snapshot.user.email,
      avatar: snapshot.user.name.slice(0, 1).toUpperCase(),
      cigarettePrice: snapshot.cigarettePrice,
      visibilityEnabled: Boolean(snapshot.user.visibility_enabled),
      dailySmokingAverage: snapshot.dailySmokingAverage,
    },
    level: toNumber(snapshot.currentLevel.level_number, 1),
    levelName: snapshot.currentLevel.level_name,
    rewardTitle: snapshot.currentLevel.reward_title,
    currentLevelXp: snapshot.xpPoints,
    xpToNextLevel: snapshot.nextLevel ? toNumber(snapshot.nextLevel.required_points) : snapshot.xpPoints,
    levelProgressPercent: snapshot.levelProgressPercent,
    levelGuide: snapshot.levels.map((level) => ({
      level: toNumber(level.level_number, 1),
      name: level.level_name,
      requiredPoints: toNumber(level.required_points),
      rewardTitle: level.reward_title,
      finalCertificate: toNumber(level.level_number, 1) >= 15,
    })),
    commitment: snapshot.commitment,
    streak: {
      current: snapshot.currentStreak,
      highest: snapshot.highestStreak,
    },
    smokeFree: {
      startedAt: snapshot.smokeFreeStartedAt ? snapshot.smokeFreeStartedAt.toISOString() : null,
      longestSeconds: snapshot.longestQuitSeconds,
    },
    lungs: {
      percent: snapshot.lungsRecoveryPercent,
      stage: snapshot.recoveryStage,
    },
    savings: {
      today: snapshot.todaySavings,
      weekly: snapshot.weeklySavings,
      total: snapshot.totalSavings,
    },
    stats: {
      todayCount: snapshot.todayCigarettes,
      quitCount: snapshot.quitCount,
      totalCigarettes: snapshot.totalCigarettes,
      totalCigarettesAvoided: snapshot.cigarettesAvoidedTotal,
      savings: snapshot.totalSavings,
      focusLevel: snapshot.focusLevel,
      blockedBuys: snapshot.blockedBuys,
      dailySmokingAverage: snapshot.dailySmokingAverage,
    },
    finalRewards,
    notifications,
  };
}

async function updateCigarettePrice(userId, price) {
  await pool.query(
    `
      UPDATE public.users
      SET cigarette_price = $2
      WHERE id = $1
    `,
    [userId, price],
  );
  await pool.query(
    `
      UPDATE public.user_stats
      SET price_per_cigarette = $2
      WHERE user_id = $1
    `,
    [userId, price],
  );

  await emitUserRealtimeState(userId, { source: "price_updated" });
  return getProfileData(userId);
}

async function updateSmokingPreferences(userId, payload) {
  const price = Math.max(1, toNumber(payload.cigarettePrice, 20));
  const dailySmokingAverage = Math.max(1, toNumber(payload.dailySmokingAverage, 10));
  await pool.query(
    `
      UPDATE public.users
      SET cigarette_price = $2
      WHERE id = $1
    `,
    [userId, price],
  );
  await pool.query(
    `
      UPDATE public.user_stats
      SET price_per_cigarette = $2, daily_smoking_average = $3
      WHERE user_id = $1
    `,
    [userId, price, dailySmokingAverage],
  );

  await emitUserRealtimeState(userId, { source: "preferences_updated" });
  return getProfileData(userId);
}

async function getProfileAchievements(userId) {
  const { snapshot } = await syncUserState(userId);
  await ensureUserAchievements(userId, snapshot);
  const visibleAchievementKeys = [
    "baseline-broken",
    "five-avoided",
    "twenty-avoided",
    "fifty-avoided",
    "hundred-avoided",
    "one-day-smoke-free",
    "three-days-smoke-free",
    "one-week-smoke-free",
    "one-month-smoke-free",
    "level-2",
    "level-5",
    "level-10",
    "final-recovery-level",
  ];

  const { rows } = await pool.query(
    `
      SELECT
        a.id,
        a.achievement_key,
        a.title,
        a.description,
        a.icon,
        a.xp_reward,
        a.level_required,
        a.category,
        a.tier,
        a.sort_order,
        a.is_final_reward,
        ua.unlocked_at
      FROM public.achievements a
      INNER JOIN public.user_achievements ua
        ON ua.achievement_id = a.id
       AND ua.user_id = $1
      WHERE a.achievement_key = ANY($2)
      ORDER BY ua.unlocked_at DESC, a.sort_order ASC, a.id ASC
    `,
    [userId, visibleAchievementKeys],
  );

  return rows.map((row) => ({
    ...row,
    unlocked: true,
  }));
}

async function generateFinalCertificate(userId) {
  const profile = await getProfileData(userId);
  if (!profile.finalRewards?.isFinalLevel) {
    const error = new Error("Final level is required before generating a certificate.");
    error.status = 400;
    throw error;
  }

  const achievements = await getProfileAchievements(userId);
  const unlockedCount = achievements.filter((achievement) => achievement.unlocked).length;
  const certificateId = generateCertificateId(userId);
  const verificationCode = generateVerificationCode(userId);
  const completionDate = new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "2-digit" });
  const smokeFreeDays = Math.floor(profile.finalRewards.report.smokeFreeHours / 24);
  const lines = [
    { text: "LAST PUFF", x: 72, y: 792, font: 2, size: 24 },
    { text: "Premium Recovery Certificate", x: 72, y: 764, font: 1, size: 13 },
    { text: "Official recognition of sustained recovery progress", x: 72, y: 744, font: 1, size: 10 },
    { text: "Certificate of Completion", x: 160, y: 680, font: 2, size: 28 },
    { text: `Presented to ${profile.user.name}`, x: 150, y: 640, font: 2, size: 20 },
    { text: `for reaching ${profile.levelName} and completing the Last Puff recovery journey.`, x: 92, y: 610, font: 1, size: 13 },
    { text: `Final Level: ${profile.level}`, x: 92, y: 555, font: 2, size: 14 },
    { text: `Smoke-Free Duration: ${smokeFreeDays} day(s)`, x: 92, y: 532, font: 1, size: 12 },
    { text: `Total Cigarettes Avoided: ${profile.stats.totalCigarettesAvoided}`, x: 92, y: 510, font: 1, size: 12 },
    { text: `Total Money Saved: Rs${Math.round(profile.savings.total).toLocaleString("en-IN")}`, x: 92, y: 488, font: 1, size: 12 },
    { text: `Achievements Unlocked: ${unlockedCount}`, x: 92, y: 466, font: 1, size: 12 },
    { text: "Your discipline, recovery metrics, and insight history now stand as a verified milestone.", x: 92, y: 418, font: 1, size: 12 },
    { text: "This certificate recognizes a life-changing shift in health, control, and identity.", x: 92, y: 396, font: 1, size: 12 },
    { text: "Authorized by Last Puff Recovery Systems", x: 92, y: 180, font: 2, size: 12 },
    { text: `Certificate ID: ${certificateId}`, x: 92, y: 145, font: 1, size: 10 },
    { text: `Verification Code: ${verificationCode}`, x: 280, y: 145, font: 1, size: 10 },
    { text: `Completion Date: ${completionDate}`, x: 92, y: 128, font: 1, size: 10 },
  ];

  const pdfBuffer = createPdfBuffer(lines);
  await pool.query(
    `
      INSERT INTO public.completion_certificates (user_id, certificate_id, verification_code, pdf_base64, metadata, created_at)
      VALUES ($1, $2, $3, $4, $5::jsonb, NOW())
      ON CONFLICT (certificate_id)
      DO NOTHING
    `,
    [
      userId,
      certificateId,
      verificationCode,
      pdfBuffer.toString("base64"),
      JSON.stringify({
        level: profile.level,
        levelName: profile.levelName,
        smokeFreeHours: profile.finalRewards.report.smokeFreeHours,
        totalCigarettesAvoided: profile.stats.totalCigarettesAvoided,
        totalMoneySaved: profile.savings.total,
      }),
    ],
  );

  return {
    filename: `last-puff-certificate-${certificateId}.pdf`,
    pdfBuffer,
    certificateId,
    verificationCode,
  };
}

module.exports = {
  ensureUserBootstrap,
  getDashboardData,
  logCigarette,
  startQuitAttempt,
  getRecentActivity,
  getAppsData,
  addBlockedApp,
  saveBlockedAppsSelection,
  toggleBlockedApp,
  deleteBlockedApp,
  saveBlockSchedule,
  saveVerificationAttempt,
  getRoastAnalytics,
  getRoastHighlights,
  getNearbyUsers,
  updateVisibility,
  runRadarScan,
  getProfileData,
  updateCigarettePrice,
  updateSmokingPreferences,
  getProfileAchievements,
  updateUserLocation,
  generateFinalCertificate,
  emitUserRealtimeState,
};
