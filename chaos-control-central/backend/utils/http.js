const createError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const asyncHandler = (handler) => async (req, res, next) => {
  try {
    await handler(req, res, next);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createError,
  asyncHandler,
};
