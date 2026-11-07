// O `chrome` global, restrito às APIs que a extensão usa.
export type ChromeApi = Pick<typeof chrome, 'runtime' | 'tabs' | 'scripting' | 'sidePanel' | 'contextMenus' | 'action' | 'storage' | 'commands' | 'windows'>;

/** O `chrome` do contexto atual; lança se não existir. */
export function globalChrome(): ChromeApi {
  const found = (globalThis as { chrome?: ChromeApi }).chrome;
  if (found === undefined) throw new Error('chrome indisponível neste contexto');
  return found;
}
