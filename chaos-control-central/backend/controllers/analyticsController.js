const { asyncHandler } = require("../utils/http");
const { getRoastAnalytics, getRoastHighlights } = require("../services/userDataService");

const roastAnalytics = asyncHandler(async (req, res) => {
  const analytics = await getRoastAnalytics(req.user.id);

  res.status(200).json({
    success: true,
    analytics,
  });
});

const roastHighlights = asyncHandler(async (req, res) => {
  const highlights = await getRoastHighlights(req.user.id);

  res.status(200).json({
    success: true,
    highlights,
  });
});

module.exports = {
  roastAnalytics,
  roastHighlights,
};
