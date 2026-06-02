require("dotenv").config();

const express = require("express");
const cors = require("cors");
const http = require("http");
const zlib = require("zlib");
const pool = require("./config/db");
const { getDbTrace, withDbTrace } = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const statsRoutes = require("./routes/statsRoutes");
const cigaretteRoutes = require("./routes/cigaretteRoutes");
const activityRoutes = require("./routes/activityRoutes");
const appsRoutes = require("./routes/appsRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const socialRoutes = require("./routes/socialRoutes");
const profileRoutes = require("./routes/profileRoutes");
const premiumFeaturesRoutes = require("./routes/premiumFeaturesRoutes");
const { listNearbyUsers, saveLocation } = require("./controllers/socialController");
const authMiddleware = require("./middleware/authMiddleware");
const { ensureSchema } = require("./services/schemaService");
const { initializeRealtime } = require("./socket/realtime");
const { normalizeDatabaseError } = require("./utils/http");
const { getBooleanEnv, getRequiredEnv, requireProductionEnv } = require("./utils/env");

const app = express();
const port = process.env.PORT || 5000;
const server = http.createServer(app);
const defaultAllowedOrigins = [
  "https://chaos-control-api.onrender.com",
  "https://chaos-control-central.onrender.com",
  "https://last-puff.onrender.com",
  "https://last-puff-mobile.onrender.com",
  "http://localhost:3000",
  "http://localhost:4173",
  "http://localhost:5000",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:4173",
  "http://127.0.0.1:5000",
  "http://127.0.0.1:5173",
  "capacitor://localhost",
  "ionic://localhost",
];
const allowedOrigins = [...defaultAllowedOrigins, ...(process.env.CORS_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean)];

function isAllowedOrigin(origin) {
  if (!origin) {
    return true;
  }

  if (allowedOrigins.includes(origin)) {
    return true;
  }

  try {
    const { hostname, protocol } = new URL(origin);
    return (
      ["http:", "https:", "capacitor:", "ionic:"].includes(protocol) &&
      (hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".onrender.com"))
    );
  } catch {
    return false;
  }
}

const corsOptions = {
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin ${origin} is not allowed by CORS.`));
  },
  credentials: true,
  methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Authorization", "Content-Type"],
  maxAge: 86400,
};

app.set("trust proxy", 1);
app.use(cors(corsOptions));
app.use((req, res, next) => {
  withDbTrace(() => next());
});
app.use((req, res, next) => {
  const startedAt = process.hrtime.bigint();
  res.on("finish", () => {
    const durationMs = Math.round(Number(process.hrtime.bigint() - startedAt) / 1e6);
    const bytes = Number(res.getHeader("Content-Length") || 0);
    const level = durationMs > Number(process.env.API_SLOW_RESPONSE_MS || 250) ? "warn" : "info";
    const dbTrace = getDbTrace();
    console[level]("[perf:api]", JSON.stringify({
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs,
      bytes,
      dbQueryCount: dbTrace?.queryCount || 0,
      dbDurationMs: dbTrace?.totalDurationMs || 0,
      duplicateDbQueries: dbTrace?.duplicates || [],
      slow: durationMs > Number(process.env.API_SLOW_RESPONSE_MS || 250),
    }));
  });
  next();
});
app.use((req, res, next) => {
  const send = res.send.bind(res);
  res.send = (body) => {
    const acceptEncoding = req.headers["accept-encoding"] || "";
    const payload = Buffer.isBuffer(body) ? body : Buffer.from(String(body ?? ""), "utf8");

    if (
      req.method === "HEAD" ||
      res.getHeader("Content-Encoding") ||
      payload.length < 1024 ||
      !/application\/json|text\//i.test(String(res.getHeader("Content-Type") || "application/json"))
    ) {
      return send(body);
    }

    if (/\bbr\b/.test(acceptEncoding)) {
      res.setHeader("Content-Encoding", "br");
      res.setHeader("Vary", "Accept-Encoding");
      return send(zlib.brotliCompressSync(payload));
    }

    if (/\bgzip\b/.test(acceptEncoding)) {
      res.setHeader("Content-Encoding", "gzip");
      res.setHeader("Vary", "Accept-Encoding");
      return send(zlib.gzipSync(payload));
    }

    return send(body);
  };
  next();
});
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", async (req, res, next) => {
  try {
    const result = await pool.query("SELECT NOW()");

    res.status(200).json({
      success: true,
      message: "Backend connected successfully",
      databaseTime: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/test", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Backend working",
  });
});

app.get("/api/health", async (req, res, next) => {
  try {
    const result = await pool.query("SELECT NOW() AS database_time");

    res.status(200).json({
      success: true,
      status: "healthy",
      uptimeSeconds: Math.round(process.uptime()),
      databaseTime: result.rows[0].database_time,
    });
  } catch (error) {
    next(error);
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/cigarettes", cigaretteRoutes);
app.use("/api/activity", activityRoutes);
app.use("/api/apps", appsRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/social", socialRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api", premiumFeaturesRoutes);
app.get("/api/nearby-users", authMiddleware, listNearbyUsers);
app.post("/api/users/location", authMiddleware, saveLocation);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found.",
  });
});

app.use((error, req, res, next) => {
  const normalized = normalizeDatabaseError(error);
  console.error(normalized);

  res.status(normalized.status || 500).json({
    success: false,
    message: normalized.status ? normalized.message : "Internal server error.",
  });
});

const startServer = async () => {
  try {
    getRequiredEnv("JWT_SECRET");
    requireProductionEnv(["DATABASE_URL", "JWT_SECRET"]);
    initializeRealtime(server);

    server.once("error", (error) => {
      if (error && error.code === "EADDRINUSE") {
        console.error(`Port ${port} is already in use. Another backend instance is probably already running.`);
        console.error(`If the app is already working, keep using it. Otherwise stop the old process and start again.`);
        process.exit(1);
      }

      console.error("Unable to start server:", error.message);
      process.exit(1);
    });

    server.listen(port, () => {
      console.log(`Server running on port ${port}`);
      console.log(`Health check available at /api/health`);
      const backgroundInitDelayMs = Number(process.env.BACKGROUND_INIT_DELAY_MS || 5000);
      setTimeout(async () => {
        const startedAt = process.hrtime.bigint();
        try {
          if (getBooleanEnv("RUN_STARTUP_MIGRATIONS", true)) {
            await ensureSchema();
          }
          await pool.query("SELECT 1");
          console.info("[perf:startup:background]", {
            durationMs: Math.round(Number(process.hrtime.bigint() - startedAt) / 1e6),
            status: "ready",
          });
        } catch (error) {
          console.error("Background initialization failed:", error.message);
        }
      }, backgroundInitDelayMs).unref?.();
    });
  } catch (error) {
    console.error("Unable to start server:", error.message);
    process.exit(1);
  }
};

const shutdown = async (signal) => {
  console.log(`${signal} received. Shutting down gracefully...`);

  server.close(async () => {
    try {
      await pool.end();
      process.exit(0);
    } catch (error) {
      console.error("Error during shutdown:", error.message);
      process.exit(1);
    }
  });
};

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

startServer();
