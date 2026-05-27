const { createError } = require("../utils/http");

const MAX_LIMIT = 100;

function toPositiveInt(value, fallback = 1) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function asTrimmedString(value, fieldName, { required = false, max = 500 } = {}) {
  const next = typeof value === "string" ? value.trim() : "";
  if (required && !next) {
    throw createError(400, `${fieldName} is required.`);
  }
  if (next.length > max) {
    throw createError(400, `${fieldName} is too long.`);
  }
  return next;
}

function asNullableString(value, fieldName, options = {}) {
  const next = asTrimmedString(value, fieldName, options);
  return next || null;
}

function asBoolean(value, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return fallback;
}

function asNumber(value, fieldName, { min = 0, max = 1000000, fallback = null } = {}) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw createError(400, `${fieldName} must be a valid number.`);
  }
  return parsed;
}

function asInteger(value, fieldName, { min = 0, max = 1000000, fallback = null } = {}) {
  const parsed = asNumber(value, fieldName, { min, max, fallback });
  if (parsed === null) {
    return null;
  }
  return Math.round(parsed);
}

function asJsonArray(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function asJsonObject(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : fallback;
}

function validatePaginationQuery(req) {
  const page = toPositiveInt(req.query.page, 1);
  const limit = Math.min(toPositiveInt(req.query.limit, 20), MAX_LIMIT);
  return {
    query: {
      page,
      limit,
      offset: (page - 1) * limit,
    },
  };
}

function validateNumericIdParam(req) {
  const id = toPositiveInt(req.params.id, 0);
  if (!id) {
    throw createError(400, "A valid id is required.");
  }
  return { params: { id } };
}

function validateSmokeDnaBody(req) {
  return {
    body: {
      smokerType: asNullableString(req.body.smokerType, "smokerType", { max: 120 }),
      habitScore: asInteger(req.body.habitScore, "habitScore", { min: 0, max: 100, fallback: null }),
      smokingIntensity: asInteger(req.body.smokingIntensity, "smokingIntensity", { min: 0, max: 100, fallback: null }),
      triggerPatterns: asJsonArray(req.body.triggerPatterns, []),
      moodCorrelation: asJsonObject(req.body.moodCorrelation, {}),
      timeOfDayAnalysis: asJsonObject(req.body.timeOfDayAnalysis, {}),
      heatmap: asJsonArray(req.body.heatmap, []),
      insights: asJsonArray(req.body.insights, []),
      rawMetrics: asJsonObject(req.body.rawMetrics, {}),
    },
  };
}

function validateReplayBody(req) {
  const replayPeriod = asTrimmedString(req.body.replayPeriod || "monthly", "replayPeriod", { required: true, max: 32 }).toLowerCase();
  if (!["weekly", "monthly", "yearly"].includes(replayPeriod)) {
    throw createError(400, "replayPeriod must be weekly, monthly, or yearly.");
  }

  return {
    body: {
      replayPeriod,
      year: asInteger(req.body.year, "year", { min: 2020, max: 2100, fallback: new Date().getFullYear() }),
      month: replayPeriod === "monthly" ? asInteger(req.body.month, "month", { min: 1, max: 12, fallback: new Date().getMonth() + 1 }) : null,
      title: asNullableString(req.body.title, "title", { max: 255 }),
    },
  };
}

function validateReplayQuery(req) {
  return {
    query: {
      year: asInteger(req.query.year, "year", { min: 2020, max: 2100, fallback: new Date().getFullYear() }),
      month: asInteger(req.query.month, "month", { min: 1, max: 12, fallback: new Date().getMonth() + 1 }),
    },
  };
}

function validateCravingPredictionBody(req) {
  return {
    body: {
      predictionWindow: asTrimmedString(req.body.predictionWindow || "30m", "predictionWindow", { required: true, max: 32 }),
      stressLevel: asInteger(req.body.stressLevel, "stressLevel", { min: 0, max: 100, fallback: null }),
      mood: asNullableString(req.body.mood, "mood", { max: 120 }),
      triggerContext: asNullableString(req.body.triggerContext, "triggerContext", { max: 255 }),
    },
  };
}

function validateVoiceCommandBody(req) {
  return {
    body: {
      commandText: asTrimmedString(req.body.commandText, "commandText", { required: true, max: 1000 }),
      aiResponse: asTrimmedString(req.body.aiResponse, "aiResponse", { required: true, max: 4000 }),
      commandIntent: asTrimmedString(req.body.commandIntent || "general", "commandIntent", { required: true, max: 80 }),
      executionStatus: asTrimmedString(req.body.executionStatus || "completed", "executionStatus", { required: true, max: 40 }),
      metadata: asJsonObject(req.body.metadata, {}),
    },
  };
}

function validateScannerHistoryBody(req) {
  return {
    body: {
      codeValue: asTrimmedString(req.body.codeValue, "codeValue", { required: true, max: 1000 }),
      codeFormat: asTrimmedString(req.body.codeFormat || "unknown", "codeFormat", { required: true, max: 40 }),
      source: asTrimmedString(req.body.source || "camera", "source", { required: true, max: 80 }),
      brand: asNullableString(req.body.brand, "brand", { max: 160 }),
      packPrice: asNumber(req.body.packPrice, "packPrice", { min: 0, max: 100000, fallback: null }),
      nicotineMg: asNumber(req.body.nicotineMg, "nicotineMg", { min: 0, max: 1000, fallback: null }),
      tarMg: asNumber(req.body.tarMg, "tarMg", { min: 0, max: 1000, fallback: null }),
      damageScore: asInteger(req.body.damageScore, "damageScore", { min: 0, max: 100, fallback: 0 }),
      chemicals: asJsonArray(req.body.chemicals, []),
    },
  };
}

function validateRitualSessionBody(req) {
  return {
    body: {
      mood: asTrimmedString(req.body.mood || "steady", "mood", { required: true, max: 80 }),
      durationSeconds: asInteger(req.body.durationSeconds, "durationSeconds", { min: 0, max: 86400, fallback: 0 }),
      breathCycles: asInteger(req.body.breathCycles, "breathCycles", { min: 0, max: 10000, fallback: 0 }),
      ambientSound: asBoolean(req.body.ambientSound, false),
      notes: asNullableString(req.body.notes, "notes", { max: 2000 }),
      sessionData: asJsonObject(req.body.sessionData, {}),
    },
  };
}

function validateEmergencySessionBody(req) {
  return {
    body: {
      triggerReason: asTrimmedString(req.body.triggerReason || "urge spike", "triggerReason", { required: true, max: 160 }),
      durationSeconds: asInteger(req.body.durationSeconds, "durationSeconds", { min: 0, max: 86400, fallback: 0 }),
      completed: asBoolean(req.body.completed, false),
      breathingCompleted: asBoolean(req.body.breathingCompleted, false),
      vibrationUsed: asBoolean(req.body.vibrationUsed, false),
      motivationShown: asJsonArray(req.body.motivationShown, []),
      sessionData: asJsonObject(req.body.sessionData, {}),
    },
  };
}

function validateFavoriteStoreBody(req) {
  return {
    body: {
      placeId: asTrimmedString(req.body.placeId, "placeId", { required: true, max: 255 }),
      storeName: asTrimmedString(req.body.storeName, "storeName", { required: true, max: 255 }),
      address: asTrimmedString(req.body.address, "address", { required: true, max: 1000 }),
      phoneNumber: asNullableString(req.body.phoneNumber, "phoneNumber", { max: 40 }),
      mapsUrl: asNullableString(req.body.mapsUrl, "mapsUrl", { max: 2000 }),
      rating: asNumber(req.body.rating, "rating", { min: 0, max: 5, fallback: null }),
      isOpen: req.body.isOpen === null || req.body.isOpen === undefined ? null : asBoolean(req.body.isOpen, false),
      latitude: asNumber(req.body.latitude, "latitude", { min: -90, max: 90, fallback: null }),
      longitude: asNumber(req.body.longitude, "longitude", { min: -180, max: 180, fallback: null }),
      metadata: asJsonObject(req.body.metadata, {}),
    },
  };
}

module.exports = {
  validatePaginationQuery,
  validateNumericIdParam,
  validateSmokeDnaBody,
  validateReplayBody,
  validateReplayQuery,
  validateCravingPredictionBody,
  validateVoiceCommandBody,
  validateScannerHistoryBody,
  validateRitualSessionBody,
  validateEmergencySessionBody,
  validateFavoriteStoreBody,
};
