const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const {
  getApps,
  addApp,
  saveAppSelection,
  toggleApp,
  removeApp,
  saveSchedule,
  createVerification,
} = require("../controllers/appsController");

const router = express.Router();

router.get("/", authMiddleware, getApps);
router.post("/add", authMiddleware, addApp);
router.post("/save-selection", authMiddleware, saveAppSelection);
router.put("/toggle", authMiddleware, toggleApp);
router.delete("/delete", authMiddleware, removeApp);
router.post("/schedule", authMiddleware, saveSchedule);
router.post("/verify", authMiddleware, createVerification);

module.exports = router;
