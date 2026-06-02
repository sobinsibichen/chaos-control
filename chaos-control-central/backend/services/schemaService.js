const pool = require("../config/db");
const fs = require("fs/promises");
const path = require("path");
const { ensureAchievementDefinitions, ensureLevelDefinitions } = require("./achievementEngine");

const premiumUserTables = [
  "smoke_dna",
  "smoke_replay",
  "craving_predictions",
  "voice_commands",
  "scanner_history",
  "ritual_sessions",
  "emergency_sessions",
  "favorite_stores",
  "user_milestones",
  "user_rewards",
  "completion_certificates",
];

async function normalizeUserIdColumn(client, tableName) {
  const columnResult = await client.query(
    `
      SELECT data_type, udt_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1 AND column_name = 'user_id'
    `,
    [tableName],
  );

  const column = columnResult.rows[0];
  if (!column || column.data_type === "bigint" || column.udt_name === "int8") {
    return;
  }

  await client.query(`DELETE FROM public.${tableName}`);

  const constraintResult = await client.query(
    `
      SELECT con.conname
      FROM pg_constraint con
      INNER JOIN pg_class rel ON rel.oid = con.conrelid
      INNER JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
      WHERE
        nsp.nspname = 'public'
        AND rel.relname = $1
        AND con.contype = 'f'
        AND EXISTS (
          SELECT 1
          FROM unnest(con.conkey) AS key_attnum
          INNER JOIN pg_attribute att
            ON att.attrelid = rel.oid
           AND att.attnum = key_attnum
          WHERE att.attname = 'user_id'
        )
    `,
    [tableName],
  );

  const policyResult = await client.query(
    `
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = $1
    `,
    [tableName],
  );

  for (const row of policyResult.rows) {
    await client.query(`DROP POLICY IF EXISTS "${row.policyname}" ON public.${tableName}`);
  }

  await client.query(`ALTER TABLE public.${tableName} DISABLE ROW LEVEL SECURITY`);

  for (const row of constraintResult.rows) {
    await client.query(`ALTER TABLE public.${tableName} DROP CONSTRAINT IF EXISTS "${row.conname}"`);
  }

  await client.query(`
    ALTER TABLE public.${tableName}
    ALTER COLUMN user_id TYPE BIGINT USING NULL
  `);
  await client.query(`
    ALTER TABLE public.${tableName}
    ALTER COLUMN user_id SET NOT NULL
  `);
  await client.query(`
    ALTER TABLE public.${tableName}
    ADD CONSTRAINT ${tableName}_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
  `);
}

async function normalizePremiumFeatureSchema(client) {
  for (const tableName of premiumUserTables) {
    await normalizeUserIdColumn(client, tableName);
  }
}

async function ensureLegacySchema() {
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
      ALTER TABLE public.achievements
      ADD COLUMN IF NOT EXISTS achievement_key VARCHAR(120)
    `);
    await client.query(`
      ALTER TABLE public.achievements
      ADD COLUMN IF NOT EXISTS category VARCHAR(120) DEFAULT 'General'
    `);
    await client.query(`
      ALTER TABLE public.achievements
      ADD COLUMN IF NOT EXISTS tier VARCHAR(80) DEFAULT 'Bronze'
    `);
    await client.query(`
      ALTER TABLE public.achievements
      ADD COLUMN IF NOT EXISTS metric_key VARCHAR(120)
    `);
    await client.query(`
      ALTER TABLE public.achievements
      ADD COLUMN IF NOT EXISTS metric_threshold NUMERIC DEFAULT 0
    `);
    await client.query(`
      ALTER TABLE public.achievements
      ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0
    `);
    await client.query(`
      ALTER TABLE public.achievements
      ADD COLUMN IF NOT EXISTS is_final_reward BOOLEAN DEFAULT FALSE
    `);
    await client.query(`
      UPDATE public.achievements
      SET achievement_key = LOWER(REPLACE(title, ' ', '-'))
      WHERE achievement_key IS NULL
    `);
    await client.query(`
      ALTER TABLE public.achievements
      ALTER COLUMN achievement_key SET NOT NULL
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_achievements_key
      ON public.achievements (achievement_key)
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
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.user_milestones (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
        milestone_key VARCHAR(160) NOT NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        achieved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (user_id, milestone_key)
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.user_rewards (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
        reward_key VARCHAR(120) NOT NULL,
        reward_name VARCHAR(255) NOT NULL,
        reward_type VARCHAR(80) NOT NULL,
        status VARCHAR(40) NOT NULL DEFAULT 'unlocked',
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (user_id, reward_key)
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.completion_certificates (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
        certificate_id VARCHAR(120) NOT NULL,
        verification_code VARCHAR(120) NOT NULL,
        pdf_base64 TEXT NOT NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (certificate_id)
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_smoke_dna_user_created ON public.smoke_dna (user_id, created_at DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cigarette_logs_user_logged ON public.cigarette_logs (user_id, logged_at DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_quit_attempts_user_active_start ON public.quit_attempts (user_id, active, start_date DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_quit_attempts_user_duration ON public.quit_attempts (user_id, smoke_free_seconds, duration_hours)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_blocked_activity_logs_user_blocked ON public.blocked_activity_logs (user_id, blocked_at DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_blocked_apps_user_package ON public.blocked_apps (user_id, package_name)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_block_schedules_user_created ON public.block_schedules (user_id, created_at DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_activity_feed_user_created ON public.activity_feed (user_id, created_at DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_user_achievements_user_achievement ON public.user_achievements (user_id, achievement_id)`);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_levels_number ON public.levels (level_number)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_smoke_replay_user_period ON public.smoke_replay (user_id, replay_period, period_start DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_craving_predictions_user_created ON public.craving_predictions (user_id, created_at DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_voice_commands_user_created ON public.voice_commands (user_id, created_at DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_scanner_history_user_created ON public.scanner_history (user_id, created_at DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_ritual_sessions_user_created ON public.ritual_sessions (user_id, created_at DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_emergency_sessions_user_created ON public.emergency_sessions (user_id, created_at DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_favorite_stores_user_created ON public.favorite_stores (user_id, created_at DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_user_milestones_user_key ON public.user_milestones (user_id, milestone_key)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_user_rewards_user_key ON public.user_rewards (user_id, reward_key)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_completion_certificates_user_created ON public.completion_certificates (user_id, created_at DESC)`);
    await client.query(`
      ALTER TABLE public.user_stats
        ADD COLUMN IF NOT EXISTS weekly_savings NUMERIC DEFAULT 0,
        ADD COLUMN IF NOT EXISTS weekly_cigarettes INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS weekly_avoided INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cigarettes_over_baseline_today INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cigarettes_over_baseline_weekly INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cigarettes_over_baseline_total INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS xp_points INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS level_progress_percent INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS longest_smoke_free_seconds BIGINT DEFAULT 0,
        ADD COLUMN IF NOT EXISTS monthly_cigarettes_json JSONB DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS daily_cigarettes_json JSONB DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS trends_json JSONB DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS roast_worst_day JSONB DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS health_score INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS roast_score INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS analytics_precomputed_at TIMESTAMPTZ
    `);
    await normalizePremiumFeatureSchema(client);
    await ensureAchievementDefinitions(client);
    await ensureLevelDefinitions(client);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function listMigrationFiles() {
  const migrationsDir = path.join(__dirname, "..", "migrations");
  const files = await fs.readdir(migrationsDir);
  return files.filter((file) => /^\d+_.+\.sql$/i.test(file)).sort();
}

async function applyMigration(client, fileName) {
  const migrationId = fileName.replace(/\.sql$/i, "");
  const existing = await client.query("SELECT 1 FROM public.schema_migrations WHERE id = $1", [migrationId]);
  if (existing.rows.length) {
    return false;
  }

  const migrationSql = await fs.readFile(path.join(__dirname, "..", "migrations", fileName), "utf8");
  await client.query("BEGIN");
  try {
    await client.query(migrationSql);
    await client.query("INSERT INTO public.schema_migrations (id) VALUES ($1)", [migrationId]);
    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function runMigrations() {
  const client = await pool.connect();
  let appliedCount = 0;

  try {
    await ensureMigrationsTable(client);
    const files = await listMigrationFiles();
    for (const fileName of files) {
      if (await applyMigration(client, fileName)) {
        appliedCount += 1;
      }
    }
  } finally {
    client.release();
  }

  return appliedCount;
}

async function ensureSchema() {
  const appliedCount = await runMigrations();

  if (appliedCount === 0 && process.env.RUN_SCHEMA_SEEDS !== "true") {
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (process.env.RUN_LEGACY_SCHEMA_NORMALIZATION === "true") {
      await normalizePremiumFeatureSchema(client);
    }
    await ensureAchievementDefinitions(client);
    await ensureLevelDefinitions(client);
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
  ensureLegacySchema,
  runMigrations,
};
