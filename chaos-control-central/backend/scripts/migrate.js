require("dotenv").config();

const pool = require("../config/db");
const { runMigrations } = require("../services/schemaService");

async function main() {
  const startedAt = process.hrtime.bigint();
  try {
    const appliedCount = await runMigrations();
    const durationMs = Math.round(Number(process.hrtime.bigint() - startedAt) / 1e6);
    console.info("[migrate]", { appliedCount, durationMs });
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("[migrate] failed:", error.message);
  process.exit(1);
});
