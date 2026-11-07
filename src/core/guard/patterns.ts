// Padrões da trava (RF-13): o que uma lista de palavras não pega, porque a palavra sozinha é ambígua e só a construção diz
// que é critério. "single" é termo técnico; "must be single" não é. "negra" pode ser caixa; "desenvolvedora negra" não é.
// Tudo roda sobre palavras já normalizadas, em uma passada, olhando uma janela curta em volta de cada palavra: custo linear.
//
// Também aqui mora o outro lado: a declaração de igualdade ("independentemente de gênero, raça ou idade") e o produto que
// atende alguém ("app para idosos") citam o assunto sem pedir nada. Só valem em texto longo: quem digita um termo está dando
// um critério, não uma declaração. E só cobrem a própria enumeração, então o pedido que vem depois dela continua disparando.
import { ATTRIBUTES_AFTER_PT, ATTRIBUTES_BEFORE, ENGLISH_PEOPLE_PLURALS, LEXICON, OPENING_DEMONYMS, PERSON_WORDS_EN, PERSON_WORDS_PT } from './lexicon.ts';
import type { PersonAttribute } from './lexicon.ts';
import { FORBIDDEN_TOPICS } from './topics.ts';
import type { ForbiddenTopic } from './topics.ts';
import { LINE_MARK } from './years.ts';
import type { GuardSpan } from './years.ts';

const NOUNS_PT: ReadonlySet<string> = new Set(PERSON_WORDS_PT);
const NOUNS_EN: ReadonlySet<string> = new Set(PERSON_WORDS_EN);
const NOUNS: ReadonlySet<string> = new Set([...PERSON_WORDS_PT, ...PERSON_WORDS_EN]);

// Atributo ambíguo vale antes de pessoa, mas não se a pessoa é só o começo de outra coisa: "old developer tools".
const NOT_A_PERSON_AFTER: ReadonlySet<string> = new Set([
  'tool', 'tools', 'tooling', 'portal', 'docs', 'documentation', 'experience', 'environment', 'environments', 'setup', 'machine', 'platform', 'productivity', 'community', 'communities', 'program', 'programs', 'api', 'apis', 'console', 'kit', 'sdk', 'guide', 'guides', 'account', 'accounts',
  'privileges', 'rights', 'access', 'data', 'records', 'profile', 'profiles', 'relations', 'advocate', 'journey', 'pipeline', 'pipelines', 'review', 'reviews', 'screening', 'acquisition', 'pool', 'pools', 'management', 'page', 'pages', 'market', 'markets',
]);
// Palavra que não pode estar entre o atributo e a pessoa: aí o atributo fala dela, não da pessoa.
const NOT_BETWEEN: ReadonlySet<string> = new Set(['market', 'markets', 'company', 'companies', 'startup', 'startups', 'firm', 'business', 'code', 'codebase', 'system', 'systems', 'product', 'products', 'project', 'projects', 'team', 'teams', 'and', 'or', 'of', 'in', 'for', 'with', 'to', 'the', 'a', 'an']);

const CONJUNCTIONS: ReadonlySet<string> = new Set(['and', 'or', 'e', 'ou']);

// Depois da palavra de pessoa, em português: o que pode vir antes do atributo sem mudar de quem se fala.
const ROLE_QUALIFIERS: ReadonlySet<string> = new Set(['software', 'dados', 'sistemas', 'ti', 'qa', 'testes', 'producao', 'backend', 'frontend', 'fullstack', 'mobile', 'senior', 'pleno', 'plena', 'junior', 'web', 'cloud', 'devops']);
const ROLE_PAIRS: ReadonlySet<string> = new Set(['back end', 'front end', 'full stack']);
// Quebra a ligação entre a pessoa e o que vem depois: "analista de mercado brasileiro", "pessoa física brasileira".
const BREAKS_PERSON: ReadonlySet<string> = new Set([
  'e', 'ou', 'que', 'com', 'para', 'em', 'no', 'na', 'nos', 'nas', 'por', 'a', 'o', 'os', 'as', 'ao', 'aos', 'de', 'do', 'da', 'dos', 'das', 'um', 'uma', 'sem', 'se', 'como', 'sobre', 'entre', 'mais', 'muito', 'bem', 'nosso', 'nossa', 'seu', 'sua',
  'fisica', 'fisicas', 'juridica', 'juridicas', 'mercado', 'empresa', 'empresas', 'cliente', 'clientes', 'produto', 'produtos', LINE_MARK,
]);
const NON_BINARY: ReadonlySet<string> = new Set(['binario', 'binaria', 'binarios', 'binarias', 'binarie', 'binaries', 'binarix', 'binarixs']);

// O atributo fecha a oração. Sem isso, "must be single threaded" ou "preferably single page apps" dispararia.
const CLAUSE_END: ReadonlySet<string> = new Set([LINE_MARK, 'e', 'ou', 'and', 'or', 'only', 'somente', 'apenas', 'com', 'with', 'para', 'for', 'que', 'who', 'sem', 'without', 'de', 'da', 'do', 'in', 'em', 'na', 'no', 'to', 'not', 'nao']);
const ONLY_TAIL: ReadonlySet<string> = new Set(['only', 'preferred', 'preferably', 'preferencialmente', 'apenas', 'somente', 'exclusively', 'exclusivamente']);

// Quem casa o dever-ser com o atributo: "must be single", "deve ser jovem", "seja casado".
const BE_FOLLOWS: ReadonlySet<string> = new Set(['must', 'should', 'to', 'shall', 'needs', 'need', 'cannot', 'not']);
const SER_FOLLOWS: ReadonlySet<string> = new Set(['precisa', 'precisam', 'deve', 'devem', 'que', 'de', 'preciso', 'necessario', 'obrigatorio', 'obrigatoria', 'desejavel']);
const COPULA_FILLERS: ReadonlySet<string> = new Set(['a', 'an', 'um', 'uma', 'fully', 'preferably', 'ideally', 'preferencialmente', 'necessariamente', 'obrigatoriamente', 'totalmente', 'only', 'somente', 'apenas']);
// Termo inteiro que, depois do dever-ser, quase sempre fala de outra coisa: "deve ser menor que", "must be near".
const NOT_AFTER_COPULA: ReadonlySet<string> = new Set(['menor', 'menores', 'perto', 'proximo', 'proxima', 'proximos', 'proximas', 'near', 'nearby', 'nacional', 'nacionais', 'national', 'capital', 'interior', 'centro', 'sul', 'norte', 'leste', 'oeste', 'cidade', 'city', 'regiao', 'km', 'cor', 'cores', 'color', 'colour', 'race', 'races', 'union', 'unions', 'distance', 'location', 'address', 'origin', 'country', 'interior', 'liberal', 'liberais', 'politica', 'politicas', 'politico', 'politicos']);

const WHOLE_WORDS: ReadonlyMap<string, ForbiddenTopic> = (() => {
  const words = new Map<string, ForbiddenTopic>();
  for (const topic of FORBIDDEN_TOPICS) {
    for (const entry of LEXICON[topic].wholeTerm) {
      if (!entry.includes(' ') && !words.has(entry) && !NOT_AFTER_COPULA.has(entry)) words.set(entry, topic);
    }
  }
  return words;
})();

// Nome de idioma em inglês: pedir o idioma é permitido. Só vira origem junto de quem é pessoa, como em "german engineers".
const ALSO_LANGUAGES: ReadonlySet<string> = new Set(['chinese', 'japanese', 'korean', 'german', 'french', 'italian', 'spanish', 'portuguese', 'russian', 'polish']);

function peopleWordTopic(word: string): ForbiddenTopic | undefined {
  if (ALSO_LANGUAGES.has(word)) return undefined;
  return ATTRIBUTES_AFTER_PT.get(word)?.topic ?? ATTRIBUTES_BEFORE.get(word)?.topic ?? ENGLISH_PEOPLE_PLURALS.get(word);
}

function attributeTopic(word: string): ForbiddenTopic | undefined {
  return WHOLE_WORDS.get(word) ?? peopleWordTopic(word);
}

// Quem pede preferência por alguém: "preferência por negros", "vaga para brasileiros", "preferably single".
const PREFERENCE_LEADS: readonly (readonly string[])[] = [
  'preferencia por', 'preferencia para', 'preferencia a', 'preferencialmente', 'prioridade para', 'prioridade a', 'prioridade por', 'exclusivo para', 'exclusiva para', 'exclusivos para', 'exclusivas para', 'exclusivamente para', 'somente para', 'apenas para', 'so para', 'vaga para', 'vagas para',
  'voltada para', 'voltado para', 'voltada a', 'voltado a', 'destinada a', 'destinado a', 'destinada para', 'destinado para', 'reservada para', 'reservado para', 'reservadas para', 'reservada a', 'restrita a', 'restrito a', 'aceitamos', 'nao aceitamos', 'contratamos', 'nao contratamos', 'buscamos', 'procuramos',
  'preference for', 'preference to', 'priority for', 'priority to', 'reserved for', 'exclusively for', 'exclusive to', 'only for', 'open only to', 'preferably', 'we prefer', 'prefer', 'restricted to', 'looking for', 'seeking', 'hiring', 'we hire',
].map((lead) => lead.split(' ')).sort((a, b) => b.length - a.length);
const PREFERENCE_FIRST: ReadonlySet<string> = new Set(PREFERENCE_LEADS.map((lead) => lead[0] ?? ''));
const OPENING_PLURALS: ReadonlySet<string> = new Set(OPENING_DEMONYMS);
// "Cor: branca" abrindo a frase é pedido. "Logo na cor branca" é só descrição.
const COLORS: ReadonlySet<string> = new Set(['branca', 'branco', 'negra', 'negro', 'preta', 'preto', 'parda', 'pardo', 'amarela', 'amarelo', 'white', 'black', 'brown']);

// Feminino dito como filtro: "buscamos uma desenvolvedora". O masculino é o genérico da língua e "pessoa desenvolvedora" é a forma
// inclusiva, então só dispara com quem está contratando logo antes, e nunca se a outra forma vem junto.
const WOMEN_ROLES: ReadonlySet<string> = new Set(['desenvolvedora', 'desenvolvedoras', 'engenheira', 'engenheiras', 'programadora', 'programadoras', 'arquiteta', 'arquitetas', 'estagiaria', 'estagiarias', 'consultora', 'consultoras', 'gestora', 'gestoras', 'coordenadora', 'coordenadoras', 'administradora', 'administradoras']);
const MEN_ROLES: ReadonlySet<string> = new Set(['desenvolvedor', 'desenvolvedores', 'engenheiro', 'engenheiros', 'programador', 'programadores', 'arquiteto', 'arquitetos', 'estagiario', 'estagiarios', 'consultor', 'consultores', 'gestor', 'gestores', 'coordenador', 'coordenadores', 'administrador', 'administradores']);
const HIRING_LEADS: readonly (readonly string[])[] = ['buscamos', 'procuramos', 'contratamos', 'queremos', 'contratando', 'selecionamos', 'procura se', 'busca se', 'contrata se', 'precisamos de', 'vaga para', 'vagas para', 'oportunidade para', 'vaga exclusiva para', 'exclusiva para'].map((lead) => lead.split(' '));

// Quem é de algum lugar: "candidatos da região", "quem é da zona leste". Nome de cidade solto em frase é só descrição (DP-06).
const PEOPLE_FROM: ReadonlySet<string> = new Set([...PERSON_WORDS_PT.filter((word) => !['talento', 'talentos', 'lider', 'lideres'].includes(word)), 'moradores']);
const PLACE_LINKS: ReadonlySet<string> = new Set(['da', 'de', 'do', 'das', 'dos', 'na', 'no', 'nas', 'nos', 'em']);
const PLACE_WORDS: ReadonlySet<string> = new Set(['regiao', 'regioes', 'zona', 'bairro', 'bairros', 'cidade', 'municipio', 'litoral', 'vizinhanca', 'baixada', 'abc', 'nordeste', 'sudeste', 'sul', 'norte', 'leste', 'oeste']);
// Só com a oração fechada depois: "profissionais de capital humano" não fala de lugar.
const PLACE_WORDS_AT_END: ReadonlySet<string> = new Set(['capital', 'interior', 'vale']);
const WHO_IS: ReadonlySet<string> = new Set(['e', 'for', 'seja', 'sejam', 'esta', 'estiver', 'fica']);
const WHO: ReadonlySet<string> = new Set(['quem', 'que']);
const PEOPLE_FROM_EN: ReadonlySet<string> = new Set(['candidates', 'candidate', 'people', 'person', 'applicants', 'applicant', 'professionals', 'anyone', 'those', 'workers', 'developers', 'engineers']);
const PLACE_WORDS_EN: ReadonlySet<string> = new Set(['region', 'area', 'city', 'state', 'neighborhood', 'neighbourhood', 'vicinity', 'metro', 'surroundings']);

// O número do ano de formatura é a idade por outro nome: "Class of 2020", "formado em 2020".
const GRADUATION_WORDS: ReadonlySet<string> = new Set(['formado', 'formada', 'formados', 'formadas', 'graduado', 'graduada', 'graduados', 'graduadas', 'formatura', 'formacao', 'turma', 'class', 'graduated', 'graduating', 'graduation', 'grad']);
const GRADUATION_LINKS: ReadonlySet<string> = new Set(['em', 'de', 'of', 'in', 'year', 'ano']);
const YEAR = /^(?:19|20)\d\d$/u;

// "30-year-old" só é idade se fala de gente: "a 20-year-old company" não é.
const YEAR_WORDS: ReadonlySet<string> = new Set(['year', 'yr']);
const AFTER_AGE: ReadonlySet<string> = new Set([LINE_MARK, 'or', 'and', 'only', 'e', 'ou', 'with', 'who']);

// Foto pedida junto do currículo. Foto de produto, upload e galeria não contam.
const PHOTO_WORDS: ReadonlySet<string> = new Set(['foto', 'fotos', 'photo', 'photos', 'picture', 'pictures', 'selfie']);
const SENDING_WORDS: ReadonlySet<string> = new Set(['cv', 'curriculo', 'curriculum', 'resume', 'envie', 'enviar', 'anexe', 'anexar', 'mande', 'mandar', 'send', 'attach', 'include', 'submit']);
const PHOTO_WINDOW = 6;

// Raízes de palavras que só têm um sentido, com qualquer sufixo: "LGBTQIAPN", "homoafetivos".
const ROOTS: readonly (readonly [RegExp, ForbiddenTopic])[] = [
  [/^(?:lgbt|glbt|homoafetiv|homossexu|bissexu|heterossexu|pansexu|assexu)/u, 'orientation'],
  [/^(?:transgener|transexu|cisgener)/u, 'gender'],
  [/^(?:afrodescend)/u, 'race'],
  [/^(?:neurodiverg|neurodivers|neuroatip|neurotip|soropositiv)/u, 'disability_health'],
  [/^(?:sindicaliz)/u, 'politics'],
];

// Tempo de viagem até o trabalho é distância: "até 30 minutos do escritório". Até o metrô é só descrição do escritório.
const TRIP_UNITS: ReadonlySet<string> = new Set(['minuto', 'minutos', 'min', 'mins', 'minute', 'minutes', 'hora', 'horas', 'hour', 'hours', 'hr', 'hrs']);
const TRIP_LINKS: ReadonlySet<string> = new Set(['do', 'da', 'from', 'of', 'to']);
const TRIP_FILLERS: ReadonlySet<string> = new Set(['the', 'our', 'nosso', 'nossa', 'nossos', 'nossas']);
const WORK_PLACES: ReadonlySet<string> = new Set(['escritorio', 'escritorios', 'empresa', 'trabalho', 'sede', 'office', 'offices', 'workplace', 'unidade', 'matriz', 'filial']);
const NUMBER_WORD = /^\d{1,3}$|^(?:uma?|one|an?|duas|dois|two|meia|half)$/u;

// Falante nativo é origem por outro nome. Idioma é permitido: "inglês fluente" passa.
const SPOKEN: ReadonlySet<string> = new Set(['english', 'portuguese', 'spanish', 'french', 'german', 'italian', 'japanese', 'mandarin', 'ingles', 'portugues', 'espanhol', 'frances', 'alemao', 'italiano', 'japones', 'mandarim', 'br', 'pt']);
const NATIVE_PT: ReadonlySet<string> = new Set(['nativo', 'nativa', 'nativos', 'nativas']);

// Número de CEP é endereço. A sigla sozinha não: pode ser Complex Event Processing.
const POSTAL_FIRST = /^\d{5}$/u;
const POSTAL_LAST = /^\d{3}$/u;
const POSTAL_WHOLE = /^\d{8}$/u;

function isOpening(tokens: readonly string[], at: number): boolean {
  return at === 0 || tokens[at - 1] === LINE_MARK;
}

function closes(token: string | undefined): boolean {
  return token === undefined || CLAUSE_END.has(token);
}

function endOfMatch(tokens: readonly string[], at: number, lead: readonly string[]): number | null {
  for (let k = 0; k < lead.length; k++) {
    if (tokens[at + k] !== lead[k]) return null;
  }
  return at + lead.length;
}

/** Fim do trecho "black engineers", "young and hungry engineers", "black software engineers", ou null. */
function personAfterAttribute(tokens: readonly string[], at: number, attribute: PersonAttribute, nouns: ReadonlySet<string>): number | null {
  const next = tokens[at + 1];
  if (next === undefined) return null;
  let end: number | null = null;
  if (nouns.has(next)) end = at + 2;
  else if (attribute.loose && CONJUNCTIONS.has(next) && nouns.has(tokens[at + 3] ?? '')) end = at + 4;
  else if (attribute.loose && !NOT_BETWEEN.has(next) && next !== LINE_MARK && nouns.has(tokens[at + 2] ?? '')) end = at + 3;
  else if (attribute.loose && !NOT_BETWEEN.has(next) && !NOT_BETWEEN.has(tokens[at + 2] ?? '') && next !== LINE_MARK && tokens[at + 2] !== LINE_MARK && nouns.has(tokens[at + 3] ?? '')) end = at + 4;
  if (end === null || NOT_A_PERSON_AFTER.has(tokens[end] ?? '')) return null;
  return end;
}

/** Fim do trecho "desenvolvedora negra", "engenheira de software negra", "programador Java jovem", ou null. */
function attributeAfterPerson(tokens: readonly string[], at: number): { end: number; topic: ForbiddenTopic } | null {
  let free = 1;
  let j = at + 1;
  for (let step = 0; step < 4; step++) {
    const token = tokens[j];
    if (token === undefined) return null;
    const attribute = ATTRIBUTES_AFTER_PT.get(token);
    if (attribute !== undefined && (j === at + 1 || attribute.loose)) return { end: j + 1, topic: attribute.topic };
    if (token === 'nao' && NON_BINARY.has(tokens[j + 1] ?? '')) return { end: j + 2, topic: 'gender' };
    if (token === 'de' && ROLE_QUALIFIERS.has(tokens[j + 1] ?? '')) {
      j += 2;
    } else if (ROLE_PAIRS.has(`${token} ${tokens[j + 1] ?? ''}`)) {
      j += 2;
    } else if (ROLE_QUALIFIERS.has(token)) {
      j += 1;
    } else if (free > 0 && !BREAKS_PERSON.has(token)) {
      free--;
      j += 1;
    } else {
      return null;
    }
  }
  return null;
}

/** Atributo depois de "must be", "deve ser", "seja": a palavra da trava que fecha a oração. */
function afterCopula(tokens: readonly string[], at: number): { end: number; topic: ForbiddenTopic } | null {
  const token = tokens[at];
  const before = tokens[at - 1] ?? LINE_MARK;
  const follows = token === 'seja' || token === 'sejam' || (token === 'be' && (before === LINE_MARK || BE_FOLLOWS.has(before))) || (token === 'ser' && (before === LINE_MARK || SER_FOLLOWS.has(before)));
  if (!follows) return null;
  let j = at + 1;
  while (j < at + 4 && COPULA_FILLERS.has(tokens[j] ?? '')) j++;
  const word = tokens[j];
  if (word === undefined) return null;
  const topic = attributeTopic(word);
  if (topic === undefined || !closes(tokens[j + 1])) return null;
  return { end: j + 1, topic };
}

function afterPreference(tokens: readonly string[], at: number): { end: number; topic: ForbiddenTopic } | null {
  if (!PREFERENCE_FIRST.has(tokens[at] ?? '')) return null;
  for (const lead of PREFERENCE_LEADS) {
    const end = endOfMatch(tokens, at, lead);
    if (end === null) continue;
    const word = tokens[end] ?? '';
    // Depois de "preferência por", o atributo que vale é o que fala de gente, não qualquer termo inteiro da lista.
    const topic = peopleWordTopic(word) ?? (word === 'single' ? 'marital_family' : undefined);
    if (topic !== undefined && closes(tokens[end + 1])) return { end: end + 1, topic };
    return null;
  }
  return null;
}

function hiringWomen(tokens: readonly string[], at: number): number | null {
  for (const lead of HIRING_LEADS) {
    const end = endOfMatch(tokens, at, lead);
    if (end === null) continue;
    const roleAt = tokens[end] === 'uma' || tokens[end] === 'umas' ? end + 1 : end;
    if (!WOMEN_ROLES.has(tokens[roleAt] ?? '')) continue;
    const next = tokens[roleAt + 1];
    if (next === 'ou' || next === 'or' || MEN_ROLES.has(next ?? '')) return null;
    return roleAt + 1;
  }
  return null;
}

/** Span de "quem é de algum lugar", olhando para trás a partir da palavra de lugar. */
function peopleFromPlace(tokens: readonly string[], at: number): number | null {
  const link = tokens[at - 1] ?? '';
  if (PLACE_LINKS.has(link)) {
    const before = tokens[at - 2] ?? '';
    if (PEOPLE_FROM.has(before)) return at - 2;
    if (WHO_IS.has(before) && WHO.has(tokens[at - 3] ?? '')) return at - 3;
  }
  return null;
}

function peopleFromPlaceEn(tokens: readonly string[], at: number): number | null {
  const start = tokens[at - 1] === 'the' || tokens[at - 1] === 'our' ? at - 2 : at - 1;
  const link = tokens[start];
  if ((link === 'from' || link === 'in' || link === 'near') && PEOPLE_FROM_EN.has(tokens[start - 1] ?? '')) return start - 1;
  return null;
}

function tripToWork(tokens: readonly string[], at: number): number | null {
  if (!TRIP_LINKS.has(tokens[at + 1] ?? '')) return null;
  const placeAt = TRIP_FILLERS.has(tokens[at + 2] ?? '') ? at + 3 : at + 2;
  return WORK_PLACES.has(tokens[placeAt] ?? '') && NUMBER_WORD.test(tokens[at - 1] ?? '') ? placeAt + 1 : null;
}

function nativeSpeaker(tokens: readonly string[], at: number): number | null {
  const token = tokens[at];
  if (token === 'native') {
    const next = tokens[at + 1] ?? '';
    if (SPOKEN.has(next)) return at + 2;
    return null;
  }
  if (NATIVE_PT.has(token ?? '')) {
    if (tokens[at + 1] === 'em' && SPOKEN.has(tokens[at + 2] ?? '')) return at + 3;
    if (SPOKEN.has(tokens[at - 1] ?? '')) return at + 1;
  }
  return null;
}

/** Tudo o que os padrões acham num trecho, sem olhar as palavras marcadas em `skip`. */
export function findPatterns(tokens: readonly string[], skip: ReadonlySet<number>): GuardSpan[] {
  const spans: GuardSpan[] = [];
  const add = (topic: ForbiddenTopic, start: number, end: number): void => {
    spans.push({ topic, start, end });
  };
  for (let i = 0; i < tokens.length; i++) {
    if (skip.has(i)) continue;
    const token = tokens[i] ?? '';
    if (token === LINE_MARK) continue;

    for (const [root, topic] of ROOTS) {
      if (root.test(token)) add(topic, i, i + 1);
    }

    const before = ATTRIBUTES_BEFORE.get(token);
    if (before !== undefined) {
      const end = personAfterAttribute(tokens, i, before, token === 'jovem' ? NOUNS_PT : NOUNS_EN);
      if (end !== null) add(before.topic, i, end);
    }
    if (NOUNS_PT.has(token)) {
      const hit = attributeAfterPerson(tokens, i);
      if (hit !== null && !skip.has(hit.end - 1)) add(hit.topic, i, hit.end);
    }

    const copula = afterCopula(tokens, i);
    if (copula !== null && !skip.has(copula.end - 1)) add(copula.topic, i, copula.end);
    const preference = afterPreference(tokens, i);
    if (preference !== null && !skip.has(preference.end - 1)) add(preference.topic, i, preference.end);

    if (isOpening(tokens, i)) {
      if ((token === 'cor' || token === 'color') && COLORS.has(tokens[i + 1] ?? '')) add('race', i, i + 2);
      const topic = attributeTopic(token);
      if (topic !== undefined && ONLY_TAIL.has(tokens[i + 1] ?? '')) add(topic, i, i + 2);
      if (OPENING_PLURALS.has(token)) add('nationality_origin', i, i + 1);
    }

    const women = hiringWomen(tokens, i);
    if (women !== null) add('gender', i, women);

    if (PLACE_WORDS.has(token) || (PLACE_WORDS_AT_END.has(token) && closes(tokens[i + 1]))) {
      const start = peopleFromPlace(tokens, i);
      if (start !== null) add('address_distance', start, i + 1);
    } else if (PLACE_WORDS_EN.has(token)) {
      const start = peopleFromPlaceEn(tokens, i);
      if (start !== null) add('address_distance', start, i + 1);
    } else if (token === 'estado' && tokens[i - 1] === 'do' && PEOPLE_FROM.has(tokens[i - 2] ?? '') && (tokens[i + 1] === 'de' || tokens[i + 1] === 'do' || tokens[i + 1] === 'da')) {
      add('address_distance', i - 2, i + 1);
    }

    if (GRADUATION_WORDS.has(token)) {
      const yearAt = GRADUATION_LINKS.has(tokens[i + 1] ?? '') ? i + 2 : i + 1;
      if (YEAR.test(tokens[yearAt] ?? '')) add('age', i, yearAt + 1);
    }

    if (YEAR_WORDS.has(token) && tokens[i + 1] === 'old') {
      const next = tokens[i + 2];
      if (next === undefined || AFTER_AGE.has(next) || NOUNS.has(next)) add('age', i, i + 2);
    }

    if (PHOTO_WORDS.has(token)) {
      for (let back = i - 1; back >= 0 && back >= i - PHOTO_WINDOW; back--) {
        const word = tokens[back] ?? '';
        if (word === LINE_MARK) break;
        if (SENDING_WORDS.has(word)) {
          add('appearance', back, i + 1);
          break;
        }
      }
    }

    if (TRIP_UNITS.has(token)) {
      const end = tripToWork(tokens, i);
      if (end !== null) add('address_distance', i, end);
    }

    const native = nativeSpeaker(tokens, i);
    if (native !== null) add('nationality_origin', i, native);
  }
  return spans;
}

/** Só em termo digitado: o número de CEP. O endereço da empresa, numa vaga, é só descrição. */
export function postalCodeSpans(tokens: readonly string[]): GuardSpan[] {
  const spans: GuardSpan[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i] ?? '';
    if (POSTAL_WHOLE.test(token)) {
      spans.push({ topic: 'address_distance', start: i, end: i + 1 });
    } else if (POSTAL_FIRST.test(token) && POSTAL_LAST.test(tokens[i + 1] ?? '')) {
      spans.push({ topic: 'address_distance', start: i, end: i + 2 });
    }
  }
  return spans;
}

// A enumeração de uma declaração de igualdade: "gênero, raça, idade, orientação sexual ou deficiência".
const PROTECTED_LIST: ReadonlySet<string> = new Set([
  'genero', 'generos', 'raca', 'racas', 'cor', 'cores', 'idade', 'idades', 'etnia', 'etnias', 'orientacao', 'orientacoes', 'sexual', 'sexuais', 'sexo', 'religiao', 'religioes', 'crenca', 'crencas', 'credo', 'credos', 'deficiencia', 'deficiencias', 'nacionalidade', 'nacionalidades', 'origem', 'origens',
  'estado', 'civil', 'identidade', 'identidades', 'condicao', 'condicoes', 'social', 'sociais', 'aparencia', 'classe', 'opiniao', 'opinioes', 'politica', 'politicas', 'politico', 'politicos', 'posicao', 'familiar', 'familiares', 'etnico', 'etnica', 'racial', 'raciais', 'diversidade', 'fisica', 'fisicas', 'mental', 'saude', 'gravidez', 'naturalidade',
  'race', 'races', 'color', 'colour', 'religion', 'religions', 'creed', 'sex', 'gender', 'genders', 'identity', 'expression', 'orientation', 'national', 'origin', 'origins', 'nationality', 'age', 'disability', 'disabilities', 'marital', 'status', 'veteran', 'veterans', 'ancestry', 'genetic', 'information', 'pregnancy', 'political', 'belief', 'beliefs', 'opinion', 'opinions',
  'affiliation', 'family', 'medical', 'condition', 'citizenship', 'ethnicity', 'ethnic', 'appearance', 'physical', 'protected', 'characteristic', 'characteristics', 'military', 'service',
  'e', 'ou', 'de', 'da', 'do', 'das', 'dos', 'sua', 'seu', 'suas', 'seus', 'qualquer', 'outra', 'outras', 'outro', 'outros', 'a', 'o', 'as', 'os', 'and', 'or', 'of', 'their', 'your', 'any', 'other', 'nor',
]);
// Quem é atendido por um produto ou por uma área de saúde: "saúde da mulher e do idoso", "app para idosos".
const AUDIENCE_LIST: ReadonlySet<string> = new Set([
  'mulher', 'mulheres', 'homem', 'homens', 'idoso', 'idosa', 'idosos', 'idosas', 'gestante', 'gestantes', 'crianca', 'criancas', 'adolescente', 'adolescentes', 'familia', 'familias', 'igreja', 'igrejas', 'surdos', 'surdas', 'cegos', 'cegas', 'pessoas', 'pessoa', 'com', 'deficiencia', 'deficientes', 'pcd', 'autista', 'autistas',
  'women', 'men', 'seniors', 'elderly', 'pregnant', 'children', 'kids', 'churches', 'church', 'people', 'with', 'disabilities', 'e', 'ou', 'do', 'da', 'de', 'dos', 'das', 'and', 'or', 'a', 'o', 'as', 'os', 'the',
]);
// Benefício que chega à família de quem trabalha.
const FAMILY_LIST: ReadonlySet<string> = new Set(['conjuge', 'conjuges', 'esposa', 'esposo', 'marido', 'companheiro', 'companheira', 'dependente', 'dependentes', 'filho', 'filhos', 'filha', 'filhas', 'familia', 'familiares', 'spouse', 'family', 'dependents', 'children', 'your', 'e', 'ou', 'seu', 'sua', 'seus', 'suas', 'o', 'a', 'os', 'as', 'and', 'or']);

function shieldEntries(leads: readonly string[], list: ReadonlySet<string>): readonly (readonly [readonly string[], ReadonlySet<string>])[] {
  return leads.map((lead) => [lead.split(' '), list] as const);
}

function crossed(heads: readonly string[], tails: readonly string[]): string[] {
  return heads.flatMap((head) => tails.map((tail) => `${head} ${tail}`));
}

const SHIELDS: readonly (readonly [readonly string[], ReadonlySet<string>])[] = [
  ...shieldEntries(
    [
      'independentemente de', 'independentemente da', 'independentemente do', 'independente de', 'independente da', 'independente do', 'sem distincao de', 'sem distincao por', 'sem qualquer distincao de', 'sem discriminacao de', 'sem discriminacao por', 'sem qualquer discriminacao de', 'sem preconceito de', 'sem preconceitos de',
      'sem levar em conta', 'sem considerar', 'nao discriminamos', 'nao discrimina', 'nao fazemos distincao de', 'nao fazemos distincao por', 'nao importa', 'nao importando', 'qualquer que seja', 'seja qual for', 'discriminacao por', 'discriminacao de',
      'regardless of', 'irrespective of', 'without regard to', 'without regard for', 'discriminate on the basis of', 'discriminate based on', 'discriminate against', 'discrimination on the basis of', 'discrimination based on',
      ...crossed(['dashboard', 'dashboards', 'relatorio', 'relatorios', 'painel', 'paineis', 'metrica', 'metricas', 'indicador', 'indicadores', 'analise', 'analises', 'dados', 'pesquisa', 'pesquisas', 'censo', 'vies', 'vieses', 'fairness', 'bias', 'report', 'reports', 'segmentacao', 'clientes', 'usuarios', 'consumidores', 'pacientes', 'publico', 'customers', 'users', 'segmentation', 'metrics', 'analytics', 'cadastro', 'cadastros', 'formulario', 'formularios', 'campo', 'campos'], ['de', 'por', 'by', 'on', 'of', 'em', 'sobre']),
      'data such as', 'fields such as', 'sensitive data on', 'sensitive data about', 'dados sensiveis como', 'dados pessoais como',
    ],
    PROTECTED_LIST,
  ),
  ...shieldEntries(['saude da', 'saude do', 'saude de', 'saude das', 'saude dos', 'women s health', 'mens health', 'womens health', 'incluindo', 'including', 'inclusive'], AUDIENCE_LIST),
  ...shieldEntries(['extensivo a', 'extensiva a', 'extensivo ao', 'extensiva ao', 'extensivos a', 'extensivas a', 'extensivo para', 'extensiva para', 'extensao para', 'extensao a', 'para voce e', 'for you and'], FAMILY_LIST),
].sort((a, b) => b[0].length - a[0].length);

const SHIELDS_BY_FIRST: ReadonlyMap<string, readonly (readonly [readonly string[], ReadonlySet<string>])[]> = (() => {
  const table = new Map<string, (readonly [readonly string[], ReadonlySet<string>])[]>();
  for (const shield of SHIELDS) {
    const first = shield[0][0] ?? '';
    const list = table.get(first);
    if (list === undefined) table.set(first, [shield]);
    else list.push(shield);
  }
  return table;
})();

const PRODUCT_WORDS: ReadonlySet<string> = new Set(['app', 'apps', 'aplicativo', 'aplicativos', 'plataforma', 'plataformas', 'sistema', 'sistemas', 'site', 'sites', 'portal', 'portais', 'software', 'softwares', 'produto', 'produtos', 'solucao', 'solucoes', 'ferramenta', 'ferramentas', 'cms', 'erp', 'crm', 'servico', 'servicos', 'api', 'apis', 'jogo', 'jogos', 'dashboard', 'dashboards', 'modulo', 'modulos', 'marketplace', 'ecommerce', 'saas', 'sdk', 'chatbot', 'bot', 'platform', 'platforms', 'product', 'products', 'service', 'services', 'website', 'websites', 'tool', 'tools', 'system', 'systems']);
const PRODUCT_WINDOW = 6;

function namesProduct(tokens: readonly string[], at: number): boolean {
  for (let back = at - 1; back >= 0 && back >= at - PRODUCT_WINDOW; back--) {
    const word = tokens[back] ?? '';
    if (word === LINE_MARK) return false;
    if (PRODUCT_WORDS.has(word)) return true;
    // "Vaga em sistemas para mulheres" pede gente, mesmo citando um produto.
    if (word === 'vaga' || word === 'vagas' || word === 'job') return false;
  }
  return false;
}

/** As palavras que citam o assunto sem pedir nada. Só para texto longo. */
export function shieldedTokens(tokens: readonly string[]): Set<number> {
  const shielded = new Set<number>();
  const cover = (start: number, afterLead: number, list: ReadonlySet<string>): number => {
    let j = afterLead;
    while (list.has(tokens[j] ?? '')) j++;
    if (j === afterLead) return start;
    for (let k = start; k < j; k++) shielded.add(k);
    return j - 1;
  };
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i] ?? '';
    let covered = i;
    for (const [lead, list] of SHIELDS_BY_FIRST.get(token) ?? []) {
      const end = endOfMatch(tokens, i, lead);
      if (end === null) continue;
      covered = cover(i, end, list);
      break;
    }
    if (covered === i && (token === 'para' || token === 'for') && namesProduct(tokens, i)) covered = cover(i, i + 1, AUDIENCE_LIST);
    i = covered;
  }
  return shielded;
}
