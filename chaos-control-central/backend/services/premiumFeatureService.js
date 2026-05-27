const pool = require("../config/db");
const { createError } = require("../utils/http");
const {
  ensureUserBootstrap,
  getDashboardData,
  getRoastAnalytics,
  getRecentActivity,
  emitUserRealtimeState,
} = require("./userDataService");

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildPagedPayload(rows, total, page, limit) {
  return {
    items: rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

async function addFeatureActivity(userId, activityType, title, description, db = pool) {
  await db.query(
    `
      INSERT INTO public.activity_feed (user_id, activity_type, title, description, created_at)
      VALUES ($1, $2, $3, $4, NOW())
    `,
    [userId, activityType, title, description],
  );
}

function resolveSmokerType(dashboard, analytics) {
  const average = dashboard?.stats?.dailySmokingAverage ?? 0;
  const regretLevel = dashboard?.dailyStatus?.regretLevel ?? 0;
  const latePeak = analytics?.peakSingleDay ?? 0;

  if (average >= 14 || latePeak >= 16) {
    return "Heavy User";
  }
  if (regretLevel >= 60) {
    return "Stress Smoker";
  }
  if (average >= 8) {
    return "Night Smoker";
  }
  if (average >= 4) {
    return "Routine Smoker";
  }
  return "Social Smoker";
}

function buildTriggerPatterns(dashboard, activity) {
  const blockedBuys = dashboard?.stats?.blockedBuys ?? 0;
  const regretLevel = dashboard?.dailyStatus?.regretLevel ?? 0;
  const recentActions = activity.slice(0, 5).map((row) => row.title);

  return [
    { trigger: "Stress spike", score: Math.min(100, regretLevel + 12) },
    { trigger: "After meals", score: 58 },
    { trigger: "Late-night scrolling", score: 72 },
    { trigger: "Impulse shopping", score: Math.min(100, 25 + blockedBuys * 8) },
    { trigger: recentActions[0] || "Routine cravings", score: 41 },
  ];
}

function buildTimeOfDayAnalysis(dashboard) {
  const average = dashboard?.stats?.dailySmokingAverage ?? 0;
  return {
    morning: Math.max(10, Math.round(average * 6)),
    afternoon: Math.max(18, Math.round(average * 8)),
    evening: Math.max(30, Math.round(average * 11)),
    lateNight: Math.max(35, Math.round((dashboard?.dailyStatus?.regretLevel ?? 40) * 0.8)),
  };
}

function buildHeatmapData(dashboard, analytics) {
  const monthly = analytics?.monthlyCigarettes ?? new Array(12).fill(0);
  const baseline = dashboard?.stats?.todayCount ?? 0;
  const peak = Math.max(...monthly, baseline, 1);

  return Array.from({ length: 7 }, (_, dayIndex) =>
    Array.from({ length: 4 }, (_, blockIndex) => {
      const value = monthly[(dayIndex + blockIndex) % monthly.length] ?? baseline;
      return {
        day: dayIndex,
        block: blockIndex,
        intensity: Math.round((value / peak) * 100),
      };
    }),
  );
}

function buildSmokeDnaInsights(dashboard, analytics) {
  const regretLevel = dashboard?.dailyStatus?.regretLevel ?? 0;
  const blockedBuys = dashboard?.stats?.blockedBuys ?? 0;
  const peakHour = regretLevel >= 60 ? "after 9PM" : "after meals";

  return [
    `You smoke ${Math.min(89, regretLevel + 18)}% more ${peakHour}.`,
    `Stress is linked to ${Math.min(92, regretLevel + 14)}% of your smoking sessions.`,
    `${blockedBuys} blocked purchases suggest impulse loops are closely tied to cravings.`,
  ];
}

async function calculateSmokeDna(userId, payload = {}) {
  const [dashboard, analytics, activity] = await Promise.all([
    getDashboardData(userId),
    getRoastAnalytics(userId),
    getRecentActivity(userId, 10),
  ]);

  const smokerType = payload.smokerType || resolveSmokerType(dashboard, analytics);
  const habitScore = payload.habitScore ?? Math.min(100, Math.round((dashboard?.stats?.dailySmokingAverage ?? 0) * 8 + (dashboard?.dailyStatus?.regretLevel ?? 0) * 0.35));
  const smokingIntensity = payload.smokingIntensity ?? Math.min(100, Math.round((analytics?.peakSingleDay ?? 0) * 5 + (dashboard?.stats?.todayCount ?? 0) * 3));
  const triggerPatterns = payload.triggerPatterns?.length ? payload.triggerPatterns : buildTriggerPatterns(dashboard, activity);
  const moodCorrelation = Object.keys(payload.moodCorrelation || {}).length
    ? payload.moodCorrelation
    : {
        stressed: Math.min(100, (dashboard?.dailyStatus?.regretLevel ?? 0) + 12),
        calm: Math.max(5, 100 - (dashboard?.dailyStatus?.stabilityLevel ?? 50)),
        social: 34,
      };
  const timeOfDayAnalysis = Object.keys(payload.timeOfDayAnalysis || {}).length
    ? payload.timeOfDayAnalysis
    : buildTimeOfDayAnalysis(dashboard);
  const heatmap = payload.heatmap?.length ? payload.heatmap : buildHeatmapData(dashboard, analytics);
  const insights = payload.insights?.length ? payload.insights : buildSmokeDnaInsights(dashboard, analytics);
  const rawMetrics = Object.keys(payload.rawMetrics || {}).length
    ? payload.rawMetrics
    : {
        todayCount: dashboard?.stats?.todayCount ?? 0,
        dailySmokingAverage: dashboard?.stats?.dailySmokingAverage ?? 0,
        regretLevel: dashboard?.dailyStatus?.regretLevel ?? 0,
        peakSingleDay: analytics?.peakSingleDay ?? 0,
      };

  return {
    smokerType,
    habitScore,
    smokingIntensity,
    triggerPatterns,
    moodCorrelation,
    timeOfDayAnalysis,
    heatmap,
    insights,
    rawMetrics,
  };
}

async function createSmokeDnaRecord(userId, payload) {
  await ensureUserBootstrap(userId);
  const dna = await calculateSmokeDna(userId, payload);
  const { rows } = await pool.query(
    `
      INSERT INTO public.smoke_dna (
        user_id, smoker_type, habit_score, smoking_intensity, trigger_patterns, mood_correlation,
        time_of_day_analysis, heatmap, insights, raw_metrics, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb, NOW(), NOW())
      RETURNING *
    `,
    [
      userId,
      dna.smokerType,
      dna.habitScore,
      dna.smokingIntensity,
      JSON.stringify(dna.triggerPatterns),
      JSON.stringify(dna.moodCorrelation),
      JSON.stringify(dna.timeOfDayAnalysis),
      JSON.stringify(dna.heatmap),
      JSON.stringify(dna.insights),
      JSON.stringify(dna.rawMetrics),
    ],
  );

  await addFeatureActivity(userId, "smoke_dna_created", "Smoke DNA generated", `Smoking profile stored as ${dna.smokerType}.`);
  await emitUserRealtimeState(userId, { source: "smoke_dna_created" });
  return rows[0];
}

async function listSmokeDnaRecords(userId, pagination) {
  await ensureUserBootstrap(userId);
  const [{ rows }, countResult] = await Promise.all([
    pool.query(
      `
        SELECT *
        FROM public.smoke_dna
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `,
      [userId, pagination.limit, pagination.offset],
    ),
    pool.query("SELECT COUNT(*)::int AS total FROM public.smoke_dna WHERE user_id = $1", [userId]),
  ]);

  return buildPagedPayload(rows, countResult.rows[0]?.total ?? 0, pagination.page, pagination.limit);
}

async function updateSmokeDnaRecord(userId, id, payload) {
  const existing = await pool.query("SELECT * FROM public.smoke_dna WHERE id = $1 AND user_id = $2 LIMIT 1", [id, userId]);
  if (!existing.rows[0]) {
    throw createError(404, "Smoke DNA record not found.");
  }

  const dna = await calculateSmokeDna(userId, {
    smokerType: payload.smokerType || existing.rows[0].smoker_type,
    habitScore: payload.habitScore ?? existing.rows[0].habit_score,
    smokingIntensity: payload.smokingIntensity ?? existing.rows[0].smoking_intensity,
    triggerPatterns: payload.triggerPatterns?.length ? payload.triggerPatterns : existing.rows[0].trigger_patterns,
    moodCorrelation: Object.keys(payload.moodCorrelation || {}).length ? payload.moodCorrelation : existing.rows[0].mood_correlation,
    timeOfDayAnalysis: Object.keys(payload.timeOfDayAnalysis || {}).length ? payload.timeOfDayAnalysis : existing.rows[0].time_of_day_analysis,
    heatmap: payload.heatmap?.length ? payload.heatmap : existing.rows[0].heatmap,
    insights: payload.insights?.length ? payload.insights : existing.rows[0].insights,
    rawMetrics: Object.keys(payload.rawMetrics || {}).length ? payload.rawMetrics : existing.rows[0].raw_metrics,
  });

  const { rows } = await pool.query(
    `
      UPDATE public.smoke_dna
      SET
        smoker_type = $3,
        habit_score = $4,
        smoking_intensity = $5,
        trigger_patterns = $6::jsonb,
        mood_correlation = $7::jsonb,
        time_of_day_analysis = $8::jsonb,
        heatmap = $9::jsonb,
        insights = $10::jsonb,
        raw_metrics = $11::jsonb,
        updated_at = NOW()
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `,
    [
      id,
      userId,
      dna.smokerType,
      dna.habitScore,
      dna.smokingIntensity,
      JSON.stringify(dna.triggerPatterns),
      JSON.stringify(dna.moodCorrelation),
      JSON.stringify(dna.timeOfDayAnalysis),
      JSON.stringify(dna.heatmap),
      JSON.stringify(dna.insights),
      JSON.stringify(dna.rawMetrics),
    ],
  );

  await addFeatureActivity(userId, "smoke_dna_updated", "Smoke DNA updated", `Smoke DNA record ${id} refreshed.`);
  await emitUserRealtimeState(userId, { source: "smoke_dna_updated" });
  return rows[0];
}

async function deleteSmokeDnaRecord(userId, id) {
  const { rows } = await pool.query(
    "DELETE FROM public.smoke_dna WHERE id = $1 AND user_id = $2 RETURNING id, smoker_type",
    [id, userId],
  );
  if (!rows[0]) {
    throw createError(404, "Smoke DNA record not found.");
  }
  await addFeatureActivity(userId, "smoke_dna_deleted", "Smoke DNA removed", `Smoke DNA record ${id} deleted.`);
  await emitUserRealtimeState(userId, { source: "smoke_dna_deleted" });
  return rows[0];
}

function getReplayPeriodRange(replayPeriod, year, month) {
  if (replayPeriod === "yearly") {
    const start = new Date(Date.UTC(year, 0, 1));
    const end = new Date(Date.UTC(year + 1, 0, 1));
    return { start, end, key: `${year}`, title: `Your ${year} Replay` };
  }

  if (replayPeriod === "weekly") {
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() - 6);
    const end = new Date();
    end.setUTCHours(23, 59, 59, 999);
    return {
      start,
      end: new Date(end.getTime() + 1),
      key: `${start.toISOString().slice(0, 10)}`,
      title: "Your Weekly Replay",
    };
  }

  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  const label = start.toLocaleString("en-US", { month: "long", timeZone: "UTC" });
  return { start, end, key: `${year}-${String(month).padStart(2, "0")}`, title: `Your ${label} Replay` };
}

async function generateReplaySnapshot(userId, payload) {
  await ensureUserBootstrap(userId);
  const replayPeriod = payload.replayPeriod || "monthly";
  const year = payload.year || new Date().getUTCFullYear();
  const month = payload.month || new Date().getUTCMonth() + 1;
  const { start, end, key, title } = getReplayPeriodRange(replayPeriod, year, month);

  const [summaryResult, peakHourResult, worstDayResult, calendarResult, analytics] = await Promise.all([
    pool.query(
      `
        SELECT
          COALESCE(SUM(cigarettes_count), 0)::int AS total_cigarettes,
          COALESCE(SUM(cigarettes_count * price_per_unit), 0)::numeric AS total_spend
        FROM public.cigarette_logs
        WHERE user_id = $1 AND logged_at >= $2 AND logged_at < $3
      `,
      [userId, start.toISOString(), end.toISOString()],
    ),
    pool.query(
      `
        SELECT EXTRACT(HOUR FROM logged_at)::int AS hour, SUM(cigarettes_count)::int AS total
        FROM public.cigarette_logs
        WHERE user_id = $1 AND logged_at >= $2 AND logged_at < $3
        GROUP BY EXTRACT(HOUR FROM logged_at)
        ORDER BY total DESC, hour DESC
        LIMIT 1
      `,
      [userId, start.toISOString(), end.toISOString()],
    ),
    pool.query(
      `
        SELECT TO_CHAR(logged_at, 'Day') AS day_name, logged_at::date AS day, SUM(cigarettes_count)::int AS total
        FROM public.cigarette_logs
        WHERE user_id = $1 AND logged_at >= $2 AND logged_at < $3
        GROUP BY TO_CHAR(logged_at, 'Day'), logged_at::date
        ORDER BY total DESC, day DESC
        LIMIT 1
      `,
      [userId, start.toISOString(), end.toISOString()],
    ),
    pool.query(
      `
        SELECT logged_at::date AS day, SUM(cigarettes_count)::int AS total
        FROM public.cigarette_logs
        WHERE user_id = $1 AND logged_at >= $2 AND logged_at < $3
        GROUP BY logged_at::date
        ORDER BY day ASC
      `,
      [userId, start.toISOString(), end.toISOString()],
    ),
    getRoastAnalytics(userId),
  ]);

  const totalCigarettes = toNumber(summaryResult.rows[0]?.total_cigarettes, 0);
  const totalSpend = Math.round(toNumber(summaryResult.rows[0]?.total_spend, 0));
  const peakHour = peakHourResult.rows[0]?.hour ?? null;
  const worstDay = worstDayResult.rows[0] || null;
  const calendarHeatmap = calendarResult.rows.map((row) => ({
    day: row.day,
    total: toNumber(row.total, 0),
  }));

  return {
    replayPeriod,
    replayKey: key,
    title: payload.title || title,
    periodStart: start.toISOString().slice(0, 10),
    periodEnd: new Date(end.getTime() - 1).toISOString().slice(0, 10),
    analytics: {
      cigarettesConsumed: totalCigarettes,
      moneyBurned: totalSpend,
      peakCravingHour: peakHour === null ? null : `${String(peakHour).padStart(2, "0")}:00`,
      highestSmokingDay: worstDay ? String(worstDay.day_name || "").trim() : null,
      streak: analytics.currentStreak,
      calendarHeatmap,
      cigarettesAvoidedTotal: analytics.cigarettesAvoidedTotal,
    },
    highlights: [
      `${totalCigarettes} cigarettes tracked in this replay.`,
      `${analytics.currencySymbol}${totalSpend} spent in the selected period.`,
      peakHour === null ? "No peak hour available yet." : `Peak smoking hour landed at ${String(peakHour).padStart(2, "0")}:00.`,
    ],
  };
}

async function upsertSmokeReplayRecord(userId, payload) {
  const replay = await generateReplaySnapshot(userId, payload);
  const { rows } = await pool.query(
    `
      INSERT INTO public.smoke_replay (
        user_id, replay_period, replay_key, title, period_start, period_end, analytics, highlights, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, NOW(), NOW())
      ON CONFLICT (user_id, replay_period, replay_key)
      DO UPDATE SET
        title = EXCLUDED.title,
        period_start = EXCLUDED.period_start,
        period_end = EXCLUDED.period_end,
        analytics = EXCLUDED.analytics,
        highlights = EXCLUDED.highlights,
        updated_at = NOW()
      RETURNING *
    `,
    [
      userId,
      replay.replayPeriod,
      replay.replayKey,
      replay.title,
      replay.periodStart,
      replay.periodEnd,
      JSON.stringify(replay.analytics),
      JSON.stringify(replay.highlights),
    ],
  );

  await addFeatureActivity(userId, "smoke_replay_generated", "Smoke replay generated", `${replay.title} is ready.`);
  await emitUserRealtimeState(userId, { source: "smoke_replay_generated" });
  return rows[0];
}

async function listSmokeReplayRecords(userId, pagination) {
  await ensureUserBootstrap(userId);
  const [{ rows }, countResult] = await Promise.all([
    pool.query(
      `
        SELECT *
        FROM public.smoke_replay
        WHERE user_id = $1
        ORDER BY period_start DESC, created_at DESC
        LIMIT $2 OFFSET $3
      `,
      [userId, pagination.limit, pagination.offset],
    ),
    pool.query("SELECT COUNT(*)::int AS total FROM public.smoke_replay WHERE user_id = $1", [userId]),
  ]);

  return buildPagedPayload(rows, countResult.rows[0]?.total ?? 0, pagination.page, pagination.limit);
}

function buildCravingHours(dashboard, analytics, stressLevel = null) {
  const baseStress = stressLevel === null ? dashboard?.dailyStatus?.regretLevel ?? 40 : stressLevel;
  return Array.from({ length: 24 }, (_, hour) => {
    const afterMealBoost = [9, 14, 21].includes(hour) ? 10 : 0;
    const lateBoost = hour >= 21 ? 26 : hour >= 18 ? 14 : 4;
    const routineBoost = Math.round((dashboard?.stats?.dailySmokingAverage ?? 0) * 2.8);
    const value = Math.max(10, Math.min(98, baseStress * 0.45 + lateBoost + afterMealBoost + routineBoost + (analytics?.peakSingleDay ?? 0)));
    return {
      hour,
      score: Math.round(value),
    };
  });
}

async function buildCravingPrediction(userId, payload = {}) {
  const [dashboard, analytics] = await Promise.all([
    getDashboardData(userId),
    getRoastAnalytics(userId),
  ]);

  const hours = buildCravingHours(dashboard, analytics, payload.stressLevel);
  const dangerousHours = [...hours].sort((left, right) => right.score - left.score).slice(0, 5);
  const currentHour = new Date().getHours();
  const currentScore = hours.find((hour) => hour.hour === currentHour)?.score ?? dangerousHours[0]?.score ?? 0;
  const triggerPrediction = {
    primary: payload.triggerContext || ((dashboard?.dailyStatus?.regretLevel ?? 0) > 55 ? "stress" : "routine"),
    mood: payload.mood || ((dashboard?.dailyStatus?.stabilityLevel ?? 0) < 55 ? "stressed" : "restless"),
    timeBias: dangerousHours[0]?.hour ?? currentHour,
  };

  return {
    predictionWindow: payload.predictionWindow || "30m",
    cravingProbability: Math.max(5, Math.min(99, currentScore)),
    intensityScore: Math.max(5, Math.min(100, currentScore + Math.round((analytics?.dailyAverage ?? 0) / 3))),
    dangerousHours,
    triggerPrediction,
    insightText: `High craving probability detected near ${String(triggerPrediction.timeBias).padStart(2, "0")}:00. ${String(triggerPrediction.primary).replace(/^\w/, (match) => match.toUpperCase())} is the dominant trigger right now.`,
    generatedFrom: {
      todayCount: dashboard?.stats?.todayCount ?? 0,
      dailyAverage: analytics?.dailyAverage ?? 0,
      regretLevel: dashboard?.dailyStatus?.regretLevel ?? 0,
      stressLevel: payload.stressLevel,
    },
  };
}

async function createCravingPredictionRecord(userId, payload) {
  await ensureUserBootstrap(userId);
  const prediction = await buildCravingPrediction(userId, payload);
  const { rows } = await pool.query(
    `
      INSERT INTO public.craving_predictions (
        user_id, prediction_window, craving_probability, intensity_score, dangerous_hours,
        trigger_prediction, insight_text, generated_from, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8::jsonb, NOW(), NOW())
      RETURNING *
    `,
    [
      userId,
      prediction.predictionWindow,
      prediction.cravingProbability,
      prediction.intensityScore,
      JSON.stringify(prediction.dangerousHours),
      JSON.stringify(prediction.triggerPrediction),
      prediction.insightText,
      JSON.stringify(prediction.generatedFrom),
    ],
  );

  await addFeatureActivity(userId, "craving_prediction_created", "Craving prediction generated", prediction.insightText);
  await emitUserRealtimeState(userId, { source: "craving_prediction_created" });
  return rows[0];
}

async function listCravingPredictionRecords(userId, pagination) {
  await ensureUserBootstrap(userId);
  const [{ rows }, countResult] = await Promise.all([
    pool.query(
      `
        SELECT *
        FROM public.craving_predictions
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `,
      [userId, pagination.limit, pagination.offset],
    ),
    pool.query("SELECT COUNT(*)::int AS total FROM public.craving_predictions WHERE user_id = $1", [userId]),
  ]);
  return buildPagedPayload(rows, countResult.rows[0]?.total ?? 0, pagination.page, pagination.limit);
}

async function getLiveCravingPrediction(userId) {
  await ensureUserBootstrap(userId);
  return buildCravingPrediction(userId, {});
}

async function createVoiceCommandRecord(userId, payload) {
  await ensureUserBootstrap(userId);
  const { rows } = await pool.query(
    `
      INSERT INTO public.voice_commands (
        user_id, command_text, ai_response, command_intent, execution_status, metadata, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW())
      RETURNING *
    `,
    [
      userId,
      payload.commandText,
      payload.aiResponse,
      payload.commandIntent,
      payload.executionStatus,
      JSON.stringify(payload.metadata || {}),
    ],
  );
  await emitUserRealtimeState(userId, { source: "voice_command_created" });
  return rows[0];
}

async function listVoiceCommandRecords(userId, pagination) {
  await ensureUserBootstrap(userId);
  const [{ rows }, countResult] = await Promise.all([
    pool.query(
      `
        SELECT *
        FROM public.voice_commands
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `,
      [userId, pagination.limit, pagination.offset],
    ),
    pool.query("SELECT COUNT(*)::int AS total FROM public.voice_commands WHERE user_id = $1", [userId]),
  ]);
  return buildPagedPayload(rows, countResult.rows[0]?.total ?? 0, pagination.page, pagination.limit);
}

async function createScannerHistoryRecord(userId, payload) {
  await ensureUserBootstrap(userId);
  const { rows } = await pool.query(
    `
      INSERT INTO public.scanner_history (
        user_id, code_value, code_format, source, brand, pack_price, nicotine_mg, tar_mg, damage_score, chemicals, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, NOW())
      RETURNING *
    `,
    [
      userId,
      payload.codeValue,
      payload.codeFormat,
      payload.source,
      payload.brand,
      payload.packPrice,
      payload.nicotineMg,
      payload.tarMg,
      payload.damageScore,
      JSON.stringify(payload.chemicals || []),
    ],
  );
  await addFeatureActivity(userId, "scanner_history_created", "Pack scanned", `Scanned ${payload.brand || payload.codeValue}.`);
  await emitUserRealtimeState(userId, { source: "scanner_history_created" });
  return rows[0];
}

async function listScannerHistoryRecords(userId, pagination) {
  await ensureUserBootstrap(userId);
  const [{ rows }, countResult] = await Promise.all([
    pool.query(
      `
        SELECT *
        FROM public.scanner_history
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `,
      [userId, pagination.limit, pagination.offset],
    ),
    pool.query("SELECT COUNT(*)::int AS total FROM public.scanner_history WHERE user_id = $1", [userId]),
  ]);
  return buildPagedPayload(rows, countResult.rows[0]?.total ?? 0, pagination.page, pagination.limit);
}

async function createRitualSessionRecord(userId, payload) {
  await ensureUserBootstrap(userId);
  const { rows } = await pool.query(
    `
      INSERT INTO public.ritual_sessions (
        user_id, mood, duration_seconds, breath_cycles, ambient_sound, notes, session_data, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NOW())
      RETURNING *
    `,
    [
      userId,
      payload.mood,
      payload.durationSeconds,
      payload.breathCycles,
      payload.ambientSound,
      payload.notes,
      JSON.stringify(payload.sessionData || {}),
    ],
  );
  await emitUserRealtimeState(userId, { source: "ritual_session_created" });
  return rows[0];
}

async function listRitualSessionRecords(userId, pagination) {
  await ensureUserBootstrap(userId);
  const [{ rows }, countResult] = await Promise.all([
    pool.query(
      `
        SELECT *
        FROM public.ritual_sessions
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `,
      [userId, pagination.limit, pagination.offset],
    ),
    pool.query("SELECT COUNT(*)::int AS total FROM public.ritual_sessions WHERE user_id = $1", [userId]),
  ]);
  return buildPagedPayload(rows, countResult.rows[0]?.total ?? 0, pagination.page, pagination.limit);
}

async function createEmergencySessionRecord(userId, payload) {
  await ensureUserBootstrap(userId);
  const { rows } = await pool.query(
    `
      INSERT INTO public.emergency_sessions (
        user_id, trigger_reason, duration_seconds, completed, breathing_completed,
        vibration_used, motivation_shown, session_data, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, NOW())
      RETURNING *
    `,
    [
      userId,
      payload.triggerReason,
      payload.durationSeconds,
      payload.completed,
      payload.breathingCompleted,
      payload.vibrationUsed,
      JSON.stringify(payload.motivationShown || []),
      JSON.stringify(payload.sessionData || {}),
    ],
  );
  await emitUserRealtimeState(userId, { source: "emergency_session_created" });
  return rows[0];
}

async function listEmergencySessionRecords(userId, pagination) {
  await ensureUserBootstrap(userId);
  const [{ rows }, countResult] = await Promise.all([
    pool.query(
      `
        SELECT *
        FROM public.emergency_sessions
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `,
      [userId, pagination.limit, pagination.offset],
    ),
    pool.query("SELECT COUNT(*)::int AS total FROM public.emergency_sessions WHERE user_id = $1", [userId]),
  ]);
  return buildPagedPayload(rows, countResult.rows[0]?.total ?? 0, pagination.page, pagination.limit);
}

async function upsertFavoriteStoreRecord(userId, payload) {
  await ensureUserBootstrap(userId);
  const { rows } = await pool.query(
    `
      INSERT INTO public.favorite_stores (
        user_id, place_id, store_name, address, phone_number, maps_url, rating,
        is_open, latitude, longitude, metadata, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, NOW())
      ON CONFLICT (user_id, place_id)
      DO UPDATE SET
        store_name = EXCLUDED.store_name,
        address = EXCLUDED.address,
        phone_number = EXCLUDED.phone_number,
        maps_url = EXCLUDED.maps_url,
        rating = EXCLUDED.rating,
        is_open = EXCLUDED.is_open,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        metadata = EXCLUDED.metadata
      RETURNING *
    `,
    [
      userId,
      payload.placeId,
      payload.storeName,
      payload.address,
      payload.phoneNumber,
      payload.mapsUrl,
      payload.rating,
      payload.isOpen,
      payload.latitude,
      payload.longitude,
      JSON.stringify(payload.metadata || {}),
    ],
  );
  await emitUserRealtimeState(userId, { source: "favorite_store_saved" });
  return rows[0];
}

async function listFavoriteStoreRecords(userId, pagination) {
  await ensureUserBootstrap(userId);
  const [{ rows }, countResult] = await Promise.all([
    pool.query(
      `
        SELECT *
        FROM public.favorite_stores
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `,
      [userId, pagination.limit, pagination.offset],
    ),
    pool.query("SELECT COUNT(*)::int AS total FROM public.favorite_stores WHERE user_id = $1", [userId]),
  ]);
  return buildPagedPayload(rows, countResult.rows[0]?.total ?? 0, pagination.page, pagination.limit);
}

async function deleteFavoriteStoreRecord(userId, id) {
  const { rows } = await pool.query(
    "DELETE FROM public.favorite_stores WHERE id = $1 AND user_id = $2 RETURNING id, store_name",
    [id, userId],
  );
  if (!rows[0]) {
    throw createError(404, "Favorite store not found.");
  }
  await emitUserRealtimeState(userId, { source: "favorite_store_deleted" });
  return rows[0];
}

module.exports = {
  createSmokeDnaRecord,
  listSmokeDnaRecords,
  updateSmokeDnaRecord,
  deleteSmokeDnaRecord,
  upsertSmokeReplayRecord,
  listSmokeReplayRecords,
  createCravingPredictionRecord,
  listCravingPredictionRecords,
  getLiveCravingPrediction,
  createVoiceCommandRecord,
  listVoiceCommandRecords,
  createScannerHistoryRecord,
  listScannerHistoryRecords,
  createRitualSessionRecord,
  listRitualSessionRecords,
  createEmergencySessionRecord,
  listEmergencySessionRecords,
  upsertFavoriteStoreRecord,
  listFavoriteStoreRecords,
  deleteFavoriteStoreRecord,
};
