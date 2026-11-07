// Porta de armazenamento chave-valor. O núcleo só conhece esta forma; o Chrome entra em src/platform/chrome/storage-area.ts.

export interface KeyValueArea {
  get(keys: string[]): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string[]): Promise<void>;
  getAll(): Promise<Record<string, unknown>>;
  clear(): Promise<void>;
  bytesInUse(): Promise<number>;
}

/** Área em memória para testes. Copia os valores ao gravar e ao ler, como o armazenamento real. */
export function createMemoryArea(): KeyValueArea {
  const data = new Map<string, unknown>();
  const copy = <T>(value: T): T => (value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T));
  return {
    get: async (keys) => {
      const out: Record<string, unknown> = {};
      for (const key of keys) if (data.has(key)) out[key] = copy(data.get(key));
      return out;
    },
    set: async (items) => {
      for (const [key, value] of Object.entries(items)) data.set(key, copy(value));
    },
    remove: async (keys) => {
      for (const key of keys) data.delete(key);
    },
    getAll: async () => {
      const out: Record<string, unknown> = {};
      for (const [key, value] of data) out[key] = copy(value);
      return out;
    },
    clear: async () => {
      data.clear();
    },
    bytesInUse: async () => {
      let total = 0;
      for (const [key, value] of data) total += key.length + JSON.stringify(value).length;
      return total;
    },
  };
}
