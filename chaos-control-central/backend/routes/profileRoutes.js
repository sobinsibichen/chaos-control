const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { getProfile, setCigarettePrice, setPreferences, getAchievements } = require("../controllers/profileController");

const router = express.Router();

router.get("/", authMiddleware, getProfile);
router.put("/cigarette-price", authMiddleware, setCigarettePrice);
router.put("/preferences", authMiddleware, setPreferences);
router.get("/achievements", authMiddleware, getAchievements);

module.exports = router;
