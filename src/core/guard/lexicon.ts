// Listas da trava (RF-13), em português e inglês, já na forma normalizada: sem acento, em minúsculas, com pontuação
// tirada. Toda comparação é de palavra inteira. Puro: só dados.
//
// Cada assunto tem três listas, da mais ampla para a mais estrita:
//   anywhere:  dispara em qualquer texto, até no meio de frase. Só entra aqui o que não tem outro sentido comum em vaga.
//   inTerm:    dispara em termo digitado, em qualquer posição dele, mas não em frase. Um escritório "próximo ao metrô" é só
//              descrição; o termo de busca "próximo ao metrô" é critério.
//   wholeTerm: dispara só se for o termo inteiro. É o lugar das palavras ambíguas: "single" barra, "single sign-on" não.
//
// Idiomas no masculino singular ("alemão", "russo", "árabe") ficam de fora de propósito: são idiomas, e idioma é permitido.
// Saúde, salário e documentos: "plano de saúde", "pretensão salarial" e "CNH" não são proibidos aqui.
import type { ForbiddenTopic } from './topics.ts';

export interface TopicLexicon {
  readonly anywhere: readonly string[];
  readonly inTerm: readonly string[];
  readonly wholeTerm: readonly string[];
}

/** Flexões de quem termina em -o: masculino, feminino, plural e as formas "solteiro(a)", "solteiro(a)s", "solteiros(as)", "solteirx", "solteire". */
function gen(stem: string): string[] {
  return ['o', 'a', 'os', 'as', 'oa', 'oas', 'osas', 'x', 'xs', 'e', 'es'].map((ending) => stem + ending);
}

function cross(leads: readonly string[], tails: readonly string[]): string[] {
  return leads.flatMap((lead) => tails.map((tail) => `${lead} ${tail}`));
}

// Quem é chamado pela cor ou pela origem: "pessoas negras", "somente brasileiros". A palavra sozinha é ambígua em frase
// ("caixa preta", "quadro branco", "empresa brasileira", "língua estrangeira").
const PERSON = ['pessoa', 'pessoas', 'profissional', 'profissionais', 'candidato', 'candidata', 'candidatos', 'candidatas', 'homem', 'homens', 'mulher', 'mulheres'];
const ONLY = ['somente', 'apenas', 'exclusivamente', 'so', 'only'];
// Só o feminino: "apenas desenvolvedores" costuma ser o masculino genérico da língua, e o feminino é quase sempre um filtro.
const WOMEN_AT_WORK = ['candidatas', 'desenvolvedoras', 'engenheiras', 'programadoras'];
const COLOR_STEMS = ['negr', 'pret', 'pard', 'branc', 'amarel'];
const COLOR_WORDS = COLOR_STEMS.flatMap(gen);
const COLOR_PLURALS = COLOR_STEMS.flatMap((stem) => [`${stem}os`, `${stem}as`]);

const DEMONYM_STEMS = [
  'brasileir', 'american', 'argentin', 'venezuelan', 'haitian', 'bolivian', 'colombian', 'paraguai', 'uruguai', 'chilen', 'peruan', 'mexican', 'cuban', 'angolan',
  'nigerian', 'indian', 'siri', 'african', 'asiatic', 'estrangeir', 'nordestin',
];
const DEMONYM_WORDS = [...DEMONYM_STEMS.flatMap(gen), 'europeu', 'europeia', 'europeus', 'europeias', 'gringo', 'gringa', 'gringos', 'gringas', 'sulista', 'sulistas', 'nortista', 'nortistas'];
const DEMONYM_PLURALS = [...DEMONYM_STEMS.flatMap((stem) => [`${stem}os`, `${stem}as`]), 'europeus', 'europeias', 'gringos', 'gringas', 'sulistas', 'nortistas'];
// Só as formas que não são o nome de um idioma: "alemã" barra, "alemão" é idioma.
const LANGUAGE_DEMONYMS = [
  'alema', 'alemas', 'alemaes', 'italiana', 'italianas', 'italianos', 'japonesa', 'japonesas', 'japoneses', 'chinesa', 'chinesas', 'chineses', 'espanhola', 'espanholas',
  'espanhois', 'francesa', 'francesas', 'franceses', 'portuguesa', 'portuguesas', 'portugueses', 'inglesa', 'inglesas', 'ingleses', 'russa', 'russas', 'russos',
  'coreana', 'coreanas', 'coreanos', 'arabes', 'holandesa', 'holandeses', 'holandesas', 'turca', 'turcos', 'turcas', 'polonesa', 'poloneses', 'polonesas', 'ucraniana', 'ucranianos', 'ucranianas',
];

const BRAZILIAN_CAPITALS = [
  'rio branco', 'maceio', 'macapa', 'manaus', 'salvador', 'fortaleza', 'brasilia', 'vitoria', 'goiania', 'sao luis', 'cuiaba', 'campo grande', 'belo horizonte', 'belem',
  'joao pessoa', 'curitiba', 'recife', 'teresina', 'rio de janeiro', 'natal', 'porto alegre', 'porto velho', 'boa vista', 'florianopolis', 'sao paulo', 'aracaju', 'palmas',
];
// "Pará" fica fora dos estados: normalizado, é a preposição "para". Siglas e apelidos sem outro sentido em tecnologia. Ficam de fora GO (a linguagem), PR (pull request), ES, TO, PA, MA, BA, PE, SE, AM, MS.
const PLACE_NICKNAMES = ['sampa', 'floripa', 'bh', 'poa', 'rio', 'bsb', 'cwb', 'sp', 'rj', 'mg', 'rs', 'sc', 'df', 'zs', 'zn', 'zl', 'zo'];
const BRAZILIAN_STATES = [
  'acre', 'alagoas', 'amapa', 'amazonas', 'bahia', 'ceara', 'distrito federal', 'espirito santo', 'goias', 'maranhao', 'mato grosso', 'mato grosso do sul', 'minas gerais',
  'paraiba', 'parana', 'pernambuco', 'piaui', 'rio grande do norte', 'rio grande do sul', 'rondonia', 'roraima', 'santa catarina', 'sergipe', 'tocantins',
];

// Cidades grandes fora das capitais e regiões conhecidas. Só valem como o termo inteiro: nome de cidade em frase é só descrição (DP-06).
const OTHER_CITIES = [
  'campinas', 'guarulhos', 'osasco', 'santos', 'niteroi', 'alphaville', 'barueri', 'sorocaba', 'ribeirao preto', 'sao jose dos campos', 'sao jose do rio preto', 'sao bernardo do campo', 'santo andre', 'sao caetano do sul', 'maua', 'diadema', 'jundiai', 'piracicaba', 'bauru',
  'londrina', 'maringa', 'joinville', 'blumenau', 'caxias do sul', 'pelotas', 'uberlandia', 'contagem', 'juiz de fora', 'duque de caxias', 'nova iguacu', 'sao goncalo', 'feira de santana', 'campina grande', 'vale do paraiba', 'lisboa', 'nordeste', 'sudeste', 'centro oeste',
];
// Países e blocos como critério são origem.
const COUNTRIES = [
  'brasil', 'brazil', 'portugal', 'argentina', 'chile', 'colombia', 'mexico', 'peru', 'uruguai', 'paraguai', 'bolivia', 'venezuela', 'eua', 'usa', 'estados unidos', 'united states', 'canada', 'alemanha', 'germany', 'franca', 'france', 'espanha', 'spain', 'italia', 'italy',
  'inglaterra', 'england', 'reino unido', 'united kingdom', 'uk', 'japao', 'japan', 'china', 'india', 'russia', 'africa', 'europa', 'europe', 'asia', 'america latina', 'latin america',
];

export const CAPITALS: readonly string[] = BRAZILIAN_CAPITALS;

/** Sigla de estado ou país depois da cidade: "Natal RN", "São Paulo Brasil". Só vale junto de uma capital. */
export const CITY_SUFFIXES: readonly string[] = [
  'ac', 'al', 'ap', 'am', 'ba', 'ce', 'df', 'es', 'go', 'ma', 'mt', 'ms', 'mg', 'pa', 'pb', 'pr', 'pe', 'pi', 'rj', 'rn', 'rs', 'ro', 'rr', 'sc', 'sp', 'se', 'to', 'brasil', 'brazil', 'br',
];

/** Palavras que podem cercar um termo sem mudar o que ele pede: "somente jovem", "em Curitiba", "com filhos", "vaga para mães". */
export const TERM_LEAD: readonly string[] = [
  'so', 'somente', 'apenas', 'exclusivamente', 'only', 'just', 'o', 'a', 'os', 'as', 'um', 'uma', 'para', 'for', 'vaga', 'vagas', 'perfil', 'pessoa', 'pessoas', 'candidato', 'candidata',
  'candidatos', 'candidatas', 'profissional', 'profissionais', 'de', 'do', 'da', 'dos', 'das', 'em', 'na', 'no', 'nas', 'nos', 'in', 'at', 'near', 'the', 'cidade', 'city', 'regiao', 'grande',
  'municipio', 'capital', 'proximo', 'proxima', 'perto', 'ao', 'presencial', 'hibrido', 'hibrida', 'sede', 'escritorio', 'trabalho', 'trabalhar', 'atuar', 'ser', 'seja', 'sem', 'com', 'tem',
  'ter', 'possui', 'possuir', 'nao', 'has', 'have', 'with', 'without', 'of',
];
export const TERM_TAIL: readonly string[] = ['only', 'somente', 'apenas', 'exclusivamente', 'preferred', 'preferably', 'preferencialmente', 'regiao', 'proximidades', 'e'];

/**
 * Expressões que contêm uma palavra da trava mas não falam de pessoa. Vencem a lista quando começam antes ou na mesma palavra.
 * "interface homem-máquina", "custo homem-hora", "venda casada", "buracos negros".
 */
export const SAFE_PHRASES: readonly string[] = [
  'homem maquina', 'homens maquina', 'homem computador', 'homem hora', 'homens hora', 'homem mes', 'homens mes', 'venda casada', 'vendas casadas', 'operacao casada', 'operacoes casadas',
  'buracos negros', 'listas negras', 'born in the cloud', 'empresa nascida', 'companhia nascida', 'startup nascida', 'fintech nascida', 'healthtech nascida', 'edtech nascida', 'produto nascido', 'projeto nascido', 'sistema nascido',
  // Cor em sentido técnico.
  'caixa preta', 'caixas pretas', 'caixa branca', 'caixas brancas', 'caixa negra', 'caixas negras', 'quadro branco', 'quadros brancos', 'em branco', 'lista branca', 'listas brancas', 'lista negra', 'preto e branco', 'black box', 'white box', 'gray box', 'grey box', 'white label', 'white hat', 'black hat',
  'gray hat', 'white paper', 'white papers', 'white collar', 'blue collar', 'black friday', 'black duck', 'black belt', 'white glove', 'white list', 'black list', 'white noise', 'white space', 'black mirror', 'asian market', 'american express', 'american airlines',
  // Raça como termo de concorrência.
  'data race', 'data races', 'race condition', 'race conditions', 'race free', 'race detector', 'race detection', 'arms race',
  // Saúde de sistema, não de gente.
  'cluster health', 'system health', 'systems health', 'service health', 'services health', 'server health', 'application health', 'app health', 'node health', 'pod health', 'database health', 'platform health', 'infrastructure health', 'network health', 'pipeline health', 'site health', 'code health', 'codebase health',
  'health check', 'health checks', 'health endpoint', 'health probe', ...cross(['problema de saude', 'problemas de saude', 'saude'], ['dos servicos', 'do servico', 'do sistema', 'dos sistemas', 'da aplicacao', 'das aplicacoes', 'da plataforma', 'do cluster', 'da infraestrutura', 'do banco', 'da api', 'das apis', 'da rede', 'dos servidores', 'do servidor']),
  ...cross(['deficiencia de', 'deficiencias de', 'deficiencia no', 'deficiencias no', 'deficiencia na', 'deficiencias na', 'deficiencia em', 'deficiencias em'], ['performance', 'desempenho', 'seguranca', 'processo', 'processos', 'sistema', 'sistemas', 'codigo', 'projeto', 'cobertura', 'memoria', 'comunicacao', 'gestao', 'arquitetura', 'qualidade', 'apis', 'api']),
  // Sigla de formato e sigla de front e back.
  'pcd las', 'las pcd', 'pcd ply', 'ply pcd', 'formato pcd', 'arquivos pcd', 'pcd file', 'pcd files', 'sua fe e be', 'nossa fe e be',
  // Apresentação de trabalho, não de pessoa.
  ...cross(['boa apresentacao', 'boas apresentacoes'], ['de', 'em', 'para', 'oral', 'orais', 'tecnica', 'tecnicas', 'dos', 'das', 'do', 'da', 'no', 'na', 'ao', 'a', 'executiva', 'executivas']),
  // O nome de uma regra de código limpo, e o calendário de feriados.
  'boy scout', 'boy scouts', 'religious holiday', 'religious holidays', 'feriado religioso', 'feriados religiosos',
];

export const LEXICON: Readonly<Record<ForbiddenTopic, TopicLexicon>> = {
  age: {
    anywhere: [
      'idade', 'idades', 'etaria', 'etarias', 'etario', 'etarios', 'etarismo', 'idadismo', 'ageismo', 'ageism', 'jovens', ...gen('idos'), 'maioridade', 'adolescente', 'adolescentes', 'teenager', 'teenagers',
      'perfil jovem', 'profissional jovem', 'pessoa jovem', 'jovem profissional', 'jovem talento', 'jovem aprendiz', 'menor aprendiz', 'espirito jovem', 'equipe jovem', 'time jovem',
      'profissional maduro', 'profissional madura', 'profissionais maduros', 'profissionais maduras', 'pessoa madura', 'pessoas maduras', 'perfil maduro', 'pessoa velha', 'pessoas velhas', 'profissional velho',
      ...gen('recem formad'), ...gen('recem graduad'), ...gen('recem egress'), ...gen('recemformad'), ...gen('recem said').map((form) => `${form} da faculdade`),
      'recent graduate', 'recent graduates', 'recent grad', 'recent grads', 'new grad', 'new grads', 'new graduate', 'new graduates', 'fresh graduate', 'fresh graduates', 'fresh grad', 'fresh grads', 'freshly graduated', 'newly graduated',
      ...cross(['formado', 'formada', 'formados', 'formadas', 'graduado', 'graduada', 'graduados', 'graduadas', 'conclusao', 'formatura'], ['ha', 'nos ultimos']), 'graduated within', 'graduated in the last',
      'geracao z', 'geracao x', 'geracao y', 'geracao alpha', 'geracao alfa', 'geracao millennial', 'gen z', 'gen x', 'gen y', 'gen alpha', 'genz', 'genx', 'geny', 'generation z', 'generation x', 'generation y', 'generation alpha',
      'millennial', 'millennials', 'milenial', 'milleniais', 'millenials', 'milenials', 'boomer', 'boomers', 'zoomer', 'zoomers',
      ...cross(['nascido', 'nascida', 'nascidos', 'nascidas', 'nascidoa', 'nascidoas', 'nascidosas'], ['em', 'entre', 'apos', 'antes', 'depois', 'a partir', 'ate', 'no ano', 'na decada']),
      'born in', 'born after', 'born before', 'born between', 'born on', 'born from', 'ano de nascimento', 'data de nascimento', 'date of birth', 'year of birth', 'birth year', 'birth date', 'birthdate',
      'years old', 'yrs old', 'years of age', 'year of age', 'age limit', 'age range', 'age group', 'age bracket', 'maximum age', 'minimum age', 'under the age', 'over the age',
      'regardless of age', 'any age', 'by age', 'age restriction', 'age requirement', 'age discrimination',
      'young professional', 'young professionals', 'young talent', 'young talents', 'young people', 'young person', 'young candidate', 'young candidates', 'young graduate', 'young graduates', 'youthful', 'young and dynamic', 'sangue novo', 'energia jovem', 'mente jovem', 'jovem e dinamico', 'jovem e dinamica',
      'digital native', 'digital natives', 'nativo digital', 'nativa digital', 'nativos digitais', 'nativas digitais',
      ...cross(['recent', 'recently', 'new', 'newly', 'fresh', 'freshly', 'just'], cross(['college', 'university', 'cs', 'bootcamp'], ['grad', 'grads', 'graduate', 'graduates'])), 'recently graduated', 'just graduated', 'fresh out of college', 'fresh out of school', 'fresh out of university', 'straight out of college', 'just out of college',
      'young blood', 'new blood', 'fresh blood', 'young at heart', 'too old', 'too young', 'muito velho', 'muito velha', 'muito jovem', 'velho demais', 'velha demais', 'jovem demais', 'sangue jovem', 'aposentados', 'aposentadas', 'retirees', 'pensioners',
      ...cross(['nascido', 'nascida', 'nascidos', 'nascidas'], ['nos anos', 'no', 'na']), 'geracao 60', 'geracao 70', 'geracao 80', 'geracao 90', 'geracao 2000',
    ],
    inTerm: [],
    wholeTerm: [
      'jovemns', 'anos 60', 'anos 70', 'anos 80', 'anos 90', 'anos 2000', 'age', 'ages', 'aged', 'max age', 'min age', 'mais velho', 'mais velha', 'mais novo', 'mais nova', 'mais jovem', 'jovem', 'young', 'younger', 'youth', 'old', 'older', 'elderly', ...gen('velh'), ...gen('madur'), 'mature', ...gen('aposentad'), 'retired', 'retiree', 'senior citizen',
      'nascimento', ...gen('nascid'), 'birth', 'birthday', 'born', 'dob', 'aniversario', 'trintao', 'trintona', 'quarentao', 'quarentona', 'cinquentao', 'cinquentona', 'menor', 'menores', 'teen', 'teens',
      ...gen('novinh'), ...gen('adult'), 'adult', 'adults',
    ],
  },
  gender: {
    anywhere: [
      'mulher', 'mulheres', 'homem', 'homens', 'genero', 'generos', 'sexo', 'sexos', 'feminino', 'feminina', 'femininos', 'femininas', 'masculino', 'masculina', 'masculinos', 'masculinas',
      'gender', 'genders', 'woman', 'women', 'men', 'female', 'females', 'male', 'males', 'of sex', 'by sex', 'transgenero', 'transgeneros', 'transgender', 'transexual', 'transexuais', 'transsexual', 'transsexuais',
      'travesti', 'travestis', 'cisgenero', 'cisgeneros', 'cisgender', 'nonbinary', 'genderqueer', 'genderfluid', 'pessoa trans', 'pessoas trans', 'trans people', 'trans person', 'pessoa nao binaria', 'pessoas nao binarias',
      'non binary people', 'non binary person', 'non binary candidates', ...cross(ONLY, WOMEN_AT_WORK), 'moca', 'mocas', 'rapaz', 'rapazes', 'menina', 'meninas', 'menino', 'meninos', 'garota', 'garotas', 'garoto', 'garotos',
      'guy', 'guys', 'dude', 'dudes', 'boy', 'boys', 'girl', 'girls', 'lady', 'ladies', 'gentleman', 'gentlemen', 'masculine', 'feminine', 'feminista', 'feministas', 'machista', 'machistas', 'dona de casa', 'donas de casa', 'pessoa cis', 'pessoas cis',
    ],
    inTerm: [],
    wholeTerm: [
      'trans', 'man', 'guy', 'guys', 'boy', 'boys', 'girl', 'girls', 'lady', 'ladies', 'gentleman', 'gentlemen', 'senhora', 'senhoras', 'senhor', 'senhores', 'non binary', ...gen('nao binari'),
      'pronome', 'pronomes', 'pronoun', 'pronouns', 'sex', 'sexes', 'macho', 'machos', 'femea', 'femeas', 'pyladies', 'reprograma', 'minas programam', 'girls in tech', 'rails girls',
    ],
  },
  orientation: {
    anywhere: [
      'orientacao sexual', 'orientacoes sexuais', 'sexual orientation', 'sexualidade', 'sexuality', 'gay', 'gays', 'lesbica', 'lesbicas', 'lesbian', 'lesbians', 'bissexual', 'bissexuais', 'bisexual', 'bisexuals',
      'homossexual', 'homossexuais', 'homosexual', 'homosexuals', 'heterossexual', 'heterossexuais', 'heterosexual', 'heterosexuals', 'hetero', 'heteros', 'pansexual', 'pansexuais', 'pansexuals', 'assexual', 'assexuais', 'asexual',
      'queer', 'queers', 'lgbt', 'lgbts', 'lgbtq', 'lgbtqi', 'lgbti', 'lgbtqia', 'lgbtqiap', 'glbt', 'preferencia sexual', 'sexual preference', 'diversidade sexual', ...gen('homoafetiv'), 'same sex',
    ],
    inTerm: [],
    wholeTerm: ['straight', 'sexual'],
  },
  race: {
    anywhere: [
      'raca', 'racas', 'racial', 'raciais', 'racista', 'racistas', 'racismo', 'etnia', 'etnias', ...gen('etnic'), 'ethnic', 'ethnicity', 'ethnicities', 'cor da pele', 'cor de pele', 'tom de pele', 'pele branca', 'pele negra', 'pele morena', 'pele clara', 'pele escura',
      'skin color', 'skin colour', 'skin tone', 'pessoa de cor', 'pessoas de cor', 'person of color', 'people of color', 'person of colour', 'people of colour', 'bipoc', 'afrodescendente', 'afrodescendentes', 'afro descendente', 'afro descendentes',
      ...gen('afro brasileir'), ...gen('afrobrasileir'), 'african american', 'african americans', 'afro american', 'afro americans', 'negritude', ...gen('mestic'), ...gen('mulat'), ...gen('caucasian'), 'caucasian', 'caucasians',
      'indigena', 'indigenas', 'indigenous', 'hispanic', 'hispanics', 'latinx', 'quilombola', 'quilombolas', 'negros', 'negras', 'of race', 'by race', 'race or', 'race and', 'race gender', 'gender race', 'race ethnicity', 'race color',
      'white people', 'black people', 'white person', 'black person', 'white candidates', 'black candidates', 'white professionals', 'black professionals', 'whites only', 'blacks only', 'white only', 'black only',
      ...cross(PERSON, COLOR_WORDS), ...cross(ONLY, COLOR_PLURALS),
    ],
    inTerm: [],
    wholeTerm: ['black in ai', 'afropython', 'pretalab', 'race', 'races', 'cor', 'cores', 'color', 'colour', 'black', 'blacks', 'white', 'whites', ...COLOR_WORDS, 'negr', 'pret', 'pard', 'branc', ...gen('asiatic'), 'asian', 'asians', 'oriental', 'orientais', ...gen('latin'), ...gen('moren')],
  },
  appearance: {
    anywhere: [
      'boa aparencia', 'boas aparencias', 'boa apresentacao pessoal', 'aparencia fisica', 'aparencia agradavel', 'bela aparencia', 'otima aparencia', 'excelente aparencia', 'aparencia profissional', 'good appearance', 'pleasant appearance',
      'physical appearance', 'professional appearance', ...gen('bem apresentad'), 'bem apresentavel', 'bem apresentaveis', 'apresentavel', 'apresentaveis', ...gen('bem vestid'), 'curriculo com foto', 'cv com foto', 'foto no curriculo',
      'foto no cv', 'foto 3x4', 'foto de corpo', 'envie foto', 'enviar foto', 'resume with photo', 'photo required', 'attach a photo', 'send a photo', 'send your photo', 'headshot', 'peso ideal', 'altura minima', 'altura maxima', 'porte fisico', 'biotipo',
      'tatuagem', 'tatuagens', 'tattoo', 'tattoos', 'piercing', 'piercings', 'barba', 'cabelo', 'cabelos', ...gen('loir'), ...gen('ruiv'), 'olhos azuis', 'olhos claros', 'blond', 'blonde', 'blondes',
      'apresentacao pessoal', 'boa apresentacao', 'boas apresentacoes', 'boa imagem', 'imagem pessoal', 'aparencia cuidada', 'aparencia jovem', 'good looks', 'well groomed', 'well dressed', 'nice looking', 'clean shaven', 'foto recente', 'foto atualizada', 'foto de rosto', 'foto do rosto', 'recent photo', 'recent picture',
      'attractive appearance', 'nice appearance', 'neat appearance', 'appearance required', 'aparencia exigida', 'with a photo', 'with photo', 'with your photo', 'with a picture', 'with your picture', 'include a photo', 'include your photo', 'include a picture', 'photo of yourself', 'picture of yourself', 'porte atletico', 'boa forma', 'padrao de beleza', 'padrao estetico', 'beauty standard', 'beauty standards', 'physically attractive',
    ],
    inTerm: [],
    wholeTerm: [
      'aparencia', 'appearance', 'foto', 'fotos', 'photo', 'photos', 'picture', 'foto de perfil', 'foto no perfil', 'profile photo', 'profile picture', 'peso', 'altura', 'estatura', 'height', 'weight', ...gen('magr'), ...gen('gord'), ...gen('bonit'), 'attractive', 'beautiful', 'pretty', 'estetica', 'beleza', 'beauty', 'boa presenca', 'boa apresentacao', 'selfie', 'atraente', 'atraentes', 'handsome', 'overweight', 'good looking', 'good looks',
    ],
  },
  religion: {
    anywhere: [
      'religiao', 'religioes', ...gen('religios'), 'religion', 'religions', 'religious', 'crenca religiosa', 'crencas religiosas', 'fe crista', 'sua fe', 'cristao', 'crista', 'cristaos', 'cristas', 'christian', 'christians', ...gen('catolic'), 'catholic', 'catholics',
      ...gen('evangelic'), 'evangelical', 'evangelicals', 'protestante', 'protestantes', 'protestant', 'protestants', 'espirita', 'espiritas', 'spiritist', 'judeu', 'judia', 'judeus', 'judias', 'jewish', ...gen('muculman'), 'muslim', 'muslims', ...gen('islamic'), 'islamic', 'islam',
      'budista', 'budistas', 'buddhist', 'buddhists', 'hindu', 'hindus', 'umbandista', 'umbandistas', 'umbanda', 'candomble', 'ateu', 'ateia', 'ateus', 'ateias', 'atheist', 'atheists', 'igreja', 'igrejas', 'church', 'churches', 'deus', 'temente', 'tementes', 'believe in god',
      'guarda o sabado', 'guardar o sabado', 'sabatista', 'sabatistas', 'adventista', 'adventistas', 'testemunha de jeova', 'testemunhas de jeova', 'mormon', 'mormons', 'judaismo', 'judaism', 'cristianismo', 'christianity', 'catolicismo', 'catholicism', 'islamismo', 'budismo', 'buddhism',
      'hinduismo', 'hinduism', 'espiritismo', 'ateismo', 'atheism', 'hijab', 'kosher', 'halal',
      ...cross(PERSON, ['de fe']), 'nossa fe', 'mesma fe', 'crente', 'crentes', 'guarde o sabado', 'guardam o sabado', 'guardem o sabado', 'guardar sabado', 'sabbath', 'shabbat', 'congregacao', 'congregacoes', 'valores cristaos', 'valores religiosos', 'christian values', 'religious values', 'our faith', 'person of faith', 'people of faith',
      'faith based', 'god fearing', 'believer in', 'sikh', 'sikhs',
    ],
    inTerm: [],
    wholeTerm: ['credo', 'crenca', 'crencas', 'belief', 'beliefs', 'faith', 'god', 'pastor', 'pastora', 'padre', 'freira', 'bispo', 'biblia', 'bible', ...gen('agnostic'), 'agnostic', 'agnostics'],
  },
  politics: {
    anywhere: [
      'partido politico', 'partidos politicos', 'filiacao partidaria', 'filiado a partido', 'filiada a partido', 'politica partidaria', 'opiniao politica', 'opinioes politicas', 'orientacao politica', 'posicao politica', 'posicionamento politico', 'ideologia politica', 'visao politica',
      'political party', 'political parties', 'political affiliation', 'political view', 'political views', 'political opinion', 'political opinions', 'political belief', 'political beliefs', 'politics', 'union member', 'union members', 'union membership', 'trade union', 'labor union', 'labour union',
      'sindicato', 'sindicatos', ...gen('sindicalizad'), 'sindicalista', 'sindicalistas', 'bolsonarista', 'bolsonaristas', 'lulista', 'lulistas', 'petista', 'petistas', 'esquerdista', 'esquerdistas', 'direitista', 'direitistas', 'comunista', 'comunistas', 'socialista', 'socialistas', 'fascista', 'fascistas',
      'anarquista', 'anarquistas', 'em quem votou', 'em quem voce votou', 'who did you vote for', 'ativista', 'ativistas', 'ativismo', 'activist', 'activists', 'activism',
      'movimento social', 'movimentos sociais', 'movimento sindical', 'movimentos sindicais', 'movimento estudantil', 'envolvimento politico', 'envolvimento partidario', 'envolvimento sindical', 'vinculo sindical', 'vinculo partidario', 'atividade sindical', 'atividade politica', 'filiacao sindical', 'militante', 'militantes', 'militancia',
      'alinhamento politico', 'alinhamento ideologico', 'partido de esquerda', 'partido de direita', 'partidos de esquerda', 'partidos de direita', 'apoia partido', 'apoie partido', 'apoiam partido', 'sem partido', 'apartidario', 'apartidaria', 'apolitico', 'apolitica', 'partidario', 'partidaria', 'valores conservadores', 'valores progressistas', 'valores de direita', 'valores de esquerda', 'conservative values', 'liberal values', 'progressive values', 'political activity', 'political activism', 'social movement', 'social movements',
      'anti union', 'non union', 'union free', 'unionized', 'non unionized', 'union activity', 'union affiliation', 'eleitor de', 'eleitora de', 'eleitores de', 'eleitoras de', 'votou em', 'voted for', 'vote for', 'grevista', 'grevistas', 'greve', 'greves', 'patriota', 'patriotas', 'bolsonaro',
      ...cross([...PERSON, 'perfil', 'ser', 'seja', 'sejam', 'alinhado', 'alinhada', 'alinhados', 'alinhadas'], ['de direita', 'de esquerda', 'conservador', 'conservadora', 'conservadores', 'conservadoras', 'progressista', 'progressistas']),
    ],
    inTerm: [],
    wholeTerm: [
      'politica', 'politicas', 'politico', 'politicos', 'political', 'partido', 'partidos', 'de esquerda', 'de direita', 'esquerda', 'direita', 'conservadora', 'conservadoras', 'conservadores', 'conservador', 'conservative', 'conservatives', 'liberal', 'liberais', 'liberals',
      'republicano', 'republicana', 'republicanos', 'republicanas', 'republican', 'republicans', 'democrata', 'democratas', 'democrat', 'democrats', 'union', 'unions', 'sindical', 'psol', 'psdb',
    ],
  },
  marital_family: {
    anywhere: [
      'estado civil', 'estados civis', 'marital status', 'civil status', 'family status', 'relationship status', 'parental status', ...gen('solteir'), 'solteir', ...gen('casad'), 'casad', ...gen('divorciad'), ...gen('viuv'), 'viuvez', 'uniao estavel', ...gen('amasiad'), ...gen('noiv'),
      'married', 'unmarried', 'divorced', 'widowed', 'single parent', 'single parents', 'single mother', 'single mom', 'single father', 'single dad', 'sem filhos', 'sem filho', 'tem filhos', 'ter filhos', 'possui filhos', 'possuir filhos', 'quantos filhos', 'pessoa com filhos',
      'pessoas com filhos', 'nao tem filhos', 'nao ter filhos', 'filhos pequenos', 'filho pequeno', 'filhas pequenas', 'filha pequena', 'filhos menores', 'filho menor', 'filha menor', 'mae solo', 'pai solo', 'maes solo', 'pais solo', 'sem dependentes', 'tem dependentes', 'without children', 'without kids',
      'childless', 'childfree', 'do you have children', 'do you have kids', 'candidates with children', 'people with children', 'conjuge', 'conjuges', 'spouse', 'spouses', 'esposa', 'esposo', 'esposas', 'esposos', 'marido', 'maridos', 'wife', 'wives', 'husband', 'husbands', ...gen('namorad'),
      'planejamento familiar', 'family planning', 'compromisso familiar', 'compromissos familiares', 'familia constituida', 'pretende engravidar', 'engravidar',
      ...cross(['filhos', 'filhos ja', 'filhas', 'filhas ja'], ['criados', 'criadas', 'adultos', 'adultas', 'crescidos', 'crescidas', 'grandes', 'independentes']), 'no kids', 'no children', 'no dependents', 'no dependants', 'no family', 'no spouse', 'has kids', 'have kids', 'having kids', 'has children', 'have children', 'having children',
      'single candidates', 'single applicants', 'single people', 'single men', 'single women', 'sem familia', 'vinculo familiar', 'vinculos familiares', 'obrigacoes familiares', 'family obligations', 'family commitments', 'family ties', 'chefe de familia', 'mae de familia', 'pai de familia', 'mother of', 'father of',
    ],
    inTerm: [],
    wholeTerm: [
      'filho', 'filha', 'filhos', 'filhas', 'filhoa', 'filhosas', 'child', 'children', 'kid', 'kids', 'mae', 'maes', 'pai', 'pais', 'mother', 'mothers', 'father', 'fathers', 'mom', 'moms', 'dad', 'dads', 'parent', 'parents', 'familia', 'familias', 'family', 'families', 'dependente', 'dependentes',
      'dependent', 'dependents', 'widow', 'widower', 'casamento', 'marriage', 'divorcio', 'divorce', 'single', 'singles', ...gen('separad'), 'noivado', 'maternidade', 'paternidade', 'motherhood', 'fatherhood',
      'licenca maternidade', 'licenca paternidade', 'maternity leave', 'paternity leave', 'parental leave', 'pausa na carreira', 'pausa de carreira', 'career break',
    ],
  },
  disability_health: {
    anywhere: [
      'pcd', 'pcds', 'deficiencia', 'pessoa com deficiencia', 'pessoas com deficiencia', 'pessoas com deficiencias', 'deficiente', 'deficientes', 'necessidades especiais', 'necessidade especial', 'special needs', 'disability', 'disabilities', 'disabled',
      'deaf', ...gen('surd'), 'pessoa cega', 'pessoas cegas', 'profissional cego', 'profissional cega', 'cadeirante', 'cadeirantes', 'wheelchair', 'autista', 'autistas', 'autismo', 'autism', 'autistic', 'tdah', 'adhd', 'dislexia', 'dyslexia', 'neurodivergente', 'neurodivergentes', 'neurodivergent',
      ...gen('neurodivers'), 'neurodiverse', 'neurodiversidade', 'neurodiversity', 'problema de saude', 'problemas de saude', 'condicao de saude', 'condicoes de saude', 'estado de saude', 'boa saude',
      'health condition', 'health conditions', 'health issue', 'health issues', 'health problem', 'health problems', 'good health', 'doenca cronica', 'doencas cronicas', 'alguma doenca', 'sem doenca', 'sem doencas', 'chronic illness', 'chronic illnesses',
      'gravida', 'gravidas', 'gravidez', 'gestante', 'gestantes', 'pregnant', 'pregnancy', 'laudo medico', 'atestado medico', 'atestado de saude', 'fumante', 'fumantes', 'nao fumante', 'non smoker', 'non smokers', 'nonsmoker', 'nonsmokers', 'smoker', 'smokers', ...gen('obes'), 'obesidade', 'obese', 'obesity',
      'mobilidade reduzida', 'limitacao fisica', 'limitacoes fisicas', 'deficiencia fisica', 'aptidao fisica', 'physically fit', 'able bodied', ...gen('vacinad'), ...gen('soropositiv'), 'hiv positivo', 'hiv positive', 'portador de hiv', 'portadora de hiv',
      'saude perfeita', 'perfeita saude', 'excelente saude', 'historico de doencas', 'historico de doenca', 'pne', 'pnes', 'saude em dia', 'exames em dia', 'vacinas em dia', 'vacinacao em dia', 'carteira de vacinacao', 'cartao de vacina', 'cartao de vacinacao', 'vaccinated', 'unvaccinated', 'proof of vaccination', 'vaccination required', 'vaccination status', 'comorbidade', 'comorbidades', 'restricao medica', 'restricoes medicas', 'medical restriction', 'medical restrictions',
      ...gen('neurotipic'), 'neurotypical', ...gen('neuroatipic'), 'dependente quimico', 'dependente quimica', 'dependencia quimica', 'alcoolatra', 'alcoolismo', 'preparo fisico', 'forma fisica', 'physically able', 'physical fitness',
      // Vaga afirmativa é legítima, mas fica fora da ferramenta (RF-16, DP-07).
      'vaga afirmativa', 'vagas afirmativas', 'acao afirmativa', 'acoes afirmativas', 'affirmative action', 'grupo minorizado', 'grupos minorizados', 'grupos sub representados', 'grupos subrepresentados', 'underrepresented', 'minorias', 'minorities', 'cotista', 'cotistas', 'lei de cotas', 'cota racial', 'cotas raciais', 'sistema de cotas', 'processo seletivo afirmativo',
    ],
    inTerm: [],
    wholeTerm: [
      'saude', 'health', 'saude mental', 'mental health', 'historico de saude', 'historico medico', 'condicao medica', 'condicoes medicas', 'medical condition', 'medical conditions', 'medical history', 'blind', ...gen('ceg'), ...gen('mud'), 'deficiencias', 'doenca', 'doencas', 'doente', 'doentes', 'illness', 'sick', 'cancer', 'diabetes', ...gen('diabetic'), 'asma', 'asthma', 'hiv', 'aids', 'depressao', 'depression', 'ansiedade', 'anxiety', 'bipolar', 'bipolaridade',
      'esquizofrenia', 'schizophrenia', 'epilepsia', 'epilepsy', ...gen('reabilitad'), 'laudo', 'atestado', 'cid', 'saudavel', 'saudaveis', 'healthy', 'afirmativa', 'afirmativas', 'diversidade', 'diversity', 'minorizado', 'minorizados', 'minorizada', 'minorizadas',
    ],
  },
  nationality_origin: {
    anywhere: [
      'nacionalidade', 'nacionalidades', 'nationality', 'nationalities', 'national origin', 'pais de origem', 'country of origin', 'country of birth', 'place of birth', 'local de nascimento', 'origem nacional', 'cidadania', 'citizenship', 'cidadao brasileiro', 'cidada brasileira', 'cidadaos brasileiros',
      'us citizen', 'us citizens', 'u s citizen', 'u s citizens', 'american citizen', 'american citizens', 'brazilian citizen', 'brazilian citizens', 'citizens only', 'citizen only', 'foreigner', 'foreigners', 'imigrante', 'imigrantes', 'immigrant', 'immigrants', 'migrante', 'migrantes', ...gen('refugiad'), 'refugee', 'refugees',
      'naturais de', 'ser natural de', 'seja natural de', 'sua naturalidade', 'naturalidade brasileira', 'descendente de', 'descendentes de', 'ascendencia', 'ancestry', 'sem sotaque', 'without an accent', 'must be american', 'must be brazilian', 'americans only', 'brazilians only', 'only americans', 'only brazilians', 'native born',
      ...cross(ONLY, DEMONYM_PLURALS), ...cross(['ser', 'seja', 'sejam', 'sendo', 'profissional', 'profissionais', 'pessoa', 'pessoas', 'candidato', 'candidata', 'candidatos', 'candidatas', 'precisa ser'], DEMONYM_WORDS),
      ...cross(DEMONYM_WORDS, ['nato', 'nata', 'natos', 'natas']), 'native speaker', 'native speakers', 'falante nativo', 'falante nativa', 'falantes nativos', 'falantes nativas', 'mother tongue', 'naturalizado', 'naturalizada', 'naturalizados', 'naturalizadas', 'naturalized',
      'brazilian born', 'american born', 'canadian born', 'european born', 'us born', 'u s born', 'foreign born', 'eu citizen', 'eu citizens', 'uk citizen', 'uk citizens', 'canadian citizen', 'canadian citizens', 'citizen of', 'citizens of', 'cidadao de', 'cidada de', 'cidadaos de', 'cidadas de',
    ],
    inTerm: ['natural de'],
    wholeTerm: [
      ...COUNTRIES, ...DEMONYM_WORDS, ...LANGUAGE_DEMONYMS, 'brasileir', 'american', 'americans', 'brazilian', 'brazilians', 'canadian', 'canadians', 'indian', 'indians', 'mexican', 'mexicans', 'argentinian', 'argentinians', 'african', 'africans', 'expat', 'expats', 'nato', 'nata', 'natos', 'natas', 'origem', 'origin', 'pais', 'country',
      'naturalidade', 'descendente', 'descendentes', 'sotaque', 'paulista', 'paulistas', 'paulistano', 'paulistana', 'carioca', 'cariocas', ...gen('baian'), ...gen('mineir'), ...gen('gauch'), 'nacional', 'nacionais', 'national',
    ],
  },
  address_distance: {
    anywhere: [
      'mora perto', 'morar perto', 'more perto', 'mora proximo', 'morar proximo', 'more proximo', 'mora proxima', 'morar proxima', 'morar em', 'mora em', 'more em', 'moram em', 'morem em', 'morar na', 'morar no', 'mora na', 'mora no', 'more na', 'moram na', 'moram no', 'morem na', 'morem no',
      'morar a', 'morando em', 'morando na', 'morando no', 'morando perto', 'morando proximo', ...cross(['morador', 'moradora', 'moradores', 'moradoras'], ['de', 'da', 'do', 'na', 'no', 'em', 'proximo', 'perto']),
      'residir em', 'resida em', 'residam em', 'residindo em', 'residir na', 'residir no', 'resida na', 'resida no', 'residam na', 'residam no', 'residir proximo', 'residir perto', 'resida perto', 'resida proximo', 'residindo proximo', 'residindo perto',
      'residente em', 'residentes em', 'residente na', 'residente no', 'residentes na', 'residentes no', 'que reside em', 'quem reside em', 'que reside na', 'que reside no', 'quem reside na', 'quem reside no', 'que reside perto', 'que reside proximo', 'quem reside perto', 'quem reside proximo',
      'residencia proxima', 'residencia fixa', 'comprovante de residencia', 'comprovante de endereco', 'endereco residencial', 'endereco fixo', 'facil acesso ao trabalho', 'distancia de casa', 'distancia da empresa', 'distancia do escritorio', 'km da empresa', 'km do escritorio', 'km de distancia', 'tempo de deslocamento',
      'home address', 'residential address', ...cross(['must', 'should', 'need to', 'needs to', 'have to', 'has to', 'required to'], ['live in', 'live near', 'live within', 'live close', 'reside in', 'reside near', 'reside within', 'be based in', 'be located in']), 'who live in', 'who lives in', 'who reside in',
      'who resides in', 'you live in', 'you reside in', 'candidates based in', 'candidates living in', 'candidates residing in', 'candidates located in', 'live near', 'lives near', 'living near', 'live close to', 'lives close to', 'living close to', 'close to the office', 'close to our office', 'near the office', 'near our office',
      'commuting distance', 'within commuting', 'reliably commute', 'able to commute', 'easy commute', 'short commute', 'commutable', 'minute commute', 'minutes commute', 'minutos de deslocamento', 'minutos de casa', 'moro perto', 'moro em', 'moro na', 'moro no', 'moro proximo', 'que more', 'que morem', 'que mora', 'que moram', 'quem mora', 'quem more', 'quem vive', 'que viva', 'que vivam', 'que vive', 'que vivem',
      'candidate address', 'candidates address', 'endereco do candidato', 'endereco da candidata', 'seu cep', 'informe o cep', 'informe seu cep', 'informe o seu cep', 'informar o cep', 'informar seu cep', 'qual o seu cep', 'qual seu cep', 'cep de residencia', 'cep da residencia', 'cep residencial', 'seu endereco', 'informe seu endereco', 'informe o endereco', 'informar endereco', 'informar o endereco', 'ter residencia', 'tenha residencia', 'com residencia em',
    ],
    inTerm: [
      'reside em', 'reside na', 'reside no', 'reside perto', 'reside proximo', 'residem em', 'residencia em', 'e regiao', 'bairro', 'bairros', 'zona sul', 'zona norte', 'zona leste', 'zona oeste', 'zona central', 'proximo ao metro', 'proxima ao metro', 'proximo do metro', 'proxima do metro', 'perto do metro', 'perto de metro', 'proximo a estacao',
      'proxima a estacao', 'perto da estacao', 'proximo da estacao', 'proximo ao escritorio', 'proxima ao escritorio', 'perto do escritorio', 'proximo da empresa', 'proxima da empresa', 'proximo a empresa', 'proxima a empresa', 'perto da empresa', 'perto do trabalho', 'proximo ao trabalho', 'perto de casa',
      'regiao metropolitana', 'grande sao paulo', 'grande sp', 'grande rio', 'grande bh', 'abc paulista', 'baixada santista', 'mesma cidade', 'mesmo bairro', 'mesma regiao', 'perto de', 'proximo de', 'proxima de', 'lives in', 'live in', 'living in', 'based in', 'located in', 'resides in', 'residing in', 'reside in', 'resident of',
      'residents of', 'zip code', 'zipcode', 'postal code', 'neighborhood', 'neighbourhood', 'near the subway', 'near the metro', 'close to the subway', 'close to the metro',
    ],
    wholeTerm: [
      ...BRAZILIAN_CAPITALS, ...OTHER_CITIES, ...PLACE_NICKNAMES, ...BRAZILIAN_STATES, 'local', 'locals', 'endereco', 'enderecos', 'address', 'addresses', 'distancia', 'distance', 'localizacao', 'location', 'moradia', 'residencia', 'residente', 'residentes', 'residencial', 'residence', 'vizinhanca', 'centro', 'downtown', 'regiao', 'capital', 'interior',
      'litoral', 'sul', 'norte', 'leste', 'oeste', 'perto', 'proximo', 'proxima', 'proximos', 'proximas', 'nearby', 'near', 'cidade', 'city', 'municipio', 'km', 'mora', 'morar', 'moro', 'morador', 'moradora', 'moradores', 'moradoras',
    ],
  },
  max_experience: {
    anywhere: ['experiencia maxima', 'maximo de experiencia', 'teto de experiencia', 'limite de experiencia', 'experiencia demais', 'maximum experience', 'max experience', 'experience cap', 'overqualified', 'overqualification', ...gen('sobrequalificad'), ...gen('superqualificad')],
    inTerm: [],
    wholeTerm: [],
  },
};

/** Quem é chamado pelo cargo ou como pessoa. Em português o atributo vem depois da palavra: "desenvolvedora negra". */
export const PERSON_WORDS_PT: readonly string[] = [
  ...PERSON, 'dev', 'devs', 'desenvolvedor', 'desenvolvedora', 'desenvolvedores', 'desenvolvedoras', 'programador', 'programadora', 'programadores', 'programadoras', ...gen('engenheir'), 'analista', 'analistas', ...gen('arquitet'), ...gen('estagiari'), 'trainee', 'trainees',
  'consultor', 'consultora', 'consultores', 'consultoras', 'especialista', 'especialistas', 'colaborador', 'colaboradora', 'colaboradores', 'colaboradoras', ...gen('funcionari'), 'gerente', 'gerentes', 'gestor', 'gestora', 'gestores', 'gestoras', 'coordenador', 'coordenadora',
  'coordenadores', 'coordenadoras', 'lider', 'lideres', 'talento', 'talentos', 'cientista', 'cientistas', 'administrador', 'administradora', 'administradores', 'administradoras', 'designer', 'designers', 'tester', 'testers', 'cidadao', 'cidada', 'cidadaos', 'cidadas',
  'vendedor', 'vendedora', 'recepcionista', 'atendente', 'aprendiz',
];

/** Em inglês o atributo vem antes: "black engineers". "dev" no singular fica de fora: "local dev environment". */
export const PERSON_WORDS_EN: readonly string[] = [
  'person', 'people', 'candidate', 'candidates', 'applicant', 'applicants', 'engineer', 'engineers', 'developer', 'developers', 'devs', 'programmer', 'programmers', 'coder', 'coders', 'professional', 'professionals', 'talent', 'talents', 'analyst', 'analysts', 'architect', 'architects',
  'manager', 'managers', 'employee', 'employees', 'intern', 'interns', 'worker', 'workers', 'consultant', 'consultants', 'specialist', 'specialists', 'hire', 'hires', 'recruit', 'recruits', 'staff', 'scientist', 'scientists', 'designer', 'designers', 'tester', 'testers',
  'administrator', 'administrators', 'sysadmin', 'sysadmins', 'citizen', 'citizens', 'man', 'men', 'woman', 'women', 'guy', 'guys', 'girl', 'girls', 'boy', 'boys', 'lady', 'ladies', 'grad', 'grads', 'graduate', 'graduates', 'student', 'students',
];

/** Palavra ambígua que só fala de pessoa junto de quem é pessoa. loose aceita outra palavra no meio: "Programador Java jovem". */
export interface PersonAttribute {
  readonly topic: ForbiddenTopic;
  readonly loose: boolean;
}

function attributes(groups: readonly (readonly [ForbiddenTopic, boolean, readonly string[]])[]): ReadonlyMap<string, PersonAttribute> {
  const table = new Map<string, PersonAttribute>();
  for (const [topic, loose, words] of groups) {
    for (const word of words) if (!table.has(word)) table.set(word, { topic, loose });
  }
  return table;
}

/** Depois da palavra de pessoa, em português. */
export const ATTRIBUTES_AFTER_PT: ReadonlyMap<string, PersonAttribute> = attributes([
  ['age', true, ['jovem', 'jovens']],
  ['age', false, [...gen('madur'), ...gen('velh'), ...gen('novinh'), ...gen('aposentad'), 'idoso', 'idosa', 'idosos', 'idosas']],
  ['race', true, [...COLOR_WORDS, ...gen('asiatic'), ...gen('latin'), ...gen('moren'), 'oriental', 'orientais']],
  ['gender', true, ['trans', 'cis']],
  ['appearance', false, [...gen('bonit'), ...gen('magr'), ...gen('gord'), 'atraente', 'atraentes']],
  ['disability_health', false, ['saudavel', 'saudaveis', ...gen('ceg'), ...gen('mud')]],
  ['nationality_origin', true, [...DEMONYM_WORDS, ...LANGUAGE_DEMONYMS, 'paulista', 'paulistas', 'paulistano', 'paulistana', 'carioca', 'cariocas', ...gen('baian'), ...gen('mineir'), ...gen('gauch')]],
  ['politics', false, ['conservador', 'conservadora', 'conservadores', 'conservadoras', 'progressista', 'progressistas']],
]);

/** Antes da palavra de pessoa, em inglês. "jovem" também costuma vir antes em português. */
export const ATTRIBUTES_BEFORE: ReadonlyMap<string, PersonAttribute> = attributes([
  ['age', true, ['young', 'younger', 'jovem']],
  ['age', false, ['old', 'older', 'mature', 'elderly', 'retired']],
  ['race', true, ['black', 'white', 'asian', 'latino', 'latina', 'latinos', 'latinas', 'brown', 'arab', 'hispanic']],
  ['gender', true, ['trans', 'transgender', 'cis', 'cisgender']],
  ['orientation', false, ['straight']],
  ['appearance', false, ['attractive', 'beautiful', 'pretty', 'handsome']],
  ['disability_health', false, ['healthy', 'blind']],
  ['nationality_origin', false, ['american', 'brazilian', 'canadian', 'indian', 'mexican', 'argentinian', 'african', 'european', 'chinese', 'japanese', 'korean', 'german', 'french', 'italian', 'spanish', 'portuguese', 'russian', 'ukrainian', 'polish', 'british', 'venezuelan', 'colombian', 'chilean', 'peruvian', 'nigerian', 'haitian', 'cuban', 'foreign']],
  ['address_distance', false, ['local']],
]);

/** A origem no plural, abrindo a frase, é gente: "Nordestinos não serão considerados". Sem o feminino: "Americanas" é nome de varejista. */
export const OPENING_DEMONYMS: readonly string[] = [...DEMONYM_STEMS.map((stem) => `${stem}os`), 'gringos', 'alemaes', 'japoneses', 'chineses', 'espanhois', 'franceses', 'portugueses', 'ingleses', 'russos', 'coreanos', 'italianos'];

/** Plural de origem e de cor em inglês, que só fala de gente: "Asians only", "Locals preferred". */
export const ENGLISH_PEOPLE_PLURALS: ReadonlyMap<string, ForbiddenTopic> = new Map<string, ForbiddenTopic>([
  ['singles', 'marital_family'], ['locals', 'address_distance'], ['asians', 'race'], ['blacks', 'race'], ['whites', 'race'], ['latinos', 'race'], ['latinas', 'race'], ['hispanics', 'race'], ['americans', 'nationality_origin'], ['brazilians', 'nationality_origin'], ['canadians', 'nationality_origin'],
  ['mexicans', 'nationality_origin'], ['europeans', 'nationality_origin'], ['indians', 'nationality_origin'], ['africans', 'nationality_origin'], ['young', 'age'], ['elderly', 'age'],
]);
