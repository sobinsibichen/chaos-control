const express = require("express");
const { createCigaretteLog, createQuitAttempt } = require("../controllers/cigaretteController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/log", authMiddleware, createCigaretteLog);
router.post("/quit", authMiddleware, createQuitAttempt);

module.exports = router;
