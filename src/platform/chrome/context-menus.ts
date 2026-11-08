// Invólucro de chrome.contextMenus.
import type { ChromeApi } from './api.ts';

export interface PageMenuItem {
  readonly id: string;
  readonly title: string;
  readonly patterns: readonly string[];
}

/** Deixa só os itens pedidos (ou nenhum): apaga tudo e recria. Quem chama serializa as chamadas. */
export function setPageMenuItems(chrome: ChromeApi, items: readonly PageMenuItem[]): Promise<void> {
  return new Promise((resolve) => {
    chrome.contextMenus.removeAll(() => {
      void chrome.runtime.lastError;
      if (items.length === 0) return resolve();
      let pending = items.length;
      for (const item of items) {
        // Sobre texto selecionado ou link, o item continua no menu (documentUrlPatterns segue limitando às páginas certas).
        chrome.contextMenus.create({ id: item.id, title: item.title, contexts: ['page', 'selection', 'link'], documentUrlPatterns: [...item.patterns] }, () => {
          void chrome.runtime.lastError;
          pending -= 1;
          if (pending === 0) resolve();
        });
      }
    });
  });
}
