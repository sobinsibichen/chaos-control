const jwt = require("jsonwebtoken");
const { isValidUserId } = require("../utils/http");
const { getRequiredEnv } = require("../utils/env");

const authMiddleware = (req, res, next) => {
  const authHeader = req.get("Authorization") || req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.warn("Auth middleware blocked request: missing bearer token", {
      method: req.method,
      path: req.originalUrl,
    });
    return res.status(401).json({
      success: false,
      message: "Authorization token is required.",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, getRequiredEnv("JWT_SECRET"));
    if (!isValidUserId(decoded?.id)) {
      console.warn("Auth middleware blocked request: invalid user id in token", {
        method: req.method,
        path: req.originalUrl,
      });
      return res.status(401).json({
        success: false,
        message: "Your session is out of sync. Please log in again.",
      });
    }
    req.user = decoded;
    return next();
  } catch (error) {
    console.warn("Auth middleware blocked request: invalid or expired token", {
      method: req.method,
      path: req.originalUrl,
      message: error.message,
    });
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token.",
    });
  }
};

module.exports = authMiddleware;
