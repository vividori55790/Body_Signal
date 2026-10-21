import assert from "node:assert/strict";

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) || null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
};

const { clearData, createBackup, getNextSyncItem, getPendingSyncCount, parseBackup, saveData } = await import("../src/utils/dataStore.js");
const { drainSyncQueue } = await import("../src/utils/syncQueue.js");

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
const data = {
  conditions: [condition],
  logs: [log],
  diaryEntries: [{ date: "2026-01-01", text: "Busy morning", updatedAt: "2026-01-01T12:00:00.000Z" }],
};

assert.deepEqual(parseBackup(JSON.stringify(createBackup(data))), data);
assert.throws(() => parseBackup("{invalid"), /valid JSON/);
assert.throws(
  () => parseBackup(JSON.stringify({ conditions: [condition], logs: [{ ...log, conditionId: "missing" }] })),
  /valid Body Signal data/,
);
assert.deepEqual(
  parseBackup(JSON.stringify({ conditions: [], logs: [] })),
  { conditions: [], logs: [], diaryEntries: [] },
);

saveData(data);
assert.equal(getPendingSyncCount(), 1);
saveData(data);
assert.equal(getPendingSyncCount(), 1);
const queued = getNextSyncItem();
assert.equal(queued.type, "snapshot");
assert.deepEqual(queued.data, data);
const failedDrain = await drainSyncQueue(async () => ({ ok: false, error: "offline" }));
assert.deepEqual(failedDrain, { processed: 0, blocked: true, error: "offline" });
assert.equal(getPendingSyncCount(), 1);
const successfulDrain = await drainSyncQueue(async () => ({ ok: true }));
assert.deepEqual(successfulDrain, { processed: 1 });
assert.equal(getPendingSyncCount(), 0);

clearData();
console.log("Data store checks passed.");
