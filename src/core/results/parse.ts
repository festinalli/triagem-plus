// A página de resultados de pessoas do LinkedIn, separada por pessoa (D-09, RF-38, RF-39). Puro: sem Chrome e sem DOM.
//
// De cada pessoa sai só o nome, o link e o texto da linha de título e do trecho mostrado. Local, conexões em comum e botões
// não chegam à análise: um colega chamado Ruby não pode virar a tecnologia Ruby, e a cidade não pode mudar a nota (P-5).
// A ordem das linhas foi vista nos resultados reais: nome, grau, título, local, trecho, conexões em comum e botões.
import { canonicalProfileUrl, profileKeyOf } from '../profile/merge.ts';
import { readName } from '../profile/name.ts';
import { isKnownPlace } from '../profile/places.ts';
import { workTitleOf } from '../profile/work-titles.ts';
import { normalize } from '../text/normalize.ts';

/** O que a função de leitura devolve para cada pessoa da página. */
export interface RawResult {
  readonly href: string;
  readonly name: string;
  readonly text: string;
}

export interface ResultsRead {
  readonly url: string;
  readonly items: readonly RawResult[];
}

export interface ListingEntry {
  /** Nulo quando o texto não parece um nome: a pessoa fica de fora e a tela conta. */
  readonly name: string | null;
  readonly url: string;
  readonly key: string;
  /** A linha de título, como "Desenvolvedor | C# | .NET". */
  readonly headline: string;
  /** O trecho mostrado, como "Atual: ...". Pode vir vazio. */
  readonly details: string;
}

/** Uma página mostra cerca de 10 pessoas. O teto só protege de uma página fora do normal. */
export const MAX_RESULTS = 40;
const MAX_TEXT_CHARS = 3000;
const MAX_LINE_CHARS = 400;
const MAX_LINES = 30;
const MAX_NAME_CHARS = 200;

const VIEW_PROFILE_PT = /^ver perfil d[eao]s?\s+/iu;
const VIEW_PROFILE_EN = /^view\s+(.+?)[’']s?\s+profile.*$/iu;
const NAME_BREAK = /\s*[·•|‧∙⋅]\s*/u;
const DEGREE_LINE = /^[\s•·‧∙⋅-]*[123](?:º|ª|°|o|st|nd|rd|th)?\+?(?:\s*e\s*\+|\s+grau|\s+degree(?:\s+connection)?)?\s*$/iu;
const DEGREE_WORDS = /conex[aã]o de [123]|[123](?:st|nd|rd) degree/iu;
// As três só valem para a linha inteira: "Dev C# | 12 mil seguidores" é um título, e não pode sumir.
const MUTUAL = /(?:conex(?:ão|ao|ões|oes)\s+em\s+comum|mutual\s+connections?)\s*\.?$/iu;
const FOLLOWERS = /^[\d.,]+\s*(?:mil|k|m)?\s*(?:seguidores|followers)$/iu;
const STATUS_LINE = /^(?:status\s+is\s|status:\s*(?:online|offline|ausente|away)\b|ver perfil d|view\s.+profile)/iu;
const PLACE_LINE = /(?:,\s*(?:brasil|brazil)|\se\sregião|\sarea)$/iu;
const SEGMENT_BREAK = /(\s*[|•·‧∙⋅,;]\s*)/u;
// O que vem depois de "@", ou de "na", "no" e "at" depois de um cargo, é a empresa, até um " - " ou o fim do trecho.
const EMPLOYER_AT = /\s*@\s*\S.*?(?=\s+[-–—]\s|$)/u;
const EMPLOYER_WORD = /^(.*?\S)\s+(?:na|no|at)\s+\S.*?(?=\s+[-–—]\s|$)/iu;
const LINE_LABEL = /^[^:：]{1,20}[:：]\s*/u;
/** Trecho com rótulo: quando vem logo depois do título, a pessoa não tem local na lista. */
const DETAIL_LABEL = /^(?:atual|current|passado|past|anterior|competências|competencias|skills|resumo|summary|sobre|about)\s*:/iu;
const CONTROL_LINES: ReadonlySet<string> = new Set([
  'conectar', 'connect', 'seguir', 'follow', 'enviar mensagem', 'mensagem', 'message', 'pendente', 'pending', 'salvar', 'save',
  'ver perfil', 'visualizar perfil', 'view profile', 'premium', 'perfil verificado', 'verificado', 'verificada', 'verified',
  'seguindo', 'following', 'fora da sua rede', 'fora da rede', 'out of network',
]);

function cleanRawName(raw: string): string {
  const firstLine = raw.split('\n').map((line) => line.trim()).find((line) => line !== '') ?? '';
  const line = firstLine.slice(0, MAX_NAME_CHARS).replace(VIEW_PROFILE_PT, '');
  return line.replace(VIEW_PROFILE_EN, '$1');
}

function isNoiseLine(line: string, nameKey: string): boolean {
  const key = normalize(line);
  if (key === '' || CONTROL_LINES.has(key)) return true;
  if (nameKey !== '' && (key === nameKey || key.startsWith(`${nameKey} `))) return true;
  return DEGREE_LINE.test(line) || DEGREE_WORDS.test(line) || MUTUAL.test(line) || FOLLOWERS.test(line) || STATUS_LINE.test(line);
}

/**
 * Nome de empresa não é tecnologia: "Analista de RH na Oracle" não pode dar crédito em Oracle (RF-39, P-5). Limite conhecido: empresa
 * citada sem "@", "na", "no" ou "at", como "Gerente, Python Brasil", ainda conta. É pré-nota, e o detalhe mostra de onde veio.
 */
function withoutEmployer(line: string): string {
  return line
    .split(SEGMENT_BREAK)
    .map((segment, index) => {
      if (index % 2 === 1) return segment;
      return segment
        .replace(EMPLOYER_AT, '')
        .replace(EMPLOYER_WORD, (whole: string, before: string) => (workTitleOf(before.replace(LINE_LABEL, '')) === '' ? whole : before));
    })
    .join('');
}

function usefulLines(text: string, nameKey: string): string[] {
  return text
    .slice(0, MAX_TEXT_CHARS)
    .split('\n')
    .slice(0, MAX_LINES)
    .map((line) => line.trim().slice(0, MAX_LINE_CHARS))
    .filter((line) => !isNoiseLine(line, nameKey))
    .map(withoutEmployer);
}

function entryOf(item: RawResult): ListingEntry | null {
  const key = profileKeyOf(item.href);
  const url = canonicalProfileUrl(item.href);
  if (key === null || url === null) return null;
  const textFirstLine = item.text.split('\n').map((line) => line.trim()).find((line) => line !== '') ?? '';
  const rawName = cleanRawName(item.name === '' ? textFirstLine : item.name);
  const nameKey = normalize(rawName.split(NAME_BREAK)[0] ?? '');
  const [headline = '', second, ...rest] = usefulLines(item.text, nameKey);
  if (headline === '') return null;
  // Só uma linha, e com forma de lugar: é o local de quem não tem título.
  if (second === undefined && (PLACE_LINE.test(headline) || isKnownPlace(normalize(headline)))) return null;
  const details = second !== undefined && DETAIL_LABEL.test(second) ? [second, ...rest] : rest;
  return { name: readName(rawName), url, key, headline, details: details.join('\n') };
}

/** As pessoas da página, sem repetir, na ordem em que aparecem. Bloco sem título não é o cartão de uma pessoa e fica de fora. */
export function parseResults(items: readonly RawResult[]): ListingEntry[] {
  const seen = new Set<string>();
  const entries: ListingEntry[] = [];
  for (const item of items.slice(0, MAX_RESULTS)) {
    const entry = entryOf(item);
    if (entry === null || seen.has(entry.key)) continue;
    seen.add(entry.key);
    entries.push(entry);
  }
  return entries;
}
