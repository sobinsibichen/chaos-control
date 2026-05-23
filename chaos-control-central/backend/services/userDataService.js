const pool = require("../config/db");
const { emitUserRefresh, emitSocialEvent } = require("../socket/realtime");

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
  const smokeFreeStartedAt = statsRow?.smoke_free_started_at ? new Date(statsRow.smoke_free_started_at) : null;
  const smokeFreeSeconds = smokeFreeStartedAt ? Math.max(0, Math.floor((Date.now() - smokeFreeStartedAt.getTime()) / 1000)) : 0;
  const smokeFreeHours = smokeFreeSeconds / 3600;
  const streakPoints = Math.floor(smokeFreeHours / 24) * 10;
  const highestStreak = Math.max(toNumber(statsRow?.highest_streak), streakPoints);
  const focusScore = clamp(Math.round(100 - todayCigarettes * 5 + smokeFreeHours * 0.5), 0, 100);
  const focusLevel = getFocusLevel(focusScore);
  const regretLevel = clamp(Math.round(todayCigarettes * 7 - smokeFreeHours * 0.2 + (todayCigarettes > 0 ? 12 : 0)), 0, 100);
  const stabilityLevel = clamp(Math.round(100 - todayCigarettes * 4 + smokeFreeHours * 0.35 + streakPoints * 0.2), 0, 100);
  const cigarettesAvoidedToday = Math.max(dailySmokingAverage - todayCigarettes, 0);
  const trackingDays = Math.max(
    1,
    Math.floor((Date.now() - new Date(user?.created_at || Date.now()).getTime()) / 86400000) + 1,
  );
  const trackedWeeklyDays = Math.min(trackingDays, 7);
  const cigarettesAvoidedWeekly = Math.max(dailySmokingAverage * trackedWeeklyDays - weeklyCigarettes, 0);
  const cigarettesAvoidedTotal = Math.max(dailySmokingAverage * trackingDays - totalCigarettes, 0);
  const todaySavings = cigarettesAvoidedToday * cigarettePrice;
  const weeklySavings = cigarettesAvoidedWeekly * cigarettePrice;
  const totalSavings = cigarettesAvoidedTotal * cigarettePrice;
  const reducedSmokingRatio = dailySmokingAverage > 0 ? cigarettesAvoidedToday / dailySmokingAverage : 1;
  const lungsRecoveryPercent = clamp(
    Math.round(smokeFreeHours * 1.3 + streakPoints * 0.35 + reducedSmokingRatio * 20),
    0,
    100,
  );
  const recoveryStage = getRecoveryStage(smokeFreeHours);
  const currentLevel =
    levels
      .filter((level) => toNumber(level.required_points) <= streakPoints)
      .slice(-1)[0] || levels[0] || { level_number: 1, level_name: "Starter", required_points: 0, reward_title: "One breath at a time" };
  const nextLevel =
    levels.find((level) => toNumber(level.required_points) > streakPoints) || null;
  const currentLevelRequired = toNumber(currentLevel.required_points);
  const nextLevelRequired = toNumber(nextLevel?.required_points, currentLevelRequired);
  const levelProgressPercent = nextLevel
    ? clamp(Math.round(((streakPoints - currentLevelRequired) / Math.max(1, nextLevelRequired - currentLevelRequired)) * 100), 0, 100)
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
    streakPoints,
    highestStreak,
    focusScore,
    focusLevel,
    regretLevel,
    stabilityLevel,
    cigarettesAvoidedToday,
    cigarettesAvoidedWeekly,
    cigarettesAvoidedTotal,
    todaySavings,
    weeklySavings,
    totalSavings,
    lungsRecoveryPercent,
    recoveryStage,
    currentLevel,
    nextLevel,
    levelProgressPercent,
    longestQuitSeconds: Math.max(longestQuitSeconds, smokeFreeSeconds),
    commitment: getCommitment(streakPoints),
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
      snapshot.streakPoints,
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

  if (snapshot.streakPoints >= 10 && previousHighestStreak < snapshot.streakPoints) {
    await addActivity(
      userId,
      "streak_progress",
      "Streak moved forward",
      `${snapshot.streakPoints} streak points reached.`,
      db,
    );
  }

  if (snapshot.streakPoints !== previousStreak) {
    emitSocialEvent("streak-updated", {
      userId,
      streak: snapshot.streakPoints,
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
      current: snapshot.streakPoints,
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
        SET smoke_free_started_at = NULL, current_streak = 0, lungs_recovery_percent = 0
        WHERE user_id = $1
      `,
      [userId],
    );

    await addActivity(userId, "cigarette_logged", "Smoking session recorded", `Logged ${count} cigarette${count === 1 ? "" : "s"}.`, client);
    const { snapshot, notifications } = await syncUserState(userId, client);
    await ensureUserAchievements(userId, snapshot, client);
    await client.query("COMMIT");

    emitUserRefresh(userId, { source: "cigarette_logged", notifications });

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
        SET smoke_free_started_at = NOW(), current_streak = 0
        WHERE user_id = $1
      `,
      [userId],
    );
    await addActivity(userId, "quit_started", "Quit attempt started", "Your future self approves.", client);
    const { snapshot, notifications } = await syncUserState(userId, client);
    await ensureUserAchievements(userId, snapshot, client);
    await client.query("COMMIT");

    emitUserRefresh(userId, { source: "quit_started", notifications });

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
  const unlockedTitles = [];

  if (snapshot.totalCigarettes >= 1 && (await ensureAchievementUnlocked(userId, "First Log", db))) {
    unlockedTitles.push("First Log");
  }
  if (snapshot.smokeFreeStartedAt && (await ensureAchievementUnlocked(userId, "Quit Try", db))) {
    unlockedTitles.push("Quit Try");
  }
  if (snapshot.blockedBuys >= 1 && (await ensureAchievementUnlocked(userId, "Guardian", db))) {
    unlockedTitles.push("Guardian");
  }
  if (snapshot.focusLevel === "HIGH" && (await ensureAchievementUnlocked(userId, "Focus Mode", db))) {
    unlockedTitles.push("Focus Mode");
  }
  if (snapshot.totalCigarettes >= 25 && (await ensureAchievementUnlocked(userId, "Persistence", db))) {
    unlockedTitles.push("Persistence");
  }

  for (const title of unlockedTitles) {
    await addActivity(userId, "achievement", "Achievement unlocked", title, db);
  }
}

async function getRecentActivity(userId, limit = 5) {
  const { rows } = await pool.query(
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
  emitUserRefresh(userId, { source: "blocked_app_added" });
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
    emitUserRefresh(userId, { source: "blocked_apps_saved" });
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
  emitUserRefresh(userId, { source: "blocked_app_toggled" });
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
    emitUserRefresh(userId, { source: "blocked_app_deleted" });
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
  emitUserRefresh(userId, { source: "schedule_updated" });
  return rows[0];
}

async function saveVerificationAttempt(userId, payload) {
  const passed = Boolean(payload.passed);
  await addActivity(userId, "verification", "Verification challenge completed", passed ? "Verification challenge passed." : "Verification challenge failed.");
  emitUserRefresh(userId, { source: "verification" });

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
    currentStreak: snapshot.streakPoints,
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
  emitUserRefresh(userId, { source: "visibility" });
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
  emitUserRefresh(userId, { source: "radar_scan" });
  return users;
}

async function getProfileData(userId) {
  const { snapshot, notifications } = await syncUserState(userId);

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
    currentLevelXp: snapshot.streakPoints,
    xpToNextLevel: snapshot.nextLevel ? toNumber(snapshot.nextLevel.required_points) : snapshot.streakPoints,
    levelProgressPercent: snapshot.levelProgressPercent,
    commitment: snapshot.commitment,
    streak: {
      current: snapshot.streakPoints,
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

  emitUserRefresh(userId, { source: "price_updated" });
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

  emitUserRefresh(userId, { source: "preferences_updated" });
  return getProfileData(userId);
}

async function getProfileAchievements(userId) {
  const { snapshot } = await syncUserState(userId);
  await ensureUserAchievements(userId, snapshot);

  const { rows } = await pool.query(
    `
      SELECT
        a.id,
        a.title,
        a.description,
        a.icon,
        a.xp_reward,
        a.level_required,
        ua.unlocked_at
      FROM public.achievements a
      LEFT JOIN public.user_achievements ua
        ON ua.achievement_id = a.id
       AND ua.user_id = $1
      ORDER BY a.level_required NULLS LAST, a.id
    `,
    [userId],
  );

  return rows.map((row) => ({
    ...row,
    unlocked: Boolean(row.unlocked_at),
  }));
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
};
