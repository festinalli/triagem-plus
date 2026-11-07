// Léxico de blocos (RF-12): a descrição da vaga é dividida em blocos por linhas de título e por
// marcadores de lista; cada bloco recebe a classe required, preferred ou mentioned. Marcadores dentro da frase
// ("desejável", "obrigatório", "preferred", "required") prevalecem sobre o título do bloco.
import { normalize } from '../text/normalize.ts';
import type { RequirementClass } from './types.ts';

// Títulos de bloco (lista inicial; ampliável). Chaves já normalizadas.
const HEADINGS: Readonly<Record<'required' | 'preferred', readonly string[]>> = {
  required: [
    'requisitos', 'requisito', 'requisitos obrigatorios', 'obrigatorio', 'obrigatorios', 'obrigatoria', 'obrigatorias', 'o que esperamos', 'o que voce precisa ter', 'qualificacoes',
    'requirements', 'required', 'must have', 'what you bring', 'qualifications', 'you have',
    'imprescindible', 'obligatorio', 'lo que buscamos', 'requisitos imprescindibles',
  ],
  preferred: [
    'desejavel', 'desejaveis', 'requisitos desejaveis', 'requisito desejavel', 'requisitos diferenciais', 'diferenciais', 'diferencial', 'sera um plus', 'nice to have', 'preferred', 'bonus', 'plus',
    'deseable', 'valorable', 'se valorara',
  ],
};

// Marcadores dentro da frase: prevalecem sobre o título do bloco. Desejável tem precedência sobre obrigatório
// quando as duas aparecem na mesma frase.
// As flexões de gênero e número (desejáveis, obrigatória, obrigatórios) contam como o marcador da especificação.
const PREFERRED_MARKERS: readonly string[] = [
  'desejavel', 'desejaveis', 'preferred', 'deseable', 'deseables', 'diferencial', 'sera um plus', 'nice to have', 'bonus', 'plus',
  'valorable', 'se valorara',
];
const REQUIRED_MARKERS: readonly string[] = [
  'obrigatorio', 'obrigatoria', 'obrigatorios', 'obrigatorias', 'required', 'imprescindible', 'imprescindibles', 'obligatorio', 'obligatoria', 'must have',
];

const MAX_HEADING_WORDS = 6;
// Marcador de lista no começo da linha: lista explícita, não "qualquer pontuação" (ponto, ¿, ¡, aspas, #, @, % e & abrem
// palavras e não são marcador: ".NET Framework", "¿Tienes...?"). Entram os travessões (Pd), os símbolos de categoria So
// (●, ✓, ■, ►, emoji), as formas geométricas U+25A0 a U+25FF (algumas são Sm, como ◾), os bullets de pontuação (•, ·, ‣,
// ⁃, ∙), +, > e →; o asterisco vale como marcador quando não é o começo de um negrito (`**`). Ou número com ponto ou
// parêntese, com espaço ou fim de linha depois (para "1.5 anos" não valer). Seletor de variação e junção de emoji (U+FE0F,
// U+200D) colados ao símbolo saem junto. Um marcador sozinho ("-") casa e fica sem texto, então não vira item.
const BULLET = /^(?:(?:[\p{Pd}\p{So}\u25A0-\u25FF•·‣⁃∙+>→]|\*(?!\*))[\uFE0F\u200D]*\s*|\d{1,2}[.)](?:\s+|$))/u;
// Decoração de título: emoji colorido (Emoji_Presentation, ou símbolo seguido do seletor U+FE0F) e os símbolos de destaque
// ► ▶ ★ ☆ ◆ ❖ ➤, mais as cerquilhas de título markdown (##). Os glifos de texto que também servem de marcador de lista
// (▪ ◼ ◾ ◽ ⬛ ⬜ ✔ ☑ ➡ ● ■ ○ ✓) não entram: são marcador, como "- Bônus". O negrito (**...**, __...__) tem
// corrida de 2 a 4 marcadores, para o custo da expressão ser linear no tamanho da linha.
const TITLE_DECOR =
  /^(?:(?:(?![\u25A0-\u25FF\u2B1B\u2B1C])\p{Emoji_Presentation}[\uFE0F\u200D]*|\p{Extended_Pictographic}\uFE0F[\uFE0F\u200D]*|[►▶★☆◆❖➤][\uFE0F\u200D]*|#{1,6})\s*)+/u;
const TITLE_BOLD = /^(\*{2,4}|_{2,4})(.+?)\1\s*:?$/u;

export interface RequirementItem {
  readonly text: string;
  readonly class: RequirementClass;
}

export interface RequirementBlock {
  /** Linha de título que abriu o bloco, ou null para o texto antes do primeiro título. */
  readonly heading: string | null;
  readonly class: RequirementClass;
  readonly items: readonly RequirementItem[];
}

function padded(text: string): string {
  return ` ${normalize(text)} `;
}

function containsPhrase(paddedText: string, phrase: string): boolean {
  return paddedText.includes(` ${phrase} `);
}

function anyPhrase(paddedText: string, phrases: readonly string[]): boolean {
  return phrases.some((phrase) => containsPhrase(paddedText, phrase));
}

/** Classe de uma linha de título (ou de qualquer linha): marcador dentro da frase primeiro, depois o título do léxico. */
export function classifyHeading(line: string): RequirementClass {
  const text = padded(line);
  if (anyPhrase(text, PREFERRED_MARKERS) || anyPhrase(text, HEADINGS.preferred)) return 'preferred';
  if (anyPhrase(text, REQUIRED_MARKERS) || anyPhrase(text, HEADINGS.required)) return 'required';
  return 'mentioned';
}

/** Classe de um item dentro de um bloco: marcador da própria frase, se houver; senão a classe do bloco. */
export function classifyItem(text: string, blockClass: RequirementClass): RequirementClass {
  const body = padded(text);
  if (anyPhrase(body, PREFERRED_MARKERS)) return 'preferred';
  if (anyPhrase(body, REQUIRED_MARKERS)) return 'required';
  return blockClass;
}

/** Uma linha abre bloco quando é curta e termina em dois-pontos, ou quando é exatamente um título do léxico. */
export function isHeadingLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length === 0) return false;
  const normalized = normalize(trimmed);
  if (normalized.length === 0) return false;
  const words = normalized.split(' ').length;
  if (trimmed.endsWith(':') && words <= MAX_HEADING_WORDS && trimmed.length <= 80) return true;
  const whole = padded(trimmed).trim();
  return words <= MAX_HEADING_WORDS && (HEADINGS.required.includes(whole) || HEADINGS.preferred.includes(whole));
}

/** Texto de um título decorado ("📌 Requisitos", "## Requisitos", "**Requisitos**"), ou null se a linha não é decorada. */
function undecorate(line: string): string | null {
  let text = line.trim();
  let changed = false;
  for (let guard = 0; guard < 4; guard++) {
    const lead = text.replace(TITLE_DECOR, '').trim();
    const bold = TITLE_BOLD.exec(lead);
    const next = bold !== null ? (bold[2] ?? '').trim() : lead;
    if (next === text) break;
    text = next;
    changed = true;
  }
  return changed && text.length > 0 ? text : null;
}

/**
 * Título da linha que abre bloco, ou null. Com decoração (emoji, símbolo de destaque, #, negrito), vale o texto sem a
 * decoração como se estivesse sozinho: isHeadingLine, então o título exato do léxico ou a linha curta que termina em
 * dois-pontos, de qualquer classe. "📌 Requisitos", "## Requisitos:", "**Requisitos**", "**Benefícios:**" e
 * "🎁 Benefícios:" abrem bloco; "## Benefícios", "★ Benefícios" e "**Sobre a vaga**" (sem dois-pontos, fora do léxico)
 * seguem item, como "Benefícios". Com marcador de lista, só abre bloco a seção com dois-pontos cujo título é required ou
 * preferred ("1. Requisitos:", "• Diferenciais:"); "- Experiência com:" e "- Bônus" seguem como item do bloco.
 */
function blockHeading(line: string): string | null {
  const decorated = undecorate(line);
  if (decorated !== null && isHeadingLine(decorated)) return decorated;
  if (!BULLET.test(line)) return isHeadingLine(line) ? line.trim() : null;
  const body = line.replace(BULLET, '').trim();
  return body.endsWith(':') && isHeadingLine(body) && classifyHeading(body) !== 'mentioned' ? body : null;
}

/** Divide a descrição em blocos. Cada linha não vazia que não é título vira um item (sem o marcador de lista). */
export function splitRequirementBlocks(description: string): RequirementBlock[] {
  type Open = { heading: string | null; class: RequirementClass; items: RequirementItem[] };
  const blocks: Open[] = [{ heading: null, class: 'mentioned', items: [] }];
  let current = blocks[0] as Open;
  for (const raw of description.split(/\r?\n/u)) {
    const line = raw.trim();
    if (line.length === 0) continue;
    const title = blockHeading(line);
    if (title !== null) {
      current = { heading: line, class: classifyHeading(title), items: [] };
      blocks.push(current);
      continue;
    }
    const text = line.replace(BULLET, '').trim();
    if (text.length === 0) continue;
    current.items.push({ text, class: classifyItem(text, current.class) });
  }
  return blocks.filter((block) => block.heading !== null || block.items.length > 0);
}
