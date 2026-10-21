import assert from "node:assert/strict";

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) || null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
};

const { acknowledgeSyncItem, clearData, createBackup, getNextSyncItem, getPendingSyncCount, parseBackup, saveData } = await import("../src/utils/dataStore.js");

const condition = {
  id: "condition-1",
  label: "Headache",
  bodyPart: "Temple",
  onsetDate: "2026-01-01",
  isArchived: false,
};
const log = {
  id: "log-1",
  conditionId: condition.id,
  date: "2026-01-01T10:00:00.000Z",
  intensity: 5,
};
const data = { conditions: [condition], logs: [log] };

assert.deepEqual(parseBackup(JSON.stringify(createBackup(data))), data);
assert.throws(() => parseBackup("{invalid"), /valid JSON/);
assert.throws(
  () => parseBackup(JSON.stringify({ conditions: [condition], logs: [{ ...log, conditionId: "missing" }] })),
  /valid Body Signal data/,
);

saveData(data);
assert.equal(getPendingSyncCount(), 1);
saveData(data);
assert.equal(getPendingSyncCount(), 1);
const queued = getNextSyncItem();
assert.equal(queued.type, "snapshot");
assert.deepEqual(queued.data, data);
acknowledgeSyncItem(queued.id);
assert.equal(getPendingSyncCount(), 0);

clearData();
console.log("Data store checks passed.");
