const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { listNearbyUsers, setVisibility, radarScan, saveLocation } = require("../controllers/socialController");

const router = express.Router();

router.get("/nearby", authMiddleware, listNearbyUsers);
router.post("/visibility", authMiddleware, setVisibility);
router.post("/location", authMiddleware, saveLocation);
router.post("/radar-scan", authMiddleware, radarScan);

module.exports = router;
