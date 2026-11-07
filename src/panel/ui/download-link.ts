// Link de download da própria página: baixa o relatório sem a permissão `downloads` (RNF-02). Adaptado da Candidata+
// (src/panel/ui/download-link.ts, ramo onda-4): ficaram o nome seguro, os tipos e o ciclo de vida do endereço do blob,
// e entrou o tipo PDF. `downloadLink` é a única função do painel que chama URL.createObjectURL e URL.revokeObjectURL.
//
// Ciclo de vida do endereço do blob: nasce em downloadLink; é revogado em dispose(), ou sozinho algum tempo depois do
// primeiro clique, quando o link foi ligado com bind. Revogar duas vezes não faz nada.

/** Tamanho máximo do nome sugerido, extensão incluída. */
export const DOWNLOAD_NAME_MAX = 120;

/** Espera depois do clique antes de revogar, para o navegador já ter iniciado o download. */
export const REVOKE_AFTER_CLICK_MS = 10_000;

/** Tipos de arquivo que o painel exporta e a extensão de cada um. */
export const DOWNLOAD_TYPES: Readonly<Record<string, string>> = Object.freeze({
  'application/pdf': 'pdf',
  'text/csv': 'csv',
  'application/json': 'json',
  'text/plain': 'txt',
});

const FALLBACK_BASE = 'download';
// No Windows o dispositivo reservado vale para o trecho antes do primeiro ponto, sem espaços no fim: "aux.v1.2" e
// "con .txt" também abrem o dispositivo. COM e LPT aceitam ainda os sobrescritos ¹ ² ³.
const WINDOWS_RESERVED = /^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])$/i;
// Controles (Cc), formatação invisível (Cf: hífen suave U+00AD, marcas de direção, largura zero, U+2060 a U+2064, marca de
// ordem de bytes, etiquetas), separadores de linha e parágrafo (Zl, Zp: U+2028, U+2029), mais o separador mongol U+180E
// e a junção de grafemas U+034F, que não aparecem na tela mas disfarçam o nome ou a extensão (o truque do "gpj.exe" com U+202E).
const INVISIBLE = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}᠎͏]/gu;
const FORBIDDEN_CHARS = /[<>:"|?*]/g;

function isReservedName(base: string): boolean {
  const stem = (base.split('.')[0] ?? '').replace(/\s+$/, '');
  return WINDOWS_RESERVED.test(stem);
}

/** A extensão do tipo do blob (pdf, csv, json ou txt), ou nulo se o painel não exporta esse tipo. */
export function extensionForType(mime: string): string | null {
  const base = (mime.split(';')[0] ?? '').trim().toLowerCase();
  return DOWNLOAD_TYPES[base] ?? null;
}

/**
 * Nome de arquivo seguro para sugerir ao navegador: sem separadores de caminho (fica só o último trecho), sem
 * caracteres de controle, de direção ou proibidos no Windows, sem ponto nem espaço nas pontas, sem nome reservado
 * do Windows, com a extensão trocada pela do tipo e no máximo DOWNLOAD_NAME_MAX caracteres no total.
 */
export function sanitizeDownloadName(name: string, extension: string): string {
  const ext = extension.toLowerCase().replace(/[^a-z0-9]/g, '');
  const segments = name.normalize('NFC').split(/[\\/]+/);
  let base = (segments.filter((segment) => segment.trim() !== '').pop() ?? '').replace(INVISIBLE, '').replace(FORBIDDEN_CHARS, '-');
  // A extensão que veio no nome (só letras, até 5) cede lugar à do tipo: "relatorio.exe" de um CSV vira "relatorio.csv".
  base = base.replace(/\.[A-Za-z]{1,5}$/, '');
  base = base.replace(/\s+/g, ' ').replace(/^[\s.]+/, '').replace(/[\s.]+$/, '');
  if (base === '') base = FALLBACK_BASE;
  const room = Math.max(1, DOWNLOAD_NAME_MAX - ext.length - 1);
  const fit = (text: string): string => {
    const letters = Array.from(text);
    if (letters.length <= room) return text;
    const cut = letters.slice(0, room).join('').replace(/[\s.\-]+$/, '');
    return cut === '' ? FALLBACK_BASE.slice(0, room) : cut;
  };
  base = fit(base);
  // O corte pode deixar um nome reservado no começo, então a conferência vem depois dele.
  if (isReservedName(base)) base = fit(`_${base}`);
  return `${base}.${ext}`;
}

export interface DownloadLink {
  /** Endereço do blob (blob:...). Só serve para a âncora desta página. */
  readonly href: string;
  /** Nome sugerido, já sanitizado. */
  readonly download: string;
  readonly disposed: boolean;
  /** Liga a âncora ao link e revoga o endereço algum tempo depois do primeiro clique. */
  bind(anchor: HTMLAnchorElement): void;
  dispose(): void;
}

/**
 * Cria o link de download de `blob` com o nome sugerido `name` (sanitizado; a extensão vem do tipo do blob).
 * O blob não é alterado. Lança TypeError para tipo que o painel não exporta.
 */
export function downloadLink(blob: Blob, name: string): DownloadLink {
  if (typeof name !== 'string') throw new TypeError('downloadLink: o nome precisa ser texto');
  const extension = extensionForType(blob.type);
  if (extension === null) throw new TypeError(`downloadLink: tipo de arquivo não suportado: "${blob.type}"`);
  const download = sanitizeDownloadName(name, extension);
  const href = URL.createObjectURL(blob);
  let disposed = false;
  let bound: HTMLAnchorElement | null = null;
  let pending: ReturnType<typeof setTimeout> | null = null;

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    if (pending !== null) clearTimeout(pending);
    pending = null;
    URL.revokeObjectURL(href);
    if (bound) {
      bound.removeAttribute('href');
      bound.setAttribute('aria-disabled', 'true');
      bound = null;
    }
  };

  return {
    href,
    download,
    get disposed() {
      return disposed;
    },
    bind(anchor) {
      if (disposed) throw new Error('downloadLink: o link já foi descartado');
      bound = anchor;
      anchor.href = href;
      anchor.download = download;
      anchor.addEventListener(
        'click',
        () => {
          if (pending === null && !disposed) pending = setTimeout(dispose, REVOKE_AFTER_CLICK_MS);
        },
        { once: true },
      );
    },
    dispose,
  };
}

/** Baixa o blob já, no clique da pessoa: uma âncora escondida é ligada ao link, clicada e tirada da página. */
export function startDownload(blob: Blob, name: string): void {
  const link = downloadLink(blob, name);
  const anchor = document.createElement('a');
  anchor.hidden = true;
  link.bind(anchor);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
