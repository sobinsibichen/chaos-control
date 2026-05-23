const { asyncHandler } = require("../utils/http");
const { logCigarette, startQuitAttempt } = require("../services/userDataService");

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

module.exports = {
  createCigaretteLog,
  createQuitAttempt,
};
