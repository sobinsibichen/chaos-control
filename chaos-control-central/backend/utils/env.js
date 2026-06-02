function getRequiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is not configured.`);
  }

  return value;
}

function getOptionalEnv(name, fallback = "") {
  const value = process.env[name];
  return value == null || value === "" ? fallback : value;
}

function getBooleanEnv(name, fallback = false) {
  const value = process.env[name];
  if (value == null || value === "") {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function requireProductionEnv(names) {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  for (const name of names) {
    getRequiredEnv(name);
  }
}

module.exports = {
  getBooleanEnv,
  getOptionalEnv,
  getRequiredEnv,
  requireProductionEnv,
};
