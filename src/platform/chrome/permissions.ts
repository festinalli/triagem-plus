// Invólucro de chrome.permissions: a permissão opcional do LinkedIn, pedida pelo botão "Ler esta página" (D-10).
import type { ChromeApi } from './api.ts';

/** A única permissão de site da extensão. É opcional: o Chrome pergunta na primeira vez, e a pessoa pode tirar depois. */
export const LINKEDIN_ORIGIN = 'https://www.linkedin.com/*';

/**
 * Pede a permissão, ou confirma que já existe sem perguntar de novo. O Chrome só aceita o pedido durante o clique, então
 * quem chama precisa fazer isso antes de qualquer espera.
 */
export function requestLinkedInAccess(chrome: ChromeApi): Promise<boolean> {
  try {
    return chrome.permissions.request({ origins: [LINKEDIN_ORIGIN] });
  } catch {
    return Promise.resolve(false);
  }
}
