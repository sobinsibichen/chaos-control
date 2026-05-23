const express = require("express");
const { getDashboardStats } = require("../controllers/statsController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/dashboard", authMiddleware, getDashboardStats);

module.exports = router;
