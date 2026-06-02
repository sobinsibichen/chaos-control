const achievementDefinitions = [
  { key: "baseline-broken", title: "Baseline Broken", description: "Smoked less than your normal daily count for the first time.", icon: "Cigarette", xpReward: 30, levelRequired: 1, category: "Smoking Reduction", tier: "Bronze", metricKey: "cigarettesAvoidedToday", metricThreshold: 1, sortOrder: 10, isFinalReward: false },
  { key: "five-avoided", title: "5 Cigarettes Avoided", description: "Saved 5 cigarettes by staying below your daily baseline.", icon: "ShieldCheck", xpReward: 50, levelRequired: 1, category: "Smoking Reduction", tier: "Bronze", metricKey: "cigarettesAvoidedTotal", metricThreshold: 5, sortOrder: 20, isFinalReward: false },
  { key: "twenty-avoided", title: "20 Cigarettes Avoided", description: "Built real momentum by avoiding 20 cigarettes in total.", icon: "ShieldCheck", xpReward: 90, levelRequired: 2, category: "Smoking Reduction", tier: "Silver", metricKey: "cigarettesAvoidedTotal", metricThreshold: 20, sortOrder: 30, isFinalReward: false },
  { key: "fifty-avoided", title: "50 Cigarettes Avoided", description: "Your recovery effort has now kept 50 cigarettes off the board.", icon: "Trophy", xpReward: 150, levelRequired: 3, category: "Smoking Reduction", tier: "Gold", metricKey: "cigarettesAvoidedTotal", metricThreshold: 50, sortOrder: 40, isFinalReward: false },
  { key: "hundred-avoided", title: "100 Cigarettes Avoided", description: "You have avoided 100 cigarettes compared with your daily baseline.", icon: "Trophy", xpReward: 240, levelRequired: 5, category: "Smoking Reduction", tier: "Platinum", metricKey: "cigarettesAvoidedTotal", metricThreshold: 100, sortOrder: 50, isFinalReward: false },
  { key: "one-day-smoke-free", title: "1 Day Smoke-Free", description: "Stayed smoke-free for one full day.", icon: "TimerReset", xpReward: 70, levelRequired: 2, category: "Smoke-Free Streak", tier: "Bronze", metricKey: "smokeFreeHours", metricThreshold: 24, sortOrder: 60, isFinalReward: false },
  { key: "three-days-smoke-free", title: "3 Days Smoke-Free", description: "Held your streak for three full days.", icon: "TimerReset", xpReward: 130, levelRequired: 3, category: "Smoke-Free Streak", tier: "Silver", metricKey: "smokeFreeHours", metricThreshold: 72, sortOrder: 70, isFinalReward: false },
  { key: "one-week-smoke-free", title: "1 Week Smoke-Free", description: "Made it through a full smoke-free week.", icon: "Flame", xpReward: 220, levelRequired: 5, category: "Smoke-Free Streak", tier: "Gold", metricKey: "smokeFreeHours", metricThreshold: 168, sortOrder: 80, isFinalReward: false },
  { key: "one-month-smoke-free", title: "1 Month Smoke-Free", description: "Thirty smoke-free days changed the direction of your recovery.", icon: "Flame", xpReward: 420, levelRequired: 8, category: "Smoke-Free Streak", tier: "Elite", metricKey: "smokeFreeHours", metricThreshold: 720, sortOrder: 90, isFinalReward: false },
  { key: "level-2", title: "Level 2 Reached", description: "Your first level-up came from smoking less than usual.", icon: "Trophy", xpReward: 40, levelRequired: 2, category: "Level Milestone", tier: "Bronze", metricKey: "currentLevel", metricThreshold: 2, sortOrder: 100, isFinalReward: false },
  { key: "level-5", title: "Level 5 Reached", description: "A steady reduction streak pushed you into Gold territory.", icon: "Trophy", xpReward: 90, levelRequired: 5, category: "Level Milestone", tier: "Gold", metricKey: "currentLevel", metricThreshold: 5, sortOrder: 110, isFinalReward: false },
  { key: "level-10", title: "Level 10 Reached", description: "You turned reduced smoking into a serious recovery run.", icon: "Flame", xpReward: 180, levelRequired: 10, category: "Level Milestone", tier: "Elite", metricKey: "currentLevel", metricThreshold: 10, sortOrder: 120, isFinalReward: false },
  { key: "final-recovery-level", title: "Smoking Gone From My Life", description: "Reached level 15 by cutting down and staying smoke-free.", icon: "Flame", xpReward: 500, levelRequired: 15, category: "Level Milestone", tier: "Final Recovery", metricKey: "currentLevel", metricThreshold: 15, sortOrder: 130, isFinalReward: true },
];

const levelDefinitions = [
  { levelNumber: 1, levelName: "Bronze I", requiredPoints: 0, rewardTitle: "First clean breath" },
  { levelNumber: 2, levelName: "Bronze II", requiredPoints: 25, rewardTitle: "Momentum is starting" },
  { levelNumber: 3, levelName: "Silver I", requiredPoints: 55, rewardTitle: "Early discipline secured" },
  { levelNumber: 4, levelName: "Silver II", requiredPoints: 90, rewardTitle: "Cravings losing ground" },
  { levelNumber: 5, levelName: "Gold I", requiredPoints: 130, rewardTitle: "Recovery is visible now" },
  { levelNumber: 6, levelName: "Gold II", requiredPoints: 175, rewardTitle: "Pressure handled with control" },
  { levelNumber: 7, levelName: "Platinum I", requiredPoints: 230, rewardTitle: "Identity shifting for real" },
  { levelNumber: 8, levelName: "Platinum II", requiredPoints: 290, rewardTitle: "Recovery engine running strong" },
  { levelNumber: 9, levelName: "Elite I", requiredPoints: 360, rewardTitle: "Your new routine feels stable" },
  { levelNumber: 10, levelName: "Elite II", requiredPoints: 440, rewardTitle: "Discipline has compound interest" },
  { levelNumber: 11, levelName: "Master I", requiredPoints: 530, rewardTitle: "Health rebound is undeniable" },
  { levelNumber: 12, levelName: "Master II", requiredPoints: 630, rewardTitle: "Freedom is getting louder" },
  { levelNumber: 13, levelName: "Final Recovery I", requiredPoints: 740, rewardTitle: "Old habits are losing ownership" },
  { levelNumber: 14, levelName: "Final Recovery II", requiredPoints: 860, rewardTitle: "Life is reorganizing around recovery" },
  { levelNumber: 15, levelName: "Final Recovery", requiredPoints: 1000, rewardTitle: "Smoking gone from your life" },
];

async function ensureAchievementDefinitions(client) {
  const existing = await client.query("SELECT 1 FROM public.achievements LIMIT 1");
  if (existing.rows.length) {
    return false;
  }

  const values = [];
  const placeholders = achievementDefinitions.map((achievement, index) => {
    const offset = index * 12;
    values.push(
      achievement.key,
      achievement.title,
      achievement.description,
      achievement.icon,
      achievement.xpReward,
      achievement.levelRequired,
      achievement.category,
      achievement.tier,
      achievement.metricKey,
      achievement.metricThreshold,
      achievement.sortOrder,
      achievement.isFinalReward,
    );
    return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12}, NOW())`;
  });

  await client.query(
    `
        INSERT INTO public.achievements (
          achievement_key, title, description, icon, xp_reward, level_required, category, tier,
          metric_key, metric_threshold, sort_order, is_final_reward, created_at
        )
        VALUES ${placeholders.join(", ")}
        ON CONFLICT (achievement_key)
        DO UPDATE SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          icon = EXCLUDED.icon,
          xp_reward = EXCLUDED.xp_reward,
          level_required = EXCLUDED.level_required,
          category = EXCLUDED.category,
          tier = EXCLUDED.tier,
          metric_key = EXCLUDED.metric_key,
          metric_threshold = EXCLUDED.metric_threshold,
          sort_order = EXCLUDED.sort_order,
          is_final_reward = EXCLUDED.is_final_reward
      `,
    values,
  );
  return true;
}

async function ensureLevelDefinitions(client) {
  const existing = await client.query("SELECT 1 FROM public.levels LIMIT 1");
  if (existing.rows.length) {
    return false;
  }

  const values = [];
  const placeholders = levelDefinitions.map((level, index) => {
    const offset = index * 4;
    values.push(level.levelNumber, level.levelName, level.requiredPoints, level.rewardTitle);
    return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, NOW())`;
  });

  await client.query(
    `
        INSERT INTO public.levels (level_number, level_name, required_points, reward_title, created_at)
        VALUES ${placeholders.join(", ")}
        ON CONFLICT (level_number)
        DO UPDATE SET
          level_name = EXCLUDED.level_name,
          required_points = EXCLUDED.required_points,
          reward_title = EXCLUDED.reward_title
      `,
    values,
  );
  return true;
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function computeXp(snapshot) {
  const reductionPoints =
    snapshot.cigarettesAvoidedTotal * 2 +
    Math.min(snapshot.cigarettesAvoidedToday, 5) * 4 +
    snapshot.smokeFreeHours * 0.75;
  const penaltyPoints =
    snapshot.cigarettesOverBaselineTotal * 2 +
    snapshot.cigarettesOverBaselineToday * 6;

  return Math.max(0, Math.round(reductionPoints - penaltyPoints));
}

function getMetricValue(snapshot, key) {
  switch (key) {
    case "cigarettesAvoidedToday":
      return snapshot.cigarettesAvoidedToday;
    case "cigarettesAvoidedTotal":
      return snapshot.cigarettesAvoidedTotal;
    case "smokeFreeHours":
      return snapshot.smokeFreeHours;
    case "currentLevel":
      return snapshot.currentLevelNumber;
    default:
      return 0;
  }
}

async function unlockDynamicAchievements(userId, snapshot, db) {
  const { rows } = await db.query(
    `
      SELECT id, achievement_key, title, description, icon, xp_reward, level_required, category, tier,
             metric_key, metric_threshold, sort_order, is_final_reward
      FROM public.achievements
      ORDER BY sort_order ASC, id ASC
    `,
  );

  const unlocked = [];
  const qualifyingAchievementIds = [];

  for (const achievement of rows) {
    const metricValue = getMetricValue(snapshot, achievement.metric_key);
    if (metricValue < toNumber(achievement.metric_threshold)) {
      continue;
    }

    qualifyingAchievementIds.push(achievement.id);

    const result = await db.query(
      `
        INSERT INTO public.user_achievements (user_id, achievement_id, unlocked_at)
        SELECT $1, $2, NOW()
        WHERE NOT EXISTS (
          SELECT 1
          FROM public.user_achievements
          WHERE user_id = $1 AND achievement_id = $2
        )
        RETURNING unlocked_at
      `,
      [userId, achievement.id],
    );

    if (result.rows.length) {
      unlocked.push(achievement);
    }
  }

  await db.query(
    `
      DELETE FROM public.user_achievements
      WHERE user_id = $1
        AND achievement_id IN (
          SELECT id
          FROM public.achievements
          WHERE id <> ALL($2::int[])
        )
    `,
    [userId, qualifyingAchievementIds.length ? qualifyingAchievementIds : [0]],
  );

  return unlocked;
}

async function ensureMilestone(userId, milestoneKey, metadata, db) {
  const result = await db.query(
    `
      INSERT INTO public.user_milestones (user_id, milestone_key, metadata, achieved_at)
      SELECT $1, $2, $3::jsonb, NOW()
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.user_milestones
        WHERE user_id = $1 AND milestone_key = $2
      )
      RETURNING id
    `,
    [userId, milestoneKey, JSON.stringify(metadata || {})],
  );

  return result.rows.length > 0;
}

module.exports = {
  achievementDefinitions,
  levelDefinitions,
  ensureAchievementDefinitions,
  ensureLevelDefinitions,
  computeXp,
  unlockDynamicAchievements,
  ensureMilestone,
};
