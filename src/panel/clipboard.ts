// Copiar para a área de transferência (RF-22). Primeiro navigator.clipboard, que não pede permissão nova; se falhar, a
// alternativa antiga com um campo de texto escondido. Se as duas falharem, devolve false e a tela mostra o texto
// selecionado para a pessoa copiar com o teclado. O texto copiado nunca vai para o console.

function copyWithSelection(text: string): boolean {
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.setAttribute('aria-hidden', 'true');
  area.className = 'tr-offscreen';
  const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  document.body.appendChild(area);
  area.select();
  let done = false;
  try {
    done = document.execCommand('copy');
  } catch {
    done = false;
  }
  area.remove();
  previous?.focus();
  return done;
}

/** Copia o texto. Verdadeiro se um dos dois caminhos funcionou. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // segue para a alternativa
  }
  return copyWithSelection(text);
}
