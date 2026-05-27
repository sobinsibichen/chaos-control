const createError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeDatabaseError(error) {
  const message = error?.message || "Internal server error.";

  if (/invalid input syntax for type uuid/i.test(message)) {
    return createError(401, "Your session is out of sync. Please log in again.");
  }

  if (/invalid input syntax for type bigint|invalid input syntax for type integer/i.test(message)) {
    return createError(400, "A request identifier was invalid.");
  }

  return error;
}

function isValidUserId(value) {
  if (typeof value === "number") {
    return Number.isInteger(value) && value > 0;
  }

  if (typeof value !== "string") {
    return false;
  }

  const trimmed = value.trim();
  return /^\d+$/.test(trimmed) || UUID_PATTERN.test(trimmed);
}

const asyncHandler = (handler) => async (req, res, next) => {
  try {
    await handler(req, res, next);
  } catch (error) {
    next(normalizeDatabaseError(error));
  }
};

module.exports = {
  createError,
  asyncHandler,
  isValidUserId,
  normalizeDatabaseError,
};
