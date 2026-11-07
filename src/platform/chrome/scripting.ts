// Invólucro de chrome.scripting: roda uma função serializável na aba do gesto (permissão activeTab).
import type { ChromeApi } from './api.ts';

export async function runInTab<A extends unknown[], R>(chrome: ChromeApi, tabId: number, func: (...args: A) => R, args: A): Promise<Awaited<R> | undefined> {
  const results = await chrome.scripting.executeScript({ target: { tabId }, func, args });
  return results[0]?.result as Awaited<R> | undefined;
}
