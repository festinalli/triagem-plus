// Invólucro de chrome.sidePanel. `open` não é async e não espera nada antes de chamar o navegador: ele precisa
// ser chamado no mesmo tick do gesto da pessoa.
import type { ChromeApi } from './api.ts';

export function openSidePanel(chrome: ChromeApi, tabId: number): Promise<void> {
  return chrome.sidePanel.open({ tabId });
}

export function openPanelOnActionClick(chrome: ChromeApi): Promise<void> {
  return chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
}
