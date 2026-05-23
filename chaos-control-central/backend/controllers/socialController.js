const { asyncHandler } = require("../utils/http");
const { getNearbyUsers, updateVisibility, runRadarScan, updateUserLocation } = require("../services/userDataService");

const listNearbyUsers = asyncHandler(async (req, res) => {
  const users = await getNearbyUsers(req.user.id);

  res.status(200).json({
    success: true,
    users,
  });
});

const setVisibility = asyncHandler(async (req, res) => {
  const result = await updateVisibility(req.user.id, Boolean(req.body?.enabled));

  res.status(200).json({
    success: true,
    ...result,
  });
});

const radarScan = asyncHandler(async (req, res) => {
  const users = await runRadarScan(req.user.id);

  res.status(200).json({
    success: true,
    users,
  });
});

const saveLocation = asyncHandler(async (req, res) => {
  const result = await updateUserLocation(req.user.id, req.body || {});

  res.status(200).json({
    success: true,
    ...result,
  });
});

module.exports = {
  listNearbyUsers,
  setVisibility,
  radarScan,
  saveLocation,
};
