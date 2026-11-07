// Link de candidato que a tela pode tornar clicável (RNF-04): só https, com nome de site simples, sem usuário nem senha,
// sem espaço e só em ASCII visível. Qualquer outra coisa continua aparecendo, mas como texto.
const HTTPS_LINK = /^https:\/\/([a-z0-9-]+\.)+[a-z0-9-]+(:\d{1,5})?([/?#][^\s\\]*)?$/i;

export function safeHttpsLink(raw: string): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!HTTPS_LINK.test(trimmed)) return null;
  for (let index = 0; index < trimmed.length; index += 1) {
    const code = trimmed.charCodeAt(index);
    if (code < 0x21 || code > 0x7e) return null;
  }
  return trimmed;
}

/** O link foi escrito com https? Só o esquema; a tela usa isto para recusar o campo e `safeHttpsLink` para tornar clicável. */
export function startsWithHttps(raw: string): boolean {
  return /^https:\/\/\S+$/i.test(raw.trim());
}
