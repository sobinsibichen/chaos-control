const { asyncHandler } = require("../utils/http");
const { getRecentActivity } = require("../services/userDataService");

const listRecentActivity = asyncHandler(async (req, res) => {
  const activity = await getRecentActivity(req.user.id, Number(req.query.limit) || 5);

  res.status(200).json({
    success: true,
    activity,
  });
});

module.exports = {
  listRecentActivity,
};
