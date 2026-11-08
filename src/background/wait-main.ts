/**
 * Espera o texto do <main> parar de mudar, depois que o perfil abriu (D-11). Vai para o navegador por
 * scripting.executeScript({ func }), então precisa ser autossuficiente: usa só `document`, sem nada do módulo.
 * Não rola, não clica e não abre nada: só olha o tamanho do texto. Devolve verdadeiro quando o texto parou de mudar e
 * falso quando o prazo acabou, e nos dois casos a leitura segue.
 */
export async function waitForMain(maxMs: number, stableMs: number): Promise<boolean> {
  const start = Date.now();
  let last = -1;
  let since = start;
  while (Date.now() - start < maxMs) {
    const length = document.querySelector('main')?.textContent?.length ?? 0;
    if (length !== last) {
      last = length;
      since = Date.now();
    } else if (length > 0 && Date.now() - since >= stableMs) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}
