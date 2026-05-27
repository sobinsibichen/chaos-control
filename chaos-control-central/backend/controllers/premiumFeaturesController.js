const { asyncHandler } = require("../utils/http");
const {
  createSmokeDnaRecord,
  listSmokeDnaRecords,
  updateSmokeDnaRecord,
  deleteSmokeDnaRecord,
  upsertSmokeReplayRecord,
  listSmokeReplayRecords,
  createCravingPredictionRecord,
  listCravingPredictionRecords,
  getLiveCravingPrediction,
  createVoiceCommandRecord,
  listVoiceCommandRecords,
  createScannerHistoryRecord,
  listScannerHistoryRecords,
  createRitualSessionRecord,
  listRitualSessionRecords,
  createEmergencySessionRecord,
  listEmergencySessionRecords,
  upsertFavoriteStoreRecord,
  listFavoriteStoreRecords,
  deleteFavoriteStoreRecord,
} = require("../services/premiumFeatureService");

const sendSuccess = (res, status, data, message) => {
  res.status(status).json({
    success: true,
    data,
    message,
  });
};

const createSmokeDna = asyncHandler(async (req, res) => {
  const data = await createSmokeDnaRecord(req.user.id, req.body || {});
  sendSuccess(res, 201, data, "Smoke DNA saved successfully.");
});

const listSmokeDna = asyncHandler(async (req, res) => {
  const data = await listSmokeDnaRecords(req.user.id, req.query);
  sendSuccess(res, 200, data, "Smoke DNA records fetched successfully.");
});

const updateSmokeDna = asyncHandler(async (req, res) => {
  const data = await updateSmokeDnaRecord(req.user.id, req.params.id, req.body || {});
  sendSuccess(res, 200, data, "Smoke DNA updated successfully.");
});

const removeSmokeDna = asyncHandler(async (req, res) => {
  const data = await deleteSmokeDnaRecord(req.user.id, req.params.id);
  sendSuccess(res, 200, data, "Smoke DNA deleted successfully.");
});

const createSmokeReplay = asyncHandler(async (req, res) => {
  const data = await upsertSmokeReplayRecord(req.user.id, req.body || {});
  sendSuccess(res, 201, data, "Smoke replay generated successfully.");
});

const listSmokeReplay = asyncHandler(async (req, res) => {
  const data = await listSmokeReplayRecords(req.user.id, req.query);
  sendSuccess(res, 200, data, "Smoke replay records fetched successfully.");
});

const getMonthlySmokeReplay = asyncHandler(async (req, res) => {
  const data = await upsertSmokeReplayRecord(req.user.id, {
    replayPeriod: "monthly",
    year: req.query.year,
    month: req.query.month,
  });
  sendSuccess(res, 200, data, "Monthly smoke replay generated successfully.");
});

const getYearlySmokeReplay = asyncHandler(async (req, res) => {
  const data = await upsertSmokeReplayRecord(req.user.id, {
    replayPeriod: "yearly",
    year: req.query.year,
  });
  sendSuccess(res, 200, data, "Yearly smoke replay generated successfully.");
});

const createCravingPrediction = asyncHandler(async (req, res) => {
  const data = await createCravingPredictionRecord(req.user.id, req.body || {});
  sendSuccess(res, 201, data, "Craving prediction created successfully.");
});

const listCravingPredictions = asyncHandler(async (req, res) => {
  const data = await listCravingPredictionRecords(req.user.id, req.query);
  sendSuccess(res, 200, data, "Craving predictions fetched successfully.");
});

const getLiveCraving = asyncHandler(async (req, res) => {
  const data = await getLiveCravingPrediction(req.user.id);
  sendSuccess(res, 200, data, "Live craving prediction generated successfully.");
});

const createVoiceCommand = asyncHandler(async (req, res) => {
  const data = await createVoiceCommandRecord(req.user.id, req.body || {});
  sendSuccess(res, 201, data, "Voice command saved successfully.");
});

const listVoiceCommands = asyncHandler(async (req, res) => {
  const data = await listVoiceCommandRecords(req.user.id, req.query);
  sendSuccess(res, 200, data, "Voice command history fetched successfully.");
});

const createScannerHistory = asyncHandler(async (req, res) => {
  const data = await createScannerHistoryRecord(req.user.id, req.body || {});
  sendSuccess(res, 201, data, "Scanner history saved successfully.");
});

const listScannerHistory = asyncHandler(async (req, res) => {
  const data = await listScannerHistoryRecords(req.user.id, req.query);
  sendSuccess(res, 200, data, "Scanner history fetched successfully.");
});

const createRitualSession = asyncHandler(async (req, res) => {
  const data = await createRitualSessionRecord(req.user.id, req.body || {});
  sendSuccess(res, 201, data, "Ritual session saved successfully.");
});

const listRitualSessions = asyncHandler(async (req, res) => {
  const data = await listRitualSessionRecords(req.user.id, req.query);
  sendSuccess(res, 200, data, "Ritual sessions fetched successfully.");
});

const createEmergencySession = asyncHandler(async (req, res) => {
  const data = await createEmergencySessionRecord(req.user.id, req.body || {});
  sendSuccess(res, 201, data, "Emergency session saved successfully.");
});

const listEmergencySessions = asyncHandler(async (req, res) => {
  const data = await listEmergencySessionRecords(req.user.id, req.query);
  sendSuccess(res, 200, data, "Emergency sessions fetched successfully.");
});

const createFavoriteStore = asyncHandler(async (req, res) => {
  const data = await upsertFavoriteStoreRecord(req.user.id, req.body || {});
  sendSuccess(res, 201, data, "Favorite store saved successfully.");
});

const listFavoriteStores = asyncHandler(async (req, res) => {
  const data = await listFavoriteStoreRecords(req.user.id, req.query);
  sendSuccess(res, 200, data, "Favorite stores fetched successfully.");
});

const removeFavoriteStore = asyncHandler(async (req, res) => {
  const data = await deleteFavoriteStoreRecord(req.user.id, req.params.id);
  sendSuccess(res, 200, data, "Favorite store removed successfully.");
});

module.exports = {
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
};
