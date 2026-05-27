const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const validateRequest = require("../middleware/validateRequest");
const {
  validatePaginationQuery,
  validateNumericIdParam,
  validateSmokeDnaBody,
  validateReplayBody,
  validateReplayQuery,
  validateCravingPredictionBody,
  validateVoiceCommandBody,
  validateScannerHistoryBody,
  validateRitualSessionBody,
  validateEmergencySessionBody,
  validateFavoriteStoreBody,
} = require("../validation/premiumFeatureValidation");
const {
  createSmokeDna,
  listSmokeDna,
  updateSmokeDna,
  removeSmokeDna,
  createSmokeReplay,
  listSmokeReplay,
  getMonthlySmokeReplay,
  getYearlySmokeReplay,
  createCravingPrediction,
  listCravingPredictions,
  getLiveCraving,
  createVoiceCommand,
  listVoiceCommands,
  createScannerHistory,
  listScannerHistory,
  createRitualSession,
  listRitualSessions,
  createEmergencySession,
  listEmergencySessions,
  createFavoriteStore,
  listFavoriteStores,
  removeFavoriteStore,
} = require("../controllers/premiumFeaturesController");

const router = express.Router();

router.post("/smoke-dna", authMiddleware, validateRequest(validateSmokeDnaBody), createSmokeDna);
router.get("/smoke-dna", authMiddleware, validateRequest(validatePaginationQuery), listSmokeDna);
router.put("/smoke-dna/:id", authMiddleware, validateRequest(validateNumericIdParam), validateRequest(validateSmokeDnaBody), updateSmokeDna);
router.delete("/smoke-dna/:id", authMiddleware, validateRequest(validateNumericIdParam), removeSmokeDna);

router.post("/smoke-replay", authMiddleware, validateRequest(validateReplayBody), createSmokeReplay);
router.get("/smoke-replay", authMiddleware, validateRequest(validatePaginationQuery), listSmokeReplay);
router.get("/smoke-replay/monthly", authMiddleware, validateRequest(validateReplayQuery), getMonthlySmokeReplay);
router.get("/smoke-replay/yearly", authMiddleware, validateRequest(validateReplayQuery), getYearlySmokeReplay);

router.post("/craving-predictions", authMiddleware, validateRequest(validateCravingPredictionBody), createCravingPrediction);
router.get("/craving-predictions", authMiddleware, validateRequest(validatePaginationQuery), listCravingPredictions);
router.get("/craving-predictions/live", authMiddleware, getLiveCraving);

router.post("/voice-commands", authMiddleware, validateRequest(validateVoiceCommandBody), createVoiceCommand);
router.get("/voice-commands", authMiddleware, validateRequest(validatePaginationQuery), listVoiceCommands);

router.post("/scanner-history", authMiddleware, validateRequest(validateScannerHistoryBody), createScannerHistory);
router.get("/scanner-history", authMiddleware, validateRequest(validatePaginationQuery), listScannerHistory);

router.post("/ritual-sessions", authMiddleware, validateRequest(validateRitualSessionBody), createRitualSession);
router.get("/ritual-sessions", authMiddleware, validateRequest(validatePaginationQuery), listRitualSessions);

router.post("/emergency-sessions", authMiddleware, validateRequest(validateEmergencySessionBody), createEmergencySession);
router.get("/emergency-sessions", authMiddleware, validateRequest(validatePaginationQuery), listEmergencySessions);

router.post("/favorite-stores", authMiddleware, validateRequest(validateFavoriteStoreBody), createFavoriteStore);
router.get("/favorite-stores", authMiddleware, validateRequest(validatePaginationQuery), listFavoriteStores);
router.delete("/favorite-stores/:id", authMiddleware, validateRequest(validateNumericIdParam), removeFavoriteStore);

module.exports = router;
