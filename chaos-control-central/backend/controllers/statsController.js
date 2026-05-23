const { asyncHandler } = require("../utils/http");
const { getDashboardData } = require("../services/userDataService");

const getDashboardStats = asyncHandler(async (req, res) => {
  const data = await getDashboardData(req.user.id);

  res.status(200).json({
    success: true,
    ...data,
  });
});

module.exports = {
  getDashboardStats,
};
