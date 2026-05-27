const pool = require("../config/db");

const achievementSeeds = [
  {
    title: "First Log",
    description: "Logged your first cigarette.",
    icon: "Cigarette",
    xp_reward: 50,
  },
  {
    title: "Quit Try",
    description: "Started at least one quit attempt.",
    icon: "ShieldCheck",
    xp_reward: 100,
  },
  {
    title: "Guardian",
    description: "Blocked at least one bad purchase.",
    icon: "ShoppingBag",
    xp_reward: 120,
  },
  {
    title: "Radar Online",
    description: "Completed a social radar scan.",
    icon: "Radar",
    xp_reward: 90,
  },
  {
    title: "Focus Mode",
    description: "Reached a high focus level.",
    icon: "Brain",
    xp_reward: 140,
  },
  {
    title: "Persistence",
    description: "Logged 25 total cigarettes.",
    icon: "Trophy",
    xp_reward: 180,
  },
  {
    title: "Smoking Gone From My Life",
    description: "Reached level 15 and left smoking behind.",
    icon: "Trophy",
    xp_reward: 500,
  },
];

const levelSeeds = [
  { level_number: 1, level_name: "Starter", required_points: 0, reward_title: "First clean breath" },
  { level_number: 2, level_name: "Survivor", required_points: 10, reward_title: "Momentum unlocked" },
  { level_number: 3, level_name: "Steady", required_points: 20, reward_title: "Discipline mode activated" },
  { level_number: 4, level_name: "Grounded", required_points: 30, reward_title: "Cravings losing power" },
  { level_number: 5, level_name: "Resilient", required_points: 40, reward_title: "Urges handled calmly" },
  { level_number: 6, level_name: "Focused", required_points: 50, reward_title: "Clarity getting louder" },
  { level_number: 7, level_name: "Unlocked", required_points: 60, reward_title: "Identity shifting" },
  { level_number: 8, level_name: "Elevated", required_points: 70, reward_title: "Recovery in motion" },
  { level_number: 9, level_name: "Stable", required_points: 80, reward_title: "Routine feels lighter" },
  { level_number: 10, level_name: "Disciplined", required_points: 90, reward_title: "Ten-day grit secured" },
  { level_number: 11, level_name: "Builder", required_points: 100, reward_title: "New default loading" },
  { level_number: 12, level_name: "Fearless", required_points: 110, reward_title: "Impulse losing access" },
  { level_number: 13, level_name: "Radiant", required_points: 120, reward_title: "Health visibly responding" },
  { level_number: 14, level_name: "Unshaken", required_points: 130, reward_title: "Old habits fading out" },
  { level_number: 15, level_name: "Free", required_points: 140, reward_title: "Smoking gone from my life" },
];

async function ensureAchievements(client) {
  for (const achievement of achievementSeeds) {
    await client.query(
      `
        INSERT INTO public.achievements (title, description, icon, xp_reward, level_required, created_at)
        SELECT $1::varchar, $2::text, $3::varchar, $4::int, $5::int, NOW()
        WHERE NOT EXISTS (
          SELECT 1
          FROM public.achievements
          WHERE title = $6::varchar
        )
      `,
      [achievement.title, achievement.description, achievement.icon, achievement.xp_reward, achievement.title === "Smoking Gone From My Life" ? 15 : 1, achievement.title],
    );
  }
}

async function ensureLevels(client) {
  const { rows } = await client.query("SELECT COUNT(*)::int AS count FROM public.levels");

  if ((rows[0]?.count ?? 0) > 0) {
    return;
  }

  for (const level of levelSeeds) {
    await client.query(
      `
        INSERT INTO public.levels (level_number, level_name, required_points, reward_title, created_at)
        VALUES ($1, $2, $3, $4, NOW())
      `,
      [level.level_number, level.level_name, level.required_points, level.reward_title],
    );
  }
}

async function ensureSchema() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(`
      ALTER TABLE public.users
      ADD COLUMN IF NOT EXISTS cigarette_price NUMERIC DEFAULT 20
    `);
    await client.query(`
      ALTER TABLE public.users
      ADD COLUMN IF NOT EXISTS visibility_enabled BOOLEAN DEFAULT FALSE
    `);
    await client.query(`
      ALTER TABLE public.blocked_apps
      ADD COLUMN IF NOT EXISTS package_name VARCHAR(255)
    `);
    await client.query(`
      UPDATE public.users
      SET cigarette_price = COALESCE(cigarette_price, 20),
          visibility_enabled = COALESCE(visibility_enabled, FALSE)
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.smoke_dna (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
        smoker_type VARCHAR(120) NOT NULL,
        habit_score INTEGER NOT NULL DEFAULT 0,
        smoking_intensity INTEGER NOT NULL DEFAULT 0,
        trigger_patterns JSONB NOT NULL DEFAULT '[]'::jsonb,
        mood_correlation JSONB NOT NULL DEFAULT '{}'::jsonb,
        time_of_day_analysis JSONB NOT NULL DEFAULT '{}'::jsonb,
        heatmap JSONB NOT NULL DEFAULT '[]'::jsonb,
        insights JSONB NOT NULL DEFAULT '[]'::jsonb,
        raw_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.smoke_replay (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
        replay_period VARCHAR(32) NOT NULL,
        replay_key VARCHAR(80) NOT NULL,
        title VARCHAR(255) NOT NULL,
        period_start DATE NOT NULL,
        period_end DATE NOT NULL,
        analytics JSONB NOT NULL DEFAULT '{}'::jsonb,
        highlights JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (user_id, replay_period, replay_key)
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.craving_predictions (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
        prediction_window VARCHAR(32) NOT NULL DEFAULT '30m',
        craving_probability INTEGER NOT NULL DEFAULT 0,
        intensity_score INTEGER NOT NULL DEFAULT 0,
        dangerous_hours JSONB NOT NULL DEFAULT '[]'::jsonb,
        trigger_prediction JSONB NOT NULL DEFAULT '{}'::jsonb,
        insight_text TEXT NOT NULL,
        generated_from JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.voice_commands (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
        command_text TEXT NOT NULL,
        ai_response TEXT NOT NULL,
        command_intent VARCHAR(80) NOT NULL DEFAULT 'general',
        execution_status VARCHAR(40) NOT NULL DEFAULT 'completed',
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.scanner_history (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
        code_value TEXT NOT NULL,
        code_format VARCHAR(40) NOT NULL DEFAULT 'unknown',
        source VARCHAR(80) NOT NULL DEFAULT 'camera',
        brand VARCHAR(160),
        pack_price NUMERIC(10,2),
        nicotine_mg NUMERIC(10,2),
        tar_mg NUMERIC(10,2),
        damage_score INTEGER NOT NULL DEFAULT 0,
        chemicals JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.ritual_sessions (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
        mood VARCHAR(80) NOT NULL DEFAULT 'steady',
        duration_seconds INTEGER NOT NULL DEFAULT 0,
        breath_cycles INTEGER NOT NULL DEFAULT 0,
        ambient_sound BOOLEAN NOT NULL DEFAULT FALSE,
        notes TEXT,
        session_data JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.emergency_sessions (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
        trigger_reason VARCHAR(160) NOT NULL DEFAULT 'urge spike',
        duration_seconds INTEGER NOT NULL DEFAULT 0,
        completed BOOLEAN NOT NULL DEFAULT FALSE,
        breathing_completed BOOLEAN NOT NULL DEFAULT FALSE,
        vibration_used BOOLEAN NOT NULL DEFAULT FALSE,
        motivation_shown JSONB NOT NULL DEFAULT '[]'::jsonb,
        session_data JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.favorite_stores (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
        place_id VARCHAR(255) NOT NULL,
        store_name VARCHAR(255) NOT NULL,
        address TEXT NOT NULL,
        phone_number VARCHAR(40),
        maps_url TEXT,
        rating NUMERIC(3,2),
        is_open BOOLEAN,
        latitude NUMERIC(10,7),
        longitude NUMERIC(10,7),
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (user_id, place_id)
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_smoke_dna_user_created ON public.smoke_dna (user_id, created_at DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_smoke_replay_user_period ON public.smoke_replay (user_id, replay_period, period_start DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_craving_predictions_user_created ON public.craving_predictions (user_id, created_at DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_voice_commands_user_created ON public.voice_commands (user_id, created_at DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_scanner_history_user_created ON public.scanner_history (user_id, created_at DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_ritual_sessions_user_created ON public.ritual_sessions (user_id, created_at DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_emergency_sessions_user_created ON public.emergency_sessions (user_id, created_at DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_favorite_stores_user_created ON public.favorite_stores (user_id, created_at DESC)`);
    await ensureAchievements(client);
    await ensureLevels(client);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  ensureSchema,
};
