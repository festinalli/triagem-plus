// O nome é o único dado do cabeçalho que fica (RF-44). A regra é conservadora: se a primeira linha não parecer um
// nome, o resultado é nulo e a pessoa digita. Um título profissional ou uma cidade guardados como nome seriam pior do
// que nome nenhum, porque o nome vai para a lista.
import { normalize } from '../text/normalize.ts';
import { isKnownPlace } from './places.ts';
import { isHiddenTextLine, isListCutLine, isPageNoiseLine, titleRole } from './sections.ts';

const MAX_NAME_LINE = 160;
const MAX_NAME_CHARS = 80;
const MAX_NAME_WORDS = 7;

// Qualquer parêntese sai junto: "(Ela/Dela)", "(she/her)", e também o que mais alguém tenha posto ali.
const BRACKETED = /[(\[{][^)\]}]*[)\]}]/gu;
const PRONOUN = '(?:ele|dele|ela|dela|elu|delu|ile|dile|he|him|his|she|her|hers|they|them|their|theirs|ze|hir|xe|xem)';
// Par ou trio com barra, com ou sem separador antes: "Ana Souza, Ela/Dela", "Ana Souza He/Him/His".
const PRONOUN_SET = new RegExp(`[\\s,;:]*(?<!\\p{L})${PRONOUN}(?:\\s*/\\s*${PRONOUN})+(?!\\p{L})`, 'giu');
// Tudo depois de um separador sai: pronomes, grau de conexão, título. Hífen só conta com espaço, por "Ana-Maria".
const SEPARATOR = /\s*[·•|‧∙⋅]\s*|\s+[-–—]\s+/u;
// Selos em forma de símbolo: visto de verificação, escudo, emoji.
const BADGE = /[\p{So}\p{Sk}\p{Extended_Pictographic}\u20E3]/gu;
// Selo ou grau de conexão escritos sem separador, no fim da linha.
const TRAILING_TAGS = /(?:\s+(?:perfil verificado|conta verificada|verificad[oa]|verified profile|verified|premium|conex[aã]o de [123][ºª°o]? grau|[123](?:º|ª|°|o|st|nd|rd|th)\+?(?:\s+(?:grau|degree(?:\s+connection)?))?))+$/iu;

const PARTICLES: ReadonlySet<string> = new Set([
  'de', 'da', 'do', 'das', 'dos', 'e', 'di', 'du', 'del', 'della', 'la', 'le', 'van', 'von', 'der', 'den', 'y', 'bin', 'ibn', 'al', 'el',
]);

// Com letra maiúscula, um cargo ou um botão têm a mesma forma de um nome. Quem tiver um destes sobrenomes fica sem
// nome automático e digita: é o lado seguro do erro.
const NOT_NAME_WORDS: ReadonlySet<string> = new Set([
  'desenvolvedor', 'desenvolvedora', 'engenheiro', 'engenheira', 'analista', 'arquiteto', 'arquiteta', 'programador',
  'programadora', 'consultor', 'consultora', 'gerente', 'coordenador', 'coordenadora', 'lider', 'especialista', 'diretor',
  'diretora', 'recrutador', 'recrutadora', 'estagiario', 'estagiaria', 'senior', 'pleno', 'plena', 'junior', 'profissional',
  'developer', 'engineer', 'architect', 'programmer', 'consultant', 'manager', 'recruiter', 'specialist', 'director',
  'lead', 'tech', 'software', 'backend', 'frontend', 'fullstack', 'stack', 'devops', 'qa', 'cto', 'ceo',
  'perfil', 'profile', 'contato', 'contact', 'seguir', 'follow', 'seguidores', 'followers', 'mensagem', 'mensagens', 'message',
  'conectar', 'connect', 'conexoes', 'connections', 'disponivel', 'open', 'linkedin', 'curriculo', 'experiencia', 'experience',
  'inicio', 'home', 'vagas', 'jobs', 'rede', 'notificacoes', 'pular', 'skip', 'voltar', 'visualizacoes',
]);

// Condição, pronome ou selo escritos sem separador, no fim da linha (RF-44). O nome é só o nome.
const TRAILING_WORDS: ReadonlySet<string> = new Set([
  'ela', 'dela', 'ele', 'dele', 'elu', 'delu', 'she', 'her', 'hers', 'he', 'him', 'his', 'they', 'them', 'their', 'theirs',
  'pcd', 'pwd', 'deficiente', 'cadeirante', 'surda', 'surdo', 'cega', 'cego', 'autista', 'neurodivergente', 'tdah',
  'mae', 'pai', 'gestante', 'gravida', 'negra', 'preta', 'parda', 'branca', 'indigena', 'amarela',
  'lgbt', 'lgbtq', 'lgbtqia', 'lgbtqiap', 'gay', 'lesbica', 'bissexual', 'trans', 'transgenero',
  'solteira', 'solteiro', 'casada', 'divorciada', 'divorciado', 'viuva', 'viuvo',
  'catolica', 'catolico', 'evangelica', 'evangelico', 'muculmana', 'muculmano', 'judia', 'umbandista', 'espirita',
  'aposentada', 'aposentado', 'desempregada', 'desempregado', 'disponivel', 'opentowork', 'hiring', 'premium', 'verificada', 'verificado', 'verified',
  'mba', 'phd', 'msc', 'pmp', 'cfa',
]);
// Também são sobrenomes. Só saem quando sobra nome e sobrenome.
const TRAILING_WORDS_ALSO_SURNAMES: ReadonlySet<string> = new Set(['negro', 'preto', 'pardo', 'branco', 'amarelo', 'casado', 'judeu']);
const MAX_PLACE_WORDS = 4;

function placeWordsAtEnd(words: readonly string[]): number {
  for (let size = Math.min(MAX_PLACE_WORDS, words.length); size >= 1; size--) {
    if (isKnownPlace(normalize(words.slice(-size).join(' ')))) return size;
  }
  return 0;
}

function withoutTrailingWords(candidate: string): string {
  const words = candidate.split(' ');
  while (words.length > 1) {
    const place = placeWordsAtEnd(words);
    if (place > 0) {
      words.splice(-place, place);
      continue;
    }
    const key = normalize(words.at(-1));
    if (!TRAILING_WORDS.has(key) && !(TRAILING_WORDS_ALSO_SURNAMES.has(key) && words.length > 2)) break;
    words.pop();
  }
  while (words.length > 1 && PARTICLES.has(words.at(-1) ?? '')) words.pop(); // "Ana Souza de São Paulo"
  return words.join(' ');
}

const NAME_WORD = /^[\p{L}\p{M}][\p{L}\p{M}'’.-]*$/u;
const STARTS_UPPER_OR_UNCASED = /^[\p{Lu}\p{Lt}\p{Lo}]/u;
const LOWER_ELISION = /^\p{Ll}['’]\p{Lu}/u; // d'Ávila
const UNCASED_ONLY = /^[\p{Lo}\p{M}]+$/u; // Nomes em alfabetos sem maiúsculas podem vir sem espaço.

function looksLikeName(candidate: string): boolean {
  if (candidate === '' || candidate.length > MAX_NAME_CHARS) return false;
  const words = candidate.split(' ');
  const single = words.length === 1;
  if (words.length > MAX_NAME_WORDS || (single && !UNCASED_ONLY.test(candidate))) return false;
  if (!words.every((word) => NAME_WORD.test(word))) return false;
  if (!STARTS_UPPER_OR_UNCASED.test(words[0] ?? '')) return false;
  if (words.some((word) => NOT_NAME_WORDS.has(normalize(word))) || isKnownPlace(normalize(candidate))) return false;
  return words.every((word) => STARTS_UPPER_OR_UNCASED.test(word) || LOWER_ELISION.test(word) || PARTICLES.has(word));
}

/**
 * Nome limpo a partir da primeira linha do texto. Vírgula não é aceita de propósito: "São Paulo, SP" e
 * "Maria Silva, MBA" têm a mesma forma, e só o segundo é nome. Limite conhecido: uma cidade de duas palavras fora da
 * lista curta de ./places.ts, sozinha na primeira linha, tem forma de nome.
 */
export function readName(firstLine: string): string | null {
  if (firstLine === '' || firstLine.length > MAX_NAME_LINE) return null;
  if (titleRole(firstLine) !== null) return null;
  if (isListCutLine(firstLine) || isHiddenTextLine(firstLine) || isPageNoiseLine(firstLine)) return null;

  const withoutPronouns = firstLine.replace(BRACKETED, ' ').replace(PRONOUN_SET, ' ');
  const head = withoutPronouns.split(SEPARATOR)[0] ?? '';
  const candidate = withoutTrailingWords(head.replace(BADGE, ' ').replace(/\s+/gu, ' ').trim().replace(TRAILING_TAGS, '').trim());
  return looksLikeName(candidate) ? candidate : null;
}

/** Nome a partir das linhas do texto. Olha só a primeira que não está em branco. */
export function readNameFromLines(lines: readonly string[]): string | null {
  return readName(lines.find((line) => line !== '') ?? '');
}
