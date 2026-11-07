// Invólucro de chrome.contextMenus.
import type { ChromeApi } from './api.ts';

export interface PageMenuItem {
  readonly id: string;
  readonly title: string;
  readonly patterns: readonly string[];
}

/** Deixa só o item pedido (ou nenhum): apaga tudo e recria. Quem chama serializa as chamadas. */
export function setPageMenuItem(chrome: ChromeApi, item: PageMenuItem | null): Promise<void> {
  return new Promise((resolve) => {
    chrome.contextMenus.removeAll(() => {
      void chrome.runtime.lastError;
      if (item === null) return resolve();
      chrome.contextMenus.create({ id: item.id, title: item.title, // Sobre texto selecionado ou link, o item continua no menu (documentUrlPatterns segue limitando ao perfil).
      contexts: ['page', 'selection', 'link'], documentUrlPatterns: [...item.patterns] }, () => {
        void chrome.runtime.lastError;
        resolve();
      });
    });
  });
}
