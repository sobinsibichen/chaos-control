const express = require("express");
const { listRecentActivity } = require("../controllers/activityController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/recent", authMiddleware, listRecentActivity);

module.exports = router;
