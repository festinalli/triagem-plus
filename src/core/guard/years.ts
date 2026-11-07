// Limites escritos com número (RF-13, RF-14): "até 35 anos" é idade; "até 5 anos de experiência" é teto de experiência;
// "pelo menos 5 anos" é mínimo e passa (DP-04). Tudo roda sobre palavras já normalizadas, em uma passada, sem expressão
// que possa travar em texto longo. Número sem "anos" não dispara, com as exceções declaradas em BARE_AGE_TRIGGERS.
import { PERSON_WORDS_EN, PERSON_WORDS_PT } from './lexicon.ts';
import type { ForbiddenTopic } from './topics.ts';

/** Trecho que caiu na trava, em índices de palavra: de start até antes de end. */
export interface GuardSpan {
  readonly topic: ForbiddenTopic;
  readonly start: number;
  readonly end: number;
}

/** Um número seguido de unidade de ano: start é a primeira palavra do número e unit é a palavra "anos". */
export interface YearsMention {
  readonly value: number;
  readonly start: number;
  readonly unit: number;
}

/** Palavra que marca quebra de linha num texto longo. Nenhuma expressão a atravessa. */
export const LINE_MARK = '\uA66E';

/** A partir daqui, um limite sem a palavra "experiência" é lido como idade. Abaixo, não pode ser idade de quem trabalha. */
const ADULT_AGE = 16;
const BARE_AGE_MAX = 79;

const YEAR_UNIT = '(?:anos?|years?|yrs?)(?![\\p{L}\\p{N}])';
// Corrida de espaços vira um espaço só antes dos padrões. É isto que mantém o custo linear: daqui em diante cada padrão olha
// no máximo um espaço de cada lado, e não existe espaço opcional sobreposto para retroceder.
const WHITESPACE = /[\s\u0085]+/gu;
// "5anos" e "10km": número colado na unidade.
const GLUED_UNIT = /(\d)(anos?|years?|yrs?|yo|kms?)(?![\p{L}\p{N}])/giu;
// "3,5 anos": a normalização tiraria a vírgula e leria 35. Fica a parte inteira.
const DECIMAL_YEARS = new RegExp(`(\\d)[.,]\\d{1,3}(?= ?\\+? ?${YEAR_UNIT})`, 'giu');
// "25-35 anos" e "25–35 anos": a normalização leria "25 35" ou até "2535". Vira "25 a 35".
const DASHED_YEARS = new RegExp(`(\\d{1,3}) ?[-‐‑–—~] ?(\\d{1,3})(?= ?\\+? ?${YEAR_UNIT})`, 'giu');

// "3-5 YOE" é "3-5 anos de experiência", dito pela sigla.
const YOE = /(?<![\p{L}\p{N}])y\.?o\.?e\.?(?![\p{L}\p{N}])/giu;
// "<5 anos": o sinal sumiria na normalização, e sobraria "5 anos", que é mínimo.
const LESS_THAN = /[<≤]=? ?(?=\d)/gu;
// "50+" sem "anos" depois: o sinal também sumiria. Com "anos" é mínimo de experiência e fica como está.
const AND_OVER = new RegExp(`(\\d\\d)\\+(?! ?${YEAR_UNIT})`, 'giu');

/** Acerta, no texto original, o que a normalização destruiria perto de "anos". Passa antes de normalize. Custo linear. */
export function prepareYears(raw: string): string {
  return raw
    .replace(WHITESPACE, ' ')
    .replace(YOE, 'anos de experiencia')
    .replace(LESS_THAN, 'menos de ')
    .replace(GLUED_UNIT, '$1 $2')
    .replace(DECIMAL_YEARS, '$1')
    .replace(DASHED_YEARS, '$1 a $2')
    .replace(AND_OVER, '$1 mais ');
}

const YEAR_UNITS: ReadonlySet<string> = new Set(['ano', 'anos', 'year', 'years', 'yr', 'yrs']);
const DIGITS = /^\d{1,3}$/;

const WORD_NUMBERS: ReadonlyMap<string, number> = new Map([
  ['um', 1], ['uma', 1], ['dois', 2], ['duas', 2], ['tres', 3], ['quatro', 4], ['cinco', 5], ['seis', 6], ['sete', 7], ['oito', 8], ['nove', 9],
  ['dez', 10], ['onze', 11], ['doze', 12], ['treze', 13], ['quatorze', 14], ['catorze', 14], ['quinze', 15], ['dezesseis', 16], ['dezessete', 17],
  ['dezoito', 18], ['dezenove', 19], ['vinte', 20], ['trinta', 30], ['quarenta', 40], ['cinquenta', 50], ['sessenta', 60],
  ['one', 1], ['two', 2], ['three', 3], ['four', 4], ['five', 5], ['six', 6], ['seven', 7], ['eight', 8], ['nine', 9], ['ten', 10], ['eleven', 11],
  ['twelve', 12], ['thirteen', 13], ['fourteen', 14], ['fifteen', 15], ['sixteen', 16], ['seventeen', 17], ['eighteen', 18], ['nineteen', 19],
  ['twenty', 20], ['thirty', 30], ['forty', 40], ['fifty', 50], ['sixty', 60],
]);

function numberEndingAt(tokens: readonly string[], index: number): { value: number; start: number } | null {
  const token = tokens[index];
  if (token === undefined) return null;
  if (DIGITS.test(token)) return { value: Number(token), start: index };
  const value = WORD_NUMBERS.get(token);
  if (value === undefined) return null;
  if (value < 10) {
    // "trinta e cinco", "thirty five".
    const tensAt = tokens[index - 1] === 'e' || tokens[index - 1] === 'and' ? index - 2 : index - 1;
    const tens = WORD_NUMBERS.get(tokens[tensAt] ?? '');
    if (tens !== undefined && tens >= 20 && tens % 10 === 0) return { value: tens + value, start: tensAt };
  }
  return { value, start: index };
}

/** Toda ocorrência de número seguido de "anos" ou "years", na ordem do texto. */
export function yearMentions(tokens: readonly string[]): YearsMention[] {
  const mentions: YearsMention[] = [];
  for (let i = 1; i < tokens.length; i++) {
    if (!YEAR_UNITS.has(tokens[i] ?? '')) continue;
    const number = numberEndingAt(tokens, i - 1);
    if (number !== null) mentions.push({ value: number.value, start: number.start, unit: i });
  }
  return mentions;
}

function phrases(list: readonly string[]): readonly (readonly string[])[] {
  return list.map((phrase) => phrase.split(' ')).sort((a, b) => b.length - a.length);
}

// Teto: o número que vem depois é o máximo.
const CEILING_BEFORE = phrases([
  'ate', 'ate os', 'ate aos', 'ate no maximo', 'no maximo', 'maximo', 'maximo de', 'maxima', 'maxima de', 'no max', 'max', 'max de', 'nao mais que', 'nao mais de', 'nao mais do que',
  'nao superior a', 'teto de', 'limite de', 'up to', 'at most', 'no more than', 'not more than', 'not exceeding', 'maximum', 'maximum of', 'max of',
  'nao pode ter mais de', 'nao pode ter mais que', 'nao ter mais de', 'nao ter mais que', 'nao deve ter mais de', 'sem mais de', 'cannot have more than', 'must not have more than', 'should not have more than', 'nao ultrapassar', 'nao ultrapasse', 'nao exceder', 'nao exceda',
  'limitada a', 'limitado a', 'limitados a', 'limitadas a', 'capped at', 'no maximo de',
]);
// Teto dito por baixo. Negado, vira mínimo: "não menos de 5 anos", "no less than 5 years", "pelo menos de 5 anos".
const BELOW = phrases([
  'menos de', 'menos que', 'menos do que', 'inferior a', 'inferiores a', 'abaixo de', 'menor de', 'menores de', 'menor que', 'menores que',
  'mais novo que', 'mais nova que', 'mais novos que', 'mais novas que', 'mais jovem que', 'mais jovens que',
  'less than', 'fewer than', 'under', 'below', 'younger than',
]);
const BELOW_NEGATED: ReadonlySet<string> = new Set(['nao', 'no', 'not', 'pelo', 'ao']);
const CEILING_AFTER = phrases(['no maximo', 'maximo', 'max', 'maximum', 'at most', 'ou menos', 'or less', 'or fewer', 'tops']);
// Idade dita como mínimo: "maior de 18 anos". Com "experiência" é mínimo de experiência e passa.
const OLDER = phrases(['maior de', 'maiores de', 'maior que', 'maiores que', 'acima de', 'mais velho que', 'mais velha que', 'mais velhos que', 'mais velhas que', 'above', 'older than']);
// Termo digitado que é só idade: "35 anos", "mais de 35 anos". Em frase isso não dispara: "empresa com mais de 30 anos".
const BARE_TERM_LEAD = phrases(['mais de', 'acima de', 'over', 'above', 'a partir de', 'pelo menos', 'ao menos', 'at least', 'minimo', 'minimo de', 'no minimo', 'com']);

const EXPERIENCE: ReadonlySet<string> = new Set(['experiencia', 'experiencias', 'experience', 'exp', 'xp', 'atuacao', 'vivencia', 'carreira', 'senioridade']);
const AFTER_YEARS: ReadonlySet<string> = new Set(['de', 'em', 'na', 'no', 'of', 'in', 'as', 'como', 'atuando', 'trabalhando', 'working', 'using', 'usando']);
const NOT_WORK: ReadonlySet<string> = new Set(['idade', 'age', 'vida', 'nascimento', 'maximo']);

// Prazo de contrato, de benefício ou de empresa, não de quem se candidata: "contrato de até 2 anos", "filhos de até 5 anos".
// Palavras que também dão nome a cargo ficam de fora: "analista de dados até 35 anos" é idade.
const NOT_ABOUT_PERSON: ReadonlySet<string> = new Set([
  'contrato', 'contratos', 'contract', 'contracts', 'projeto', 'projetos', 'project', 'projects', 'prazo', 'prazos', 'duracao', 'duration', 'vigencia', 'periodo', 'period', 'garantia', 'warranty', 'mandato',
  'plano', 'planos', 'programa', 'programas', 'financiamento', 'parcelamento', 'carencia', 'empresa', 'empresas', 'company', 'companies', 'startup', 'startups', 'fundada', 'founded', 'filho', 'filhos', 'filha',
  'filhas', 'crianca', 'criancas', 'child', 'children', 'kid', 'kids', 'dependente', 'dependentes', 'creche', 'auxilio', 'bolsa', 'licenca', 'beneficio',
  'reembolso', 'retencao', 'retention', 'historico', 'historicos', 'history', 'logs', 'log', 'vesting', 'cliff', 'backup', 'backups', 'registros', 'records', 'arquivos', 'auditoria', 'armazenamento', 'seguro',
]);
// Dado também tem prazo, mas "dados" nomeia cargo: "analista de dados de até 30 anos" é idade.
const THINGS_WITH_A_LINK: ReadonlySet<string> = new Set(['dados', 'data', 'mensagens', 'documentos']);
const PERSON: ReadonlySet<string> = new Set([...PERSON_WORDS_PT, ...PERSON_WORDS_EN]);
const TIME_HORIZON: ReadonlySet<string> = new Set(['em', 'ha', 'dentro', 'within', 'in', 'por', 'for']);
// O dono do prazo vem colado: "contrato de até 2 anos". Mais longe não vale: "programa de trainee para até 28 anos" é idade.
const OWNER_LINKS: ReadonlySet<string> = new Set(['de', 'of', 'com', 'with']);
const EXPERIENCE_WINDOW = 4;

function matchesAt(tokens: readonly string[], at: number, phrase: readonly string[]): boolean {
  if (at < 0) return false;
  return phrase.every((word, k) => tokens[at + k] === word);
}

function phraseEndingAt(tokens: readonly string[], end: number, list: readonly (readonly string[])[]): number | null {
  for (const phrase of list) {
    if (matchesAt(tokens, end - phrase.length, phrase)) return end - phrase.length;
  }
  return null;
}

/** Começo de "entre 25 e 35 anos", "de 25 a 35 anos", "25 a 35 anos", "2 to 5 years". */
function rangeStart(tokens: readonly string[], mention: YearsMention): number | null {
  const joiner = tokens[mention.start - 1];
  if (joiner !== 'a' && joiner !== 'aos' && joiner !== 'ate' && joiner !== 'to' && joiner !== 'e' && joiner !== 'and') return null;
  // "entre 5 anos e 10 anos" tem a unidade repetida.
  const low = numberEndingAt(tokens, YEAR_UNITS.has(tokens[mention.start - 2] ?? '') ? mention.start - 3 : mention.start - 2);
  if (low === null || low.value >= mention.value) return null;
  const before = tokens[low.start - 1];
  const opened = before === 'entre' || before === 'between';
  if ((joiner === 'e' || joiner === 'and') && !opened) return null;
  return opened || before === 'de' || before === 'dos' || before === 'from' ? low.start - 1 : low.start;
}

function belowStart(tokens: readonly string[], at: number): number | null {
  const start = phraseEndingAt(tokens, at, BELOW);
  if (start === null || BELOW_NEGATED.has(tokens[start - 1] ?? '')) return null;
  return start;
}

function afterExperienceWords(tokens: readonly string[], unit: number): number {
  const next = unit + 1;
  if ((tokens[next] === 'de' || tokens[next] === 'of') && EXPERIENCE.has(tokens[next + 1] ?? '')) return next + 2;
  return EXPERIENCE.has(tokens[next] ?? '') ? next + 1 : next;
}

function ceilingAfter(tokens: readonly string[], unit: number): number | null {
  const at = afterExperienceWords(tokens, unit);
  for (const phrase of CEILING_AFTER) {
    if (matchesAt(tokens, at, phrase)) return at + phrase.length;
  }
  return null;
}

function statesAge(tokens: readonly string[], unit: number): boolean {
  const next = tokens[unit + 1];
  if (next === 'old') return true;
  return (next === 'de' || next === 'of') && (tokens[unit + 2] === 'idade' || tokens[unit + 2] === 'age');
}

function speaksOfWork(tokens: readonly string[], start: number, unit: number): boolean {
  const next = tokens[unit + 1] ?? '';
  if (EXPERIENCE.has(next)) return true;
  const object = tokens[unit + 2];
  if (AFTER_YEARS.has(next) && object !== undefined && !NOT_WORK.has(object) && !NOT_ABOUT_PERSON.has(object)) return true;
  for (let i = start - 1; i >= 0 && i >= start - EXPERIENCE_WINDOW; i--) {
    const token = tokens[i] ?? '';
    if (token === LINE_MARK) break;
    if (EXPERIENCE.has(token)) return true;
  }
  return false;
}

/** O prazo é de uma coisa nomeada logo antes: "histórico de até 10 anos", "vesting de até 4 anos". */
function ownedByThing(tokens: readonly string[], start: number): boolean {
  const before = tokens[start - 1] ?? '';
  if (NOT_ABOUT_PERSON.has(before)) return true;
  if (!OWNER_LINKS.has(before)) return false;
  const owner = tokens[start - 2] ?? '';
  if (NOT_ABOUT_PERSON.has(owner)) return true;
  return THINGS_WITH_A_LINK.has(owner) && !PERSON.has(tokens[start - 4] ?? '');
}

function notAboutPerson(tokens: readonly string[], start: number, unit: number): boolean {
  if (TIME_HORIZON.has(tokens[start - 1] ?? '') || ownedByThing(tokens, start)) return true;
  return AFTER_YEARS.has(tokens[unit + 1] ?? '') && NOT_ABOUT_PERSON.has(tokens[unit + 2] ?? '');
}

function namesExperience(tokens: readonly string[], unit: number): boolean {
  return afterExperienceWords(tokens, unit) > unit + 1;
}

function classify(tokens: readonly string[], mention: YearsMention): GuardSpan | null {
  const opening = rangeStart(tokens, mention) ?? phraseEndingAt(tokens, mention.start, CEILING_BEFORE) ?? belowStart(tokens, mention.start);
  const closing = ceilingAfter(tokens, mention.unit);
  if (opening === null && closing === null) {
    const older = phraseEndingAt(tokens, mention.start, OLDER);
    if (older === null || mention.value < ADULT_AGE || speaksOfWork(tokens, older, mention.unit)) return null;
    return { topic: 'age', start: older, end: mention.unit + 1 };
  }
  const start = opening ?? mention.start;
  if (statesAge(tokens, mention.unit)) return { topic: 'age', start, end: mention.unit + (tokens[mention.unit + 1] === 'old' ? 2 : 3) };
  const end = closing ?? afterExperienceWords(tokens, mention.unit);
  if (ownedByThing(tokens, start) && !namesExperience(tokens, mention.unit)) return null;
  const work = speaksOfWork(tokens, start, mention.unit);
  if (!work && notAboutPerson(tokens, start, mention.unit)) return null;
  return { topic: !work && mention.value >= ADULT_AGE ? 'age' : 'max_experience', start, end };
}

// Exceções à regra do "anos": a expressão só existe para idade. "under 35" e "menor de 30" precisam de um fim de frase ou
// de uma palavra de ligação depois do número, para "under 30 ms" e "menor de 30 segundos" não dispararem.
const BARE_AGE_TRIGGERS = phrases([
  'under', 'over', 'sub', 'menor de', 'menores de', 'maior de', 'maiores de', 'younger than', 'older than',
  'mais novo que', 'mais nova que', 'mais novos que', 'mais novas que', 'mais jovem que', 'mais jovens que',
  'mais velho que', 'mais velha que', 'mais velhos que', 'mais velhas que',
]);
const BARE_AGE_FIRST: ReadonlySet<string> = new Set(BARE_AGE_TRIGGERS.map((phrase) => phrase[0] ?? ''));
const BARE_AGE_FOLLOW: ReadonlySet<string> = new Set([LINE_MARK, 'somente', 'apenas', 'only', 'com', 'with', 'e', 'and', 'ou', 'or', 'para', 'for', 'que', 'sem', 'without', 'who']);
const STATED_AGE: ReadonlySet<string> = new Set(['aged', 'age', 'ages']);
// "under 35" em frase só é idade se fala de gente: "keep latency under 50" e "Kubernetes over 50" não são.
const EASILY_NOT_AGE: ReadonlySet<string> = new Set(['under', 'over', 'sub']);
const BEFORE_BARE_AGE: ReadonlySet<string> = new Set([LINE_MARK, 'be', 'is', 'are', 'vaga', 'vagas', 'requisito', 'requisitos', 'requirement', 'requirements', 'only', 'somente', 'apenas', 'aged', 'age', 'idade', 'preferably', 'preferencialmente', 'para', 'for', 'and', 'or', 'e', 'ou', 'with', 'com']);
// "candidatos com menos de 35", "pessoas de até 35": teto sem "anos", com a pessoa logo antes.
const BARE_CEILINGS = phrases(['menos de', 'abaixo de', 'ate', 'no maximo', 'maximo de', 'below', 'up to', 'at most', 'less than']);
const BARE_RANGE_OPENERS: ReadonlySet<string> = new Set(['de', 'entre', 'between', 'from', 'dos']);
const BARE_RANGE_JOINERS: ReadonlySet<string> = new Set(['a', 'e', 'to', 'and', 'ate', 'aos']);
const PERSON_LINKS: ReadonlySet<string> = new Set(['com', 'de', 'with', 'of', 'who', 'are', 'that', 'aged']);

function bareAgeNumber(tokens: readonly string[], numberAt: number): boolean {
  const token = tokens[numberAt];
  if (token === undefined || !DIGITS.test(token)) return false;
  const value = Number(token);
  return value >= ADULT_AGE && value <= BARE_AGE_MAX;
}

const DISTANCE_UNITS: ReadonlySet<string> = new Set(['km', 'kms', 'quilometro', 'quilometros', 'kilometer', 'kilometers', 'kilometre', 'kilometres', 'mile', 'miles', 'milha', 'milhas']);
const DISTANCE_BEFORE = phrases(['ate', 'no maximo', 'maximo de', 'raio de', 'within', 'up to', 'at most', 'menos de', 'less than']);
// Acima disso não é ida e volta do trabalho: é autonomia de veículo, alcance de sinal, rota de entrega.
const LONGEST_COMMUTE_KM = 100;

function personBefore(tokens: readonly string[], at: number): boolean {
  const before = tokens[at - 1] ?? '';
  return PERSON.has(before) || (PERSON_LINKS.has(before) && PERSON.has(tokens[at - 2] ?? ''));
}

/** "candidatos com menos de 35", "pessoas entre 25 e 35", "profissionais 50+". */
function bareAgeAfterPerson(tokens: readonly string[], at: number): GuardSpan | null {
  const token = tokens[at] ?? '';
  if (DIGITS.test(token) && tokens[at + 1] === 'mais' && personBefore(tokens, at) && bareAgeNumber(tokens, at)) return { topic: 'age', start: at, end: at + 2 };
  if (BARE_RANGE_OPENERS.has(token) && personBefore(tokens, at) && bareAgeNumber(tokens, at + 1) && BARE_RANGE_JOINERS.has(tokens[at + 2] ?? '') && bareAgeNumber(tokens, at + 3)) {
    const follow = tokens[at + 4];
    if (follow === undefined || BARE_AGE_FOLLOW.has(follow)) return { topic: 'age', start: at, end: at + 4 };
  }
  for (const ceiling of BARE_CEILINGS) {
    if (!matchesAt(tokens, at, ceiling) || !personBefore(tokens, at)) continue;
    const numberAt = at + ceiling.length;
    const follow = tokens[numberAt + 1];
    if (bareAgeNumber(tokens, numberAt) && (follow === undefined || BARE_AGE_FOLLOW.has(follow))) return { topic: 'age', start: at, end: numberAt + 1 };
  }
  return null;
}

/**
 * Todos os limites com número de um trecho: idade, teto de experiência e distância. Em termo digitado (`typed`), "under 35" conta
 * em qualquer posição, porque não há frase em volta para dizer que é outra coisa.
 */
export function findNumericLimits(tokens: readonly string[], typed = false): GuardSpan[] {
  const spans: GuardSpan[] = [];
  for (const mention of yearMentions(tokens)) {
    const span = classify(tokens, mention);
    if (span !== null) spans.push(span);
  }
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i] ?? '';
    if (STATED_AGE.has(token) && bareAgeNumber(tokens, i + 1)) spans.push({ topic: 'age', start: i, end: i + 2 });
    if (token === 'yo' && numberEndingAt(tokens, i - 1) !== null) spans.push({ topic: 'age', start: i - 1, end: i + 1 });
    const distance = DISTANCE_UNITS.has(token) ? numberEndingAt(tokens, i - 1) : null;
    if (distance !== null && (typed || distance.value <= LONGEST_COMMUTE_KM)) {
      const start = phraseEndingAt(tokens, i - 1, DISTANCE_BEFORE);
      if (start !== null) spans.push({ topic: 'address_distance', start, end: i + 1 });
    }
    const bare = bareAgeAfterPerson(tokens, i);
    if (bare !== null) spans.push(bare);
    if (!BARE_AGE_FIRST.has(token)) continue;
    if (!typed && EASILY_NOT_AGE.has(token) && i > 0 && !BEFORE_BARE_AGE.has(tokens[i - 1] ?? '') && !PERSON.has(tokens[i - 1] ?? '')) continue;
    for (const phrase of BARE_AGE_TRIGGERS) {
      if (!matchesAt(tokens, i, phrase)) continue;
      const numberAt = i + phrase.length;
      const follow = tokens[numberAt + 1];
      if (bareAgeNumber(tokens, numberAt) && (follow === undefined || BARE_AGE_FOLLOW.has(follow))) spans.push({ topic: 'age', start: i, end: numberAt + 1 });
      break;
    }
  }
  return spans;
}

/** Termo digitado que é só uma distância: "5 km". */
export function bareDistanceTerm(tokens: readonly string[]): GuardSpan | null {
  if (tokens.length !== 2 || !DISTANCE_UNITS.has(tokens[1] ?? '') || numberEndingAt(tokens, 0) === null) return null;
  return { topic: 'address_distance', start: 0, end: 2 };
}

/** Termo digitado que é só uma idade com sinal: "50+", "+50". Sem o sinal, "50" é só um número. */
export function barePlusAge(raw: string): boolean {
  const match = /^\s*(?:\+(\d\d)|(\d\d)\+)\s*$/u.exec(raw);
  const value = Number(match?.[1] ?? match?.[2] ?? 0);
  return value >= ADULT_AGE && value <= BARE_AGE_MAX;
}

/** Termo digitado que é só uma idade: "35 anos", "mais de 35 anos", "over 35 years". */
export function bareAgeTerm(tokens: readonly string[]): GuardSpan | null {
  const unit = tokens.length - 1;
  if (!YEAR_UNITS.has(tokens[unit] ?? '')) return null;
  const number = numberEndingAt(tokens, unit - 1);
  if (number === null || number.value < ADULT_AGE) return null;
  const whole = number.start === 0 || phraseEndingAt(tokens, number.start, BARE_TERM_LEAD) === 0;
  return whole ? { topic: 'age', start: 0, end: tokens.length } : null;
}
