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

app.use(cors());
app.use(express.json());

app.get("/api/test", (req, res) => {
  res.status(200).json({
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

    server.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (error) {
    console.error("Unable to start server:", error.message);
    process.exit(1);
  }
};

startServer();
