const { createError } = require("../utils/http");

const validateRequest = (validator) => (req, res, next) => {
  try {
    const result = validator(req);

    if (result && typeof result === "object") {
      if (result.body) {
        req.body = result.body;
      }
      if (result.params) {
        req.params = result.params;
      }
      if (result.query) {
        req.query = result.query;
      }
    }

    next();
  } catch (error) {
    next(error.status ? error : createError(400, error.message || "Invalid request payload."));
  }
};

module.exports = validateRequest;
