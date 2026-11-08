// A aba dos perfis (D-11). O botão Próximo perfil abre cada perfil nela, um por clique. Na primeira vez a aba é criada, e
// depois é reaproveitada enquanto existir. A função espera o Chrome dizer que a página terminou de carregar, até o prazo.
// Ela não rola nem clica nada.
import type { ChromeApi } from './api.ts';

export interface OpenedTab {
  readonly tabId: number;
  /** O endereço depois de carregar: o LinkedIn pode ter levado a outra página, como a do login. */
  readonly url: string | undefined;
}

let profileTabId: number | undefined;

async function reuseOrCreate(chrome: ChromeApi, url: string): Promise<number> {
  const existing = profileTabId === undefined ? undefined : await chrome.tabs.get(profileTabId).catch(() => undefined);
  const tab = existing?.id !== undefined ? await chrome.tabs.update(existing.id, { url, active: true }) : await chrome.tabs.create({ url, active: true });
  if (tab?.id === undefined) throw new Error('aba não aberta');
  return tab.id;
}

/** Abre o link na aba dos perfis e espera carregar. Indefinido quando não abriu ou o prazo acabou. */
export function openInProfileTab(chrome: ChromeApi, url: string, timeoutMs: number): Promise<OpenedTab | undefined> {
  return new Promise((resolve) => {
    // O aviso de "terminou" pode chegar antes de a aba ser conhecida: ele fica guardado até lá.
    const completed = new Set<number>();
    let tabId: number | undefined;
    let done = false;
    const listener = (id: number, change: { status?: string }): void => {
      if (change.status !== 'complete') return;
      completed.add(id);
      settle();
    };
    const finish = (value: OpenedTab | undefined): void => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(listener);
      resolve(value);
    };
    function settle(): void {
      if (tabId === undefined || !completed.has(tabId)) return;
      const id = tabId;
      chrome.tabs.get(id).then(
        (tab) => finish({ tabId: id, url: tab.url }),
        () => finish(undefined),
      );
    }
    const timer = setTimeout(() => finish(undefined), timeoutMs);
    chrome.tabs.onUpdated.addListener(listener);
    reuseOrCreate(chrome, url).then(
      (id) => {
        tabId = id;
        profileTabId = id;
        settle();
      },
      () => finish(undefined),
    );
  });
}
