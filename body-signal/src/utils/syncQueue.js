import { acknowledgeSyncItem, getNextSyncItem } from "./dataStore.js";

export const drainSyncQueue = async (sendSnapshot) => {
  if (typeof sendSnapshot !== "function") {
    throw new TypeError("A sync transport function is required.");
  }

  let processed = 0;
  while (true) {
    const item = getNextSyncItem();
    if (!item) {
      return { processed };
    }

    const result = await sendSnapshot(item);
    if (!result || result.ok !== true) {
      return {
        processed,
        blocked: true,
        error: result?.error || "Sync transport did not acknowledge the snapshot.",
      };
    }

    acknowledgeSyncItem(item.id);
    processed += 1;
  }
};
