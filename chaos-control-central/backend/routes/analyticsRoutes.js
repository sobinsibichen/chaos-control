const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { roastAnalytics, roastHighlights } = require("../controllers/analyticsController");

const router = express.Router();

router.get("/roast", authMiddleware, roastAnalytics);
router.get("/highlights", authMiddleware, roastHighlights);

module.exports = router;
