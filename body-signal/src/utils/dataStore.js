const STORAGE_KEY = "bs-data-v2";
const STORAGE_VERSION = 1;

const emptyData = () => ({ conditions: [], logs: [] });

const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

const normalizeData = (value) => {
  if (!isRecord(value)) {
    return null;
  }

  const conditions = Array.isArray(value.conditions) ? value.conditions : null;
  const logs = Array.isArray(value.logs) ? value.logs : null;

  if (!conditions || !logs) {
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

    const parsed = JSON.parse(stored);
    const data = normalizeData(parsed?.data || parsed);
    return data || emptyData();
  } catch (error) {
    console.error("Failed to load local Body Signal data.", error);
    return emptyData();
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
};
