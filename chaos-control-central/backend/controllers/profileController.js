const { asyncHandler, createError } = require("../utils/http");
const { getProfileData, updateCigarettePrice, updateSmokingPreferences, getProfileAchievements } = require("../services/userDataService");

const getProfile = asyncHandler(async (req, res) => {
  const profile = await getProfileData(req.user.id);

  res.status(200).json({
    success: true,
    profile,
  });
});

const setCigarettePrice = asyncHandler(async (req, res) => {
  const price = Number(req.body?.cigarettePrice);

  if (!Number.isFinite(price) || price <= 0) {
    throw createError(400, "A valid cigarette price is required.");
  }

  const profile = await updateCigarettePrice(req.user.id, price);

  res.status(200).json({
    success: true,
    profile,
  });
});

const setPreferences = asyncHandler(async (req, res) => {
  const price = Number(req.body?.cigarettePrice);
  const dailySmokingAverage = Number(req.body?.dailySmokingAverage);

  if (!Number.isFinite(price) || price <= 0) {
    throw createError(400, "A valid cigarette price is required.");
  }

  if (!Number.isFinite(dailySmokingAverage) || dailySmokingAverage <= 0) {
    throw createError(400, "A valid daily smoking average is required.");
  }

  const profile = await updateSmokingPreferences(req.user.id, { cigarettePrice: price, dailySmokingAverage });

  res.status(200).json({
    success: true,
    profile,
  });
});

const getAchievements = asyncHandler(async (req, res) => {
  const achievements = await getProfileAchievements(req.user.id);

  res.status(200).json({
    success: true,
    achievements,
  });
});

module.exports = {
  getProfile,
  setCigarettePrice,
  setPreferences,
  getAchievements,
};
