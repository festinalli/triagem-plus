// Invólucro de chrome.storage.session (memória da sessão, some ao fechar o navegador).
import type { ChromeApi } from './api.ts';

export function setSession(chrome: ChromeApi, key: string, value: unknown): Promise<void> {
  return chrome.storage.session.set({ [key]: value });
}

export async function getSession(chrome: ChromeApi, key: string): Promise<unknown> {
  const all = await chrome.storage.session.get(key);
  return all[key];
}

export function onSessionChanged(chrome: ChromeApi, key: string, listener: (value: unknown) => void): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'session' && changes[key] !== undefined) listener(changes[key].newValue);
  });
}

export function removeSession(chrome: ChromeApi, key: string): Promise<void> {
  return chrome.storage.session.remove(key);
}
