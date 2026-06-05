const express = require("express");
const { createCigaretteLog, createQuitAttempt, listCigaretteLogs } = require("../controllers/cigaretteController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/history", authMiddleware, listCigaretteLogs);
router.post("/log", authMiddleware, createCigaretteLog);
router.post("/quit", authMiddleware, createQuitAttempt);

module.exports = router;
