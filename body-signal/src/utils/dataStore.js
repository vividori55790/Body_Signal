const STORAGE_KEY = "bs-data-v2";
const SYNC_QUEUE_KEY = "bs-sync-queue-v1";
const STORAGE_VERSION = 1;

const emptyData = () => ({ conditions: [], logs: [] });

const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

const isValidCondition = (condition) => (
  isRecord(condition)
  && typeof condition.id === "string"
  && condition.id.length > 0
  && typeof condition.label === "string"
  && condition.label.trim().length > 0
  && typeof condition.bodyPart === "string"
  && typeof condition.onsetDate === "string"
  && typeof condition.isArchived === "boolean"
);

const isValidLog = (log) => (
  isRecord(log)
  && typeof log.id === "string"
  && log.id.length > 0
  && typeof log.conditionId === "string"
  && typeof log.date === "string"
  && !Number.isNaN(Date.parse(log.date))
  && Number.isInteger(log.intensity)
  && log.intensity >= 1
  && log.intensity <= 10
);

const normalizeData = (value) => {
  if (!isRecord(value)) {
    return null;
  }

  const conditions = Array.isArray(value.conditions) ? value.conditions : null;
  const logs = Array.isArray(value.logs) ? value.logs : null;

  const conditionIds = new Set(conditions?.map((condition) => condition.id));
  if (
    !conditions
    || !logs
    || !conditions.every(isValidCondition)
    || !logs.every((log) => isValidLog(log) && conditionIds.has(log.conditionId))
  ) {
    return null;
  }

  return {
    conditions,
    logs,
  };
};

export const loadData = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return emptyData();
    }

    let parsed;
    try {
      parsed = JSON.parse(stored);
    } catch {
      throw new Error("Local Body Signal data is not valid JSON.");
    }
    const data = normalizeData(parsed?.data || parsed);
    if (!data) {
      throw new Error("Local Body Signal data failed validation.");
    }
    return data;
  } catch (error) {
    console.error("Failed to load local Body Signal data.", error);
    throw error;
  }
};

export const saveData = (data) => {
  const normalized = normalizeData(data);
  if (!normalized) {
    throw new Error("Invalid Body Signal data.");
  }

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      version: STORAGE_VERSION,
      savedAt: new Date().toISOString(),
      data: normalized,
    }),
  );
  enqueueSyncSnapshot(normalized);
};

const readSyncQueue = () => {
  try {
    const stored = localStorage.getItem(SYNC_QUEUE_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Failed to read the local sync queue.", error);
    return [];
  }
};

const enqueueSyncSnapshot = (data) => {
  const queue = readSyncQueue();
  const nextItem = {
    id: crypto.randomUUID(),
    type: "snapshot",
    createdAt: new Date().toISOString(),
    data,
  };
  localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify([...queue.slice(-4), nextItem]));
};

export const getPendingSyncCount = () => readSyncQueue().length;

export const getNextSyncItem = () => readSyncQueue()[0] || null;

export const acknowledgeSyncItem = (id) => {
  const remaining = readSyncQueue().filter((item) => item.id !== id);
  localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(remaining));
};

export const createBackup = (data) => ({
  app: "body-signal",
  version: STORAGE_VERSION,
  exportedAt: new Date().toISOString(),
  data: normalizeData(data),
});

export const parseBackup = (contents) => {
  let parsed;
  try {
    parsed = JSON.parse(contents);
  } catch {
    throw new Error("Backup file is not valid JSON.");
  }

  const data = normalizeData(parsed?.data || parsed);
  if (!data) {
    throw new Error("Backup file does not contain valid Body Signal data.");
  }

  return data;
};

export const clearData = () => {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(SYNC_QUEUE_KEY);
};
