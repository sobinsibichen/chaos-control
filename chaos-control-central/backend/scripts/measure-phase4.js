const { spawn } = require("child_process");
const http = require("http");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");

const PORT = Number(process.env.PERF_PORT || 5055);
const BASE_URL = `http://127.0.0.1:${PORT}`;

function request(path, token) {
  const startedAt = process.hrtime.bigint();
  return new Promise((resolve) => {
    const req = http.request(
      `${BASE_URL}${path}`,
      {
        method: "GET",
        headers: token
          ? {
              Authorization: `Bearer ${token}`,
              "Accept-Encoding": "gzip",
            }
          : { "Accept-Encoding": "gzip" },
      },
      (res) => {
        let bytes = 0;
        res.on("data", (chunk) => {
          bytes += chunk.length;
        });
        res.on("end", () => {
          resolve({
            path,
            status: res.statusCode,
            durationMs: Math.round(Number(process.hrtime.bigint() - startedAt) / 1e6),
            bytes,
            encoding: res.headers["content-encoding"] || "identity",
          });
        });
      },
    );

    req.on("error", (error) => {
      resolve({
        path,
        status: 0,
        durationMs: Math.round(Number(process.hrtime.bigint() - startedAt) / 1e6),
        bytes: 0,
        error: error.message,
      });
    });
    req.end();
  });
}

async function waitForServer() {
  const startedAt = process.hrtime.bigint();
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const result = await request("/api/test");
    if (result.status === 200) {
      return Math.round(Number(process.hrtime.bigint() - startedAt) / 1e6);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Server did not become available in time.");
}

async function getToken() {
  const result = await pool.query("SELECT id FROM public.users ORDER BY id ASC LIMIT 1");
  const userId = result.rows[0]?.id;
  if (!userId) {
    throw new Error("No users exist for authenticated API measurement.");
  }
  return jwt.sign({ id: userId }, process.env.JWT_SECRET || "lastpuffsecret", { expiresIn: "5m" });
}

async function main() {
  const server = spawn(process.execPath, ["server.js"], {
    cwd: __dirname + "/..",
    env: { ...process.env, PORT: String(PORT), API_SLOW_RESPONSE_MS: "0", DB_SLOW_QUERY_MS: "0" },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let logs = "";
  server.stdout.on("data", (chunk) => {
    logs += chunk.toString();
  });
  server.stderr.on("data", (chunk) => {
    logs += chunk.toString();
  });

  try {
    const startupAvailableMs = await waitForServer();
    const token = await getToken();
    const endpoints = [
      ["/api/stats/dashboard", "Dashboard API"],
      ["/api/apps", "Control Apps API"],
      ["/api/analytics/roast", "Roast API"],
      ["/api/analytics/highlights", "Insights API"],
    ];

    const warmups = await Promise.all(endpoints.map(([path]) => request(path, token)));
    const measured = [];
    for (const [path, label] of endpoints) {
      const runs = [];
      for (let index = 0; index < 3; index += 1) {
        runs.push(await request(path, token));
      }
      runs.sort((left, right) => left.durationMs - right.durationMs);
      measured.push({ label, ...runs[1] });
    }

    const backgroundMatch = logs.match(/\[perf:startup:background\]\s+\{\s+durationMs:\s+(\d+)/);
    const apiTraceLines = logs
      .split(/\r?\n/)
      .filter((line) => line.includes("[perf:api]"))
      .slice(-20);
    const apiTraces = apiTraceLines.map((line) => {
      const jsonStart = line.indexOf("{");
      if (jsonStart === -1) {
        return { raw: line };
      }
      try {
        return JSON.parse(line.slice(jsonStart));
      } catch {
        return { raw: line };
      }
    });

    console.log(JSON.stringify({
      startupAvailableMs,
      backgroundStartupMs: backgroundMatch ? Number(backgroundMatch[1]) : null,
      warmups,
      measured,
      apiTraces,
      memoryUsage: process.memoryUsage(),
    }, null, 2));
  } finally {
    server.kill();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
