require("dotenv").config();

const express = require("express");
const cors = require("cors");
const http = require("http");
const pool = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const statsRoutes = require("./routes/statsRoutes");
const cigaretteRoutes = require("./routes/cigaretteRoutes");
const activityRoutes = require("./routes/activityRoutes");
const appsRoutes = require("./routes/appsRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const socialRoutes = require("./routes/socialRoutes");
const profileRoutes = require("./routes/profileRoutes");
const { listNearbyUsers, saveLocation } = require("./controllers/socialController");
const authMiddleware = require("./middleware/authMiddleware");
const { ensureSchema } = require("./services/schemaService");
const { initializeRealtime } = require("./socket/realtime");

const app = express();
const port = process.env.PORT || 5000;
const server = http.createServer(app);

app.set("trust proxy", 1);
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || true,
    credentials: true,
  }),
);
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

app.use("/api/auth", authRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/cigarettes", cigaretteRoutes);
app.use("/api/activity", activityRoutes);
app.use("/api/apps", appsRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/social", socialRoutes);
app.use("/api/profile", profileRoutes);
app.get("/api/nearby-users", authMiddleware, listNearbyUsers);
app.post("/api/users/location", authMiddleware, saveLocation);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found.",
  });
});

app.use((error, req, res, next) => {
  console.error(error);

  res.status(error.status || 500).json({
    success: false,
    message: error.message || "Internal server error.",
  });
});

const startServer = async () => {
  try {
    await ensureSchema();
    await pool.query("SELECT 1");

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
