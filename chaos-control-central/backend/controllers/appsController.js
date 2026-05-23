const { asyncHandler, createError } = require("../utils/http");
const {
  getAppsData,
  addBlockedApp,
  saveBlockedAppsSelection,
  toggleBlockedApp,
  deleteBlockedApp,
  saveBlockSchedule,
  saveVerificationAttempt,
} = require("../services/userDataService");

const getApps = asyncHandler(async (req, res) => {
  const data = await getAppsData(req.user.id);

  res.status(200).json({
    success: true,
    ...data,
  });
});

const addApp = asyncHandler(async (req, res) => {
  const app = await addBlockedApp(req.user.id, req.body || {});

  res.status(201).json({
    success: true,
    app,
  });
});

const saveAppSelection = asyncHandler(async (req, res) => {
  const data = await saveBlockedAppsSelection(req.user.id, req.body || {});

  res.status(200).json({
    success: true,
    ...data,
  });
});

const toggleApp = asyncHandler(async (req, res) => {
  const app = await toggleBlockedApp(req.user.id, req.body || {});

  if (!app) {
    throw createError(404, "Blocked app not found.");
  }

  res.status(200).json({
    success: true,
    app,
  });
});

const removeApp = asyncHandler(async (req, res) => {
  const app = await deleteBlockedApp(req.user.id, Number(req.body?.id));

  if (!app) {
    throw createError(404, "Blocked app not found.");
  }

  res.status(200).json({
    success: true,
    app,
  });
});

const saveSchedule = asyncHandler(async (req, res) => {
  const schedule = await saveBlockSchedule(req.user.id, req.body || {});

  res.status(201).json({
    success: true,
    schedule,
  });
});

const createVerification = asyncHandler(async (req, res) => {
  const verification = await saveVerificationAttempt(req.user.id, req.body || {});

  res.status(201).json({
    success: true,
    verification,
  });
});

module.exports = {
  getApps,
  addApp,
  saveAppSelection,
  toggleApp,
  removeApp,
  saveSchedule,
  createVerification,
};
