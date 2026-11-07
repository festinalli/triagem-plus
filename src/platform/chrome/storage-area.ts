// Implementação de KeyValueArea sobre chrome.storage.local. Tradução direta, sem política. Nada em storage.sync.
import type { KeyValueArea } from '../../core/store/area.ts';

export function createChromeLocalArea(): KeyValueArea {
  const area = chrome.storage.local;
  return {
    get: async (keys) => (keys.length === 0 ? {} : ((await area.get(keys)) as Record<string, unknown>)),
    set: async (items) => {
      if (Object.keys(items).length > 0) await area.set(items);
    },
    remove: async (keys) => {
      if (keys.length > 0) await area.remove(keys);
    },
    getAll: async () => (await area.get(null)) as Record<string, unknown>,
    clear: async () => {
      await area.clear();
    },
    bytesInUse: async () => area.getBytesInUse(null),
  };
}
