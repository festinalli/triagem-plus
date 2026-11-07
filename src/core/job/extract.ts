// Sugestão de requisitos a partir do texto da vaga (RF-11, RF-12, RF-15). A pessoa confere e edita tudo depois. Puro.
// A trava vale por frase: a que cai nela fica inteira de fora, inclusive a tecnologia que cita, e vai para `ignored` com o motivo.
// O resto da vaga, mesmo na mesma linha, continua valendo.
import { keyOf, MAX_PHRASE_TOKENS } from '../dictionary/compile.ts';
import { canonicalOf, classifyHeading, classifyItem, DEV_DICTIONARY, findTerms, splitRequirementBlocks } from '../dictionary/index.ts';
import type { RequirementClass, TermCategory } from '../dictionary/index.ts';
import type { CompiledTerm } from '../dictionary/types.ts';
import { findForbidden } from '../guard/index.ts';
import type { ForbiddenTopic } from '../guard/index.ts';
import { prepareYears, yearMentions } from '../guard/years.ts';
import type { YearsMention } from '../guard/years.ts';
import type { Importance, Requirement, RequirementKind } from '../model.ts';
import { normalize } from '../text/normalize.ts';
import { makeRequirement, MAX_REQUIREMENTS, MIN_YEARS_HIGHEST, MIN_YEARS_LOWEST, TOTAL_EXPERIENCE_ID } from './requirements.ts';

export interface IgnoredLine {
  /** A frase, como escrita. */
  readonly line: string;
  readonly topic: ForbiddenTopic;
  readonly reason: string;
}

export interface ExtractedRequirements {
  readonly requirements: Requirement[];
  readonly ignored: IgnoredLine[];
  /** O texto passou do corte e o final não foi lido. A tela avisa, porque pode faltar requisito e linha recusada. */
  readonly truncated: boolean;
  /** Nenhum requisito saiu do texto: a tela pede o preenchimento à mão, em vez de seguir com a lista vazia sem dizer nada. */
  readonly needsManualEntry: boolean;
}

const KIND_BY_CATEGORY: Readonly<Record<TermCategory, RequirementKind>> = {
  technology: 'term',
  tool: 'term',
  skill: 'term',
  language: 'language',
  certification: 'certification',
  role: 'title_word',
};

// Seção que não pede nada de quem se candidata: "curso de inglês" nos benefícios não é requisito de inglês. O léxico de
// blocos não separa isso de um título qualquer, e "Benefícios" sem dois-pontos nem abre bloco lá, por isso a lista aqui.
const OFF_TOPIC_TITLES: ReadonlySet<string> = new Set([
  'beneficios', 'beneficio', 'nossos beneficios', 'o que oferecemos', 'oferecemos', 'vantagens', 'benefits', 'perks', 'what we offer', 'we offer',
  'sobre a empresa', 'sobre nos', 'quem somos', 'a empresa', 'nossa empresa', 'about us', 'about the company', 'about',
]);

// Títulos que o léxico de blocos ainda não conhece. Sem dois-pontos não abrem bloco lá, por isso também valem como linha inteira.
const PREFERRED_TITLES: ReadonlySet<string> = new Set([
  'good to have', 'nice to have', 'nice to haves', 'seria legal', 'seria legal ter', 'seria bom', 'seria bom ter', 'seria otimo', 'seria otimo ter', 'extras', 'extra', 'pontos extras', 'ponto extra', 'sera um diferencial', 'sera um plus', 'bonus points', 'plus', 'diferenciais', 'diferencial', 'desejaveis', 'desejavel', 'opcionais', 'opcional', 'optional',
]);
// Quem nega a obrigação pede menos, não mais: o léxico leria "não obrigatório" como obrigatório.
// "Opcional" só no fim da frase: "Docker (opcional)" sim, "optional chaining" não.
const NOT_REQUIRED = /(?:^| )(?:nao (?:e |sera |eh )?(?:obrigatori[oa]s?|essencia(?:l|is)|exigid[oa]s?|mandatori[oa]s?|imprescindive(?:l|is))|not (?:a )?(?:required|mandatory|essential|requirement|must))(?: |$)|(?:^| )(?:opcional|opcionais|optional)$/u;

// Fim de frase: ponto e vírgula, exclamação, interrogação, e ponto seguido de espaço ou do fim, fora de sigla com pontos ("U.S. citizens").
const SENTENCE_END = /[;!?]+|(?<!\.\p{L})\.+(?=\s|$)/gu;
const HAS_WORD = /[\p{L}\p{N}]/u;

// Item com rótulo na mesma linha: "Diferenciais: Kafka", "Stack: Go, Rust". O rótulo é curto, senão é frase com dois-pontos.
const MAX_LABEL_CHARS = 60;
// Lista curta: "Go, Rust, Kubernetes", "Python ou Go". Os espaços já estão colapsados, e nenhum padrão pode retroceder.
const LIST_SEPARATOR = / ?(?:[,;/&|]| (?:e|ou|and|or) ) ?/iu;
const LIST_EDGES = /^[^\p{L}\p{N}.#+]+|[^\p{L}\p{N}#+]+$/gu;
const MAX_LIST_CHARS = 200;
const MAX_LIST_ITEMS = 12;
// Termo ambíguo logo depois disto, fechando a oração, é o termo: "Proficiência em Go". Spring, Julia e Unity também são estação, gente e empresa.
const NAMING_LINKS: ReadonlySet<string> = new Set(['em', 'com', 'in', 'with', 'of']);
const NOT_NAMED_BY_LINK: ReadonlySet<string> = new Set(['Spring', 'Julia', 'Unity', 'Assembly']);
const AFTER_NAMED: ReadonlySet<string> = new Set(['e', 'ou', 'and', 'or']);

// Marca de fim de oração. A normalização apaga vírgula e ponto final, e sem isso "5 anos de experiência, Java" daria Java com 5 anos.
const CLAUSE = 'qqfimdeoracaoqq';
const CLAUSE_MARK = /[,;!?]|\.(?=\s|$)/gu;

// O que pode ficar entre "5 anos" e o termo: "5 anos de experiência profissional com Java".
const AFTER_YEARS: ReadonlySet<string> = new Set([
  'de', 'da', 'do', 'em', 'na', 'no', 'com', 'como', 'a', 'of', 'in', 'with', 'on', 'using', 'the', 'as', 'an', 'experiencia', 'experience', 'exp', 'atuacao', 'vivencia', 'pratica', 'trabalho', 'trabalhando',
  'atuando', 'desenvolvendo', 'programando', 'usando', 'utilizando', 'profissional', 'comprovada', 'solida', 'professional', 'hands', 'working', 'developing', 'programming', 'relevant', 'proven', 'solid', 'practical',
  'work', 'minima', 'minimo', 'desenvolvimento', 'development',
]);
// O que pode ficar entre o termo e o número: "Java por pelo menos 3 anos", "Java com mínimo de 3 anos".
const BEFORE_YEARS: ReadonlySet<string> = new Set(['de', 'com', 'minimo', 'minima', 'pelo', 'menos', 'ao', 'por', 'ha', 'mais', 'at', 'least', 'for', 'over', 'no', 'experiencia', 'experience', 'tendo', 'ter']);
const GAP_LIMIT = 6;
// Sem termo, estas palavras dizem que os anos são de carreira: "5 anos de experiência", "pelo menos 5 anos na área".
const TOTAL_AFTER: ReadonlySet<string> = new Set(['experiencia', 'experience', 'exp', 'xp', 'atuacao', 'vivencia', 'carreira', 'area', 'field', 'industry', 'profissao', 'ti', 'tecnologia', 'tech', 'technology', 'software']);
const TOTAL_BEFORE: ReadonlySet<string> = new Set(['experiencia', 'experience']);
// Quem tem os anos é a empresa, não a pessoa: "somos uma empresa com 20 anos de experiência".
const ABOUT_COMPANY: ReadonlySet<string> = new Set(['empresa', 'companhia', 'somos', 'startup', 'fundada', 'fundado', 'fundacao', 'company', 'founded', 'nossa', 'nosso', 'nossos', 'nossas', 'our', 'we', 'grupo', 'consultoria', 'equipe', 'team']);
const DIGITS = /^\d+$/u;

// Só o começo de um texto enorme é lido, cortado no fim de uma linha: o resto não vira requisito nem aviso. Nenhuma descrição
// de vaga real chega perto disso, e a leitura precisa seguir rápida mesmo com um texto colado por engano.
export const MAX_JOB_CHARS = 20_000;
export const MAX_JOB_LINES = 500;

interface Span {
  readonly start: number;
  readonly end: number;
  readonly term: CompiledTerm;
}

interface Found {
  readonly at: number;
  readonly kind: RequirementKind;
  readonly label: string;
  readonly minYears?: number;
}

interface SourceLine {
  readonly text: string;
  readonly importance: Importance;
}

function importanceOf(cls: RequirementClass): Importance {
  return cls === 'preferred' ? 'preferred' : 'required';
}

function totalLabel(years: number): string {
  return years === 1 ? '1 ano de experiência' : `${years} anos de experiência`;
}

function isTermKind(term: CompiledTerm): boolean {
  return KIND_BY_CATEGORY[term.category] === 'term';
}

/** Mesma regra da busca do dicionário (mais longo primeiro, sem sobrepor), mas guardando a posição de cada termo na linha. */
function termSpans(tokens: readonly string[]): Span[] {
  const spans: Span[] = [];
  for (let i = 0; i < tokens.length; i++) {
    for (let size = Math.min(MAX_PHRASE_TOKENS, tokens.length - i); size >= 1; size--) {
      const entry = DEV_DICTIONARY.phrases.get(size === 1 ? (tokens[i] ?? '') : tokens.slice(i, i + size).join(' '));
      const term = entry === undefined || entry.term < 0 ? undefined : DEV_DICTIONARY.terms[entry.term];
      if (term === undefined) continue;
      spans.push({ start: i, end: i + size, term });
      i += size - 1;
      break;
    }
  }
  return spans;
}

function spanToTheRight(tokens: readonly string[], unit: number, startingAt: ReadonlyMap<number, Span>): { span: Span; gap: number } | null {
  for (let at = unit + 1, gap = 0; gap <= GAP_LIMIT; at++, gap++) {
    const span = startingAt.get(at);
    if (span !== undefined) return { span, gap };
    if (!AFTER_YEARS.has(tokens[at] ?? '')) return null;
  }
  return null;
}

function spanToTheLeft(tokens: readonly string[], start: number, endingAt: ReadonlyMap<number, Span>): Span | null {
  for (let at = start, gap = 0; at > 0 && gap <= GAP_LIMIT; at--, gap++) {
    const span = endingAt.get(at);
    if (span !== undefined) return span;
    const token = tokens[at - 1] ?? '';
    if (!BEFORE_YEARS.has(token) && !DIGITS.test(token)) return null;
  }
  return null;
}

/** O termo de quem são os anos. Com preposição, vale o da direita ("5 anos de Java"); colado, o da esquerda ("Java 5 anos, React 3 anos"). */
function ownerOfYears(tokens: readonly string[], mention: YearsMention, startingAt: ReadonlyMap<number, Span>, endingAt: ReadonlyMap<number, Span>): Span | null {
  const right = spanToTheRight(tokens, mention.unit, startingAt);
  if (right !== null && right.gap > 0 && isTermKind(right.span.term)) return right.span;
  // "Python (3 anos)": o 3 ficou dentro do nome "python 3", que é sinônimo de Python.
  const left = endingAt.get(mention.unit) ?? spanToTheLeft(tokens, mention.start, endingAt);
  if (left !== null && isTermKind(left.term)) return left;
  return right !== null && isTermKind(right.span.term) ? right.span : null;
}

function isTotalExperience(tokens: readonly string[], mention: YearsMention, startingAt: ReadonlyMap<number, Span>, companyAt: number): boolean {
  if (companyAt < mention.start) return false;
  for (let at = mention.unit + 1, gap = 0; gap <= GAP_LIMIT; at++, gap++) {
    const token = tokens[at] ?? '';
    if (TOTAL_AFTER.has(token)) return true;
    // "5 anos como desenvolvedor": fala de carreira, e o cargo não aceita anos.
    if (startingAt.get(at)?.term.category === 'role') return true;
    if (!AFTER_YEARS.has(token)) break;
  }
  for (let at = mention.start - 1, gap = 0; at >= 0 && gap <= GAP_LIMIT; at--, gap++) {
    const token = tokens[at] ?? '';
    if (token === CLAUSE) break;
    if (TOTAL_BEFORE.has(token)) return true;
  }
  return false;
}

/** "Proficiência em Go", "APIs em Go e gRPC": a preposição diz que é o termo, e nada depois dele muda isso. */
function namedByLink(tokens: readonly string[], span: Span): boolean {
  if (NOT_NAMED_BY_LINK.has(span.term.canonical) || !NAMING_LINKS.has(tokens[span.start - 1] ?? '')) return false;
  const next = tokens[span.end];
  return next === undefined || next === CLAUSE || AFTER_NAMED.has(next);
}

/** Termos e anos de uma linha limpa, na ordem em que aparecem. Termo ambíguo sem contexto na vaga só conta se tiver anos ("5 anos de Go"). */
function readLine(text: string, confirmed: ReadonlySet<string>): Found[] {
  const marked = prepareYears(text).replace(CLAUSE_MARK, ` ${CLAUSE} `).replaceAll(':', ' ');
  const key = keyOf(marked, DEV_DICTIONARY.protect);
  if (key === '') return [];
  const tokens = key.split(' ');
  const spans = termSpans(tokens);
  const startingAt = new Map(spans.map((span) => [span.start, span] as const));
  const endingAt = new Map(spans.map((span) => [span.end, span] as const));

  // Procurado uma vez só por frase: com muitos "N anos", olhar de novo a cada um seria quadrático.
  const firstCompany = tokens.findIndex((token) => ABOUT_COMPANY.has(token));
  const companyAt = firstCompany < 0 ? Number.POSITIVE_INFINITY : firstCompany;
  const yearsOf = new Map<Span, number>();
  const found: Found[] = [];
  for (const mention of yearMentions(tokens)) {
    if (mention.value < MIN_YEARS_LOWEST || mention.value > MIN_YEARS_HIGHEST) continue;
    const owner = ownerOfYears(tokens, mention, startingAt, endingAt);
    if (owner !== null) {
      yearsOf.set(owner, Math.max(yearsOf.get(owner) ?? 0, mention.value));
    } else if (isTotalExperience(tokens, mention, startingAt, companyAt)) {
      found.push({ at: mention.start, kind: 'total_experience', label: totalLabel(mention.value), minYears: mention.value });
    }
  }
  for (const span of spans) {
    const years = yearsOf.get(span);
    if (span.term.requires.length > 0 && years === undefined && !confirmed.has(span.term.canonical) && !namedByLink(tokens, span)) continue;
    found.push({ at: span.start, kind: KIND_BY_CATEGORY[span.term.category], label: span.term.canonical, ...(years === undefined ? {} : { minYears: years }) });
  }
  return found.sort((a, b) => a.at - b.at);
}

/** O trecho que será lido: no máximo MAX_JOB_LINES linhas e MAX_JOB_CHARS caracteres, sem partir linha se houver como evitar. */
function readablePart(jobText: string): string {
  const head = jobText.slice(0, MAX_JOB_CHARS);
  let lastBreak = -1;
  let lines = 0;
  for (let at = head.indexOf('\n'); at >= 0; at = head.indexOf('\n', at + 1)) {
    lastBreak = at;
    lines++;
    if (lines === MAX_JOB_LINES) return head.slice(0, at);
  }
  return jobText.length > MAX_JOB_CHARS && lastBreak >= 0 ? head.slice(0, lastBreak) : head;
}

function isOffTopicTitle(text: string): boolean {
  return OFF_TOPIC_TITLES.has(normalize(text));
}

function isPreferredTitle(text: string): boolean {
  return PREFERRED_TITLES.has(normalize(text));
}

/** As frases de uma linha, como escritas, cada uma com o sinal que a fecha. */
function sentencesOf(line: string): string[] {
  const sentences: string[] = [];
  let start = 0;
  for (const match of line.matchAll(SENTENCE_END)) {
    const end = match.index + match[0].length;
    const sentence = line.slice(start, end).trim();
    if (HAS_WORD.test(sentence)) sentences.push(sentence);
    start = end;
  }
  const rest = line.slice(start).trim();
  if (HAS_WORD.test(rest)) sentences.push(rest);
  return sentences;
}

/** O rótulo antes dos dois-pontos, se a linha tem um, e o que vem depois. */
function splitLabel(text: string): { label: string | null; body: string } {
  const colon = text.indexOf(':');
  if (colon < 0 || colon > MAX_LABEL_CHARS) return { label: null, body: text };
  return { label: text.slice(0, colon), body: text.slice(colon + 1) };
}

/** Classe do rótulo na mesma linha: "Diferenciais: Kafka". Sem rótulo conhecido, vale a de quem veio antes. */
function classOfLabel(label: string | null, inherited: RequirementClass): RequirementClass {
  if (label === null) return inherited;
  if (isPreferredTitle(label)) return 'preferred';
  const cls = classifyHeading(label);
  return cls === 'mentioned' ? inherited : cls;
}

/** Classe de uma frase: quem nega a obrigação primeiro, porque o léxico leria "não obrigatório" como obrigatório. */
function classOfSentence(sentence: string, inherited: RequirementClass): RequirementClass {
  return NOT_REQUIRED.test(normalize(sentence)) ? 'preferred' : classifyItem(sentence, inherited);
}

/** Os termos que a frase designa por ser, inteira, um termo ou uma lista curta deles: "Go", "Go, Rust, Kubernetes", "Stack: Go". */
function designatedTerms(sentence: string): string[] {
  if (sentence.length > MAX_LIST_CHARS) return [];
  const { label, body } = splitLabel(sentence);
  const text = (body.trim() === '' && label !== null ? label : body).replace(/\s+/gu, ' ');
  const pieces = text.split(LIST_SEPARATOR).map((piece) => piece.replace(LIST_EDGES, '')).filter((piece) => piece !== '');
  if (pieces.length === 0 || pieces.length > MAX_LIST_ITEMS) return [];
  const names: string[] = [];
  for (const piece of pieces) {
    const name = canonicalOf(piece);
    if (name === null) return [];
    names.push(name);
  }
  return names;
}

/** Separa as frases que servem de fonte das que caíram na trava. Seção fora de assunto é conferida pela trava, mas não vira fonte. */
function sortLines(jobText: string): { sources: SourceLine[]; ignored: IgnoredLine[] } {
  const sources: SourceLine[] = [];
  const ignored: IgnoredLine[] = [];
  // Uma consulta à trava por frase diferente, para o custo seguir linear em texto com muita repetição.
  const verdicts = new Map<string, ReturnType<typeof findForbidden>[number] | null>();
  const clean = (text: string): boolean => {
    const known = verdicts.get(text);
    if (known !== undefined) return known === null;
    const hit = findForbidden(text)[0] ?? null;
    verdicts.set(text, hit);
    // A mesma frase repetida gera um aviso só.
    if (hit !== null) ignored.push({ line: text, topic: hit.topic, reason: hit.reason });
    return hit === null;
  };
  const read = (line: string, inherited: RequirementClass, offTopic: boolean): void => {
    let cls = inherited;
    for (const sentence of sentencesOf(line)) {
      const { label } = splitLabel(sentence);
      cls = classOfLabel(label, cls);
      const skip = label !== null && isOffTopicTitle(label);
      if (clean(sentence) && !offTopic && !skip) sources.push({ text: sentence, importance: importanceOf(classOfSentence(sentence, cls)) });
    }
  };
  for (const block of splitRequirementBlocks(jobText)) {
    let offTopic = block.heading !== null && isOffTopicTitle(block.heading);
    let blockClass: RequirementClass = block.class;
    if (block.heading !== null) {
      const { label, body } = splitLabel(block.heading);
      if (isPreferredTitle(label ?? body)) blockClass = 'preferred';
      read(block.heading, block.class, offTopic);
    }
    for (const item of block.items) {
      if (isOffTopicTitle(item.text)) offTopic = true;
      else if (isPreferredTitle(item.text)) blockClass = 'preferred';
      read(item.text, blockClass, offTopic);
    }
  }
  return { sources, ignored };
}

function merged(current: Requirement, next: Requirement): Requirement {
  const importance: Importance = current.importance === 'required' || next.importance === 'required' ? 'required' : 'preferred';
  const minYears = Math.max(current.minYears ?? 0, next.minYears ?? 0);
  return {
    ...current,
    importance,
    ...(minYears > 0 ? { minYears } : {}),
    ...(current.id === TOTAL_EXPERIENCE_ID ? { label: totalLabel(minYears) } : {}),
  };
}

/**
 * Lê a vaga e sugere requisitos, na ordem de leitura e sem repetir: o termo que aparece mais de uma vez fica com a classe
 * mais forte e o maior mínimo. Texto fora de bloco reconhecido conta como obrigatório, porque a pessoa revisa depois. Item que é,
 * inteiro, um termo designa o termo, mesmo ambíguo: "Go" sozinho num item de lista é a linguagem.
 * Passou de 30 (RF-12), os novos ficam de fora, mas um termo já aceito ainda pode subir de classe ou de mínimo.
 */
export function extractRequirements(jobText: string): ExtractedRequirements {
  if (typeof jobText !== 'string' || jobText.length === 0) return { requirements: [], ignored: [], truncated: false, needsManualEntry: true };
  const readable = readablePart(jobText);
  const { sources, ignored } = sortLines(readable);
  // O contexto dos termos ambíguos vale no texto inteiro, mas só no que sobrou: linha barrada não serve de prova.
  const confirmed = new Set(findTerms(sources.map((source) => source.text).join('\n')).map((hit) => hit.canonical));
  for (const source of sources) {
    for (const name of designatedTerms(source.text)) confirmed.add(name);
  }

  const collected = new Map<string, Requirement>();
  // A trava e a consulta ao dicionário rodam uma vez por nome, para o custo seguir linear em texto com muita repetição.
  const madeOnce = new Map<string, Requirement | null>();
  const make = (found: Found): Requirement | null => {
    const key = `${found.kind}:${found.label}`;
    let made = madeOnce.get(key);
    if (made === undefined) {
      const result = makeRequirement({ kind: found.kind, label: found.label, importance: 'required', ...(found.kind === 'total_experience' ? { minYears: found.minYears ?? 0 } : {}) });
      made = result.ok ? result.requirement : null;
      madeOnce.set(key, made);
    }
    return made;
  };

  for (const source of sources) {
    for (const found of readLine(source.text, confirmed)) {
      const base = make(found);
      if (base === null) continue;
      const requirement: Requirement = { ...base, importance: source.importance, ...(found.minYears === undefined ? {} : { minYears: found.minYears }) };
      const current = collected.get(requirement.id);
      if (current !== undefined) collected.set(requirement.id, merged(current, requirement));
      else if (collected.size < MAX_REQUIREMENTS) collected.set(requirement.id, requirement);
    }
  }
  // Só espaço depois do corte não é texto perdido.
  const truncated = readable.length < jobText.length && /\S/u.test(jobText.slice(readable.length));
  return { requirements: [...collected.values()], ignored, truncated, needsManualEntry: collected.size === 0 };
}
