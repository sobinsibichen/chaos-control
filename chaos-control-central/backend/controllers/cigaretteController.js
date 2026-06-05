const { asyncHandler } = require("../utils/http");
const { logCigarette, listCigaretteHistory, startQuitAttempt } = require("../services/userDataService");

const createCigaretteLog = asyncHandler(async (req, res) => {
  const data = await logCigarette(req.user.id, req.body || {});

  res.status(201).json({
    success: true,
    ...data,
  });
});

const createQuitAttempt = asyncHandler(async (req, res) => {
  const data = await startQuitAttempt(req.user.id);

  res.status(201).json({
    success: true,
    ...data,
  });
});

const listCigaretteLogs = asyncHandler(async (req, res) => {
  const logs = await listCigaretteHistory(req.user.id, Number(req.query.limit) || 2000);

  res.status(200).json({
    success: true,
    logs,
  });
});

module.exports = {
  createCigaretteLog,
  listCigaretteLogs,
  createQuitAttempt,
};
