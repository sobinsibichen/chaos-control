const { Pool } = require("pg");
const { AsyncLocalStorage } = require("async_hooks");
require("dotenv").config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not configured.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
  max: Number(process.env.DB_POOL_MAX || 10),
  idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS || 30000),
  connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS || 10000),
  allowExitOnIdle: true,
});

const queryTraceStorage = new AsyncLocalStorage();

function normalizeSql(sql) {
  return String(sql || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220);
}

function logQueryTiming(sql, durationMs, rowCount, error) {
  const trace = queryTraceStorage.getStore();
  if (trace) {
    const normalized = normalizeSql(sql);
    trace.queries.push({
      sql: normalized,
      durationMs: Math.round(durationMs),
      rowCount,
      error: error ? error.message : undefined,
    });
    trace.counts.set(normalized, (trace.counts.get(normalized) || 0) + 1);
  }

  const level = error || durationMs > Number(process.env.DB_SLOW_QUERY_MS || 50) ? "warn" : "info";
  console[level]("[perf:db]", {
    durationMs,
    rowCount,
    slow: durationMs > Number(process.env.DB_SLOW_QUERY_MS || 50),
    sql: normalizeSql(sql),
    error: error ? error.message : undefined,
  });
}

const originalQuery = pool.query.bind(pool);
pool.query = async (...args) => {
  const startedAt = process.hrtime.bigint();
  try {
    const result = await originalQuery(...args);
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    logQueryTiming(args[0]?.text || args[0], Math.round(durationMs), result.rowCount, null);
    return result;
  } catch (error) {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    logQueryTiming(args[0]?.text || args[0], Math.round(durationMs), 0, error);
    throw error;
  }
};

function withDbTrace(callback) {
  return queryTraceStorage.run({ queries: [], counts: new Map() }, callback);
}

function getDbTrace() {
  const trace = queryTraceStorage.getStore();
  if (!trace) {
    return null;
  }

  const duplicates = Array.from(trace.counts.entries())
    .filter(([, count]) => count > 1)
    .map(([sql, count]) => ({ sql, count }));
  const totalDurationMs = trace.queries.reduce((sum, query) => sum + query.durationMs, 0);

  return {
    queryCount: trace.queries.length,
    totalDurationMs,
    duplicates,
    queries: trace.queries,
  };
}

const originalConnect = pool.connect.bind(pool);
pool.connect = async (...args) => {
  if (typeof args[0] === "function") {
    return originalConnect(...args);
  }

  const client = await originalConnect(...args);
  const originalClientQuery = client.query.bind(client);
  client.query = async (...queryArgs) => {
    if (typeof queryArgs[queryArgs.length - 1] === "function") {
      return originalClientQuery(...queryArgs);
    }

    const startedAt = process.hrtime.bigint();
    try {
      const result = await originalClientQuery(...queryArgs);
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
      logQueryTiming(queryArgs[0]?.text || queryArgs[0], Math.round(durationMs), result.rowCount, null);
      return result;
    } catch (error) {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
      logQueryTiming(queryArgs[0]?.text || queryArgs[0], Math.round(durationMs), 0, error);
      throw error;
    }
  };
  return client;
};

pool.connect((err, client, release) => {
  if (err) {
    console.error("Database connection failed:", err.message);
    return;
  }

  console.log("Supabase PostgreSQL connected successfully");
  release();
});

module.exports = pool;
module.exports.withDbTrace = withDbTrace;
module.exports.getDbTrace = getDbTrace;
