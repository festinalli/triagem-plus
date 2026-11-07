import type { PageRead } from '../core/page-read.ts';

/**
 * Lê o texto da página. É enviada ao navegador por scripting.executeScript({ func }), então precisa ser
 * autossuficiente: usa só `document` e `location`, nada do módulo. Lê o texto do <main>; sem <main>, só
 * devolve o do <body> se `fallbackToBody` for verdadeiro (construção de prova).
 */
export function readPage(fallbackToBody: boolean): PageRead {
  const main = document.querySelector('main');
  const source = main ?? (fallbackToBody ? document.body : null);
  const text = (source as HTMLElement | null)?.innerText ?? '';
  return { text, url: location.href, title: document.title };
}
