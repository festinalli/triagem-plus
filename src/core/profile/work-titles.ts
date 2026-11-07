// Lista fechada de cargos (RF-42, DP-23). É a única origem do cargo na ficha: a linha do perfil só serve para reconhecer, e o que
// fica guardado é o rótulo escrito aqui, neutro de gênero. Nenhuma palavra da linha passa adiante, então frase pessoal, empresa e
// local não têm caminho até a ficha. A mesma lista é um dos sinais de trabalho de DP-24.
//
// Cargo fora da lista fica vazio na ficha, e só o teste real dirá quanto isso pesa (DP-23). Palavra de pausa, de família ou de
// saúde nunca entra aqui.
import { normalize } from '../text/normalize.ts';
import { MAX_SHORT_LINE } from './lines.ts';

export interface WorkTitle {
  readonly masculine: string;
  readonly feminine: string;
  /** O rótulo guardado na ficha. */
  readonly neutral: string;
  /** Outras grafias da mesma função, como a inglesa, sem marca de gênero. */
  readonly others: readonly string[];
}

function role(masculine: string, feminine: string, neutral: string, others: readonly string[] = []): WorkTitle {
  return { masculine, feminine, neutral, others };
}

function same(name: string, others: readonly string[] = []): WorkTitle {
  return role(name, name, name, others);
}

export const WORK_TITLES: readonly WorkTitle[] = [
  // Desenvolvimento
  role('Desenvolvedor', 'Desenvolvedora', 'Desenvolvedor(a)', ['developer', 'dev']),
  role('Desenvolvedor de software', 'Desenvolvedora de software', 'Desenvolvedor(a) de software', ['software developer']),
  role('Desenvolvedor back-end', 'Desenvolvedora back-end', 'Desenvolvedor(a) back-end', ['back-end developer', 'back-end engineer']),
  role('Desenvolvedor front-end', 'Desenvolvedora front-end', 'Desenvolvedor(a) front-end', ['front-end developer', 'front-end engineer']),
  role('Desenvolvedor full stack', 'Desenvolvedora full stack', 'Desenvolvedor(a) full stack', ['full stack developer', 'full stack engineer']),
  role('Desenvolvedor mobile', 'Desenvolvedora mobile', 'Desenvolvedor(a) mobile', [
    'mobile developer', 'mobile engineer', 'android developer', 'ios developer', 'desenvolvedor android', 'desenvolvedora android', 'desenvolvedor ios', 'desenvolvedora ios',
  ]),
  role('Desenvolvedor web', 'Desenvolvedora web', 'Desenvolvedor(a) web', ['web developer']),
  role('Programador', 'Programadora', 'Programador(a)', ['programmer']),
  // Engenharia
  role('Engenheiro', 'Engenheira', 'Engenheiro(a)', ['engineer', 'eng']),
  role('Engenheiro de software', 'Engenheira de software', 'Engenheiro(a) de software', ['software engineer', 'eng de software', 'eng software']),
  role('Engenheiro de dados', 'Engenheira de dados', 'Engenheiro(a) de dados', ['data engineer', 'eng de dados']),
  role('Engenheiro de machine learning', 'Engenheira de machine learning', 'Engenheiro(a) de machine learning', [
    'machine learning engineer', 'ml engineer', 'engenheiro de ml', 'engenheira de ml',
  ]),
  role('Engenheiro de sistemas', 'Engenheira de sistemas', 'Engenheiro(a) de sistemas', ['systems engineer']),
  role('Engenheiro de plataforma', 'Engenheira de plataforma', 'Engenheiro(a) de plataforma', ['platform engineer']),
  role('Engenheiro de infraestrutura', 'Engenheira de infraestrutura', 'Engenheiro(a) de infraestrutura', ['infrastructure engineer']),
  role('Engenheiro de segurança', 'Engenheira de segurança', 'Engenheiro(a) de segurança', ['security engineer']),
  role('Engenheiro de computação', 'Engenheira de computação', 'Engenheiro(a) de computação', ['computer engineer']),
  role('Engenheiro DevOps', 'Engenheira DevOps', 'Engenheiro(a) DevOps', ['devops engineer', 'engenheiro de devops', 'engenheira de devops']),
  role('Engenheiro de QA', 'Engenheira de QA', 'Engenheiro(a) de QA', ['qa engineer', 'test engineer', 'engenheiro de testes', 'engenheira de testes']),
  same('DevOps'),
  same('SRE', ['site reliability engineer']),
  same('QA', ['quality assurance']),
  // Arquitetura
  role('Arquiteto', 'Arquiteta', 'Arquiteto(a)', ['architect']),
  role('Arquiteto de software', 'Arquiteta de software', 'Arquiteto(a) de software', ['software architect']),
  role('Arquiteto de soluções', 'Arquiteta de soluções', 'Arquiteto(a) de soluções', ['solutions architect', 'solution architect']),
  role('Arquiteto de sistemas', 'Arquiteta de sistemas', 'Arquiteto(a) de sistemas', ['systems architect']),
  role('Arquiteto de dados', 'Arquiteta de dados', 'Arquiteto(a) de dados', ['data architect']),
  role('Arquiteto de nuvem', 'Arquiteta de nuvem', 'Arquiteto(a) de nuvem', ['cloud architect', 'arquiteto cloud', 'arquiteta cloud']),
  // Análise e dados
  same('Analista', ['analyst']),
  same('Analista de sistemas', ['systems analyst']),
  same('Analista de dados', ['data analyst']),
  same('Analista de BI', ['bi analyst', 'business intelligence analyst', 'analista de business intelligence']),
  same('Analista de negócios', ['business analyst']),
  same('Analista de requisitos', ['requirements analyst']),
  same('Analista de QA', ['qa analyst', 'test analyst', 'quality assurance analyst', 'analista de testes']),
  same('Analista de suporte', ['support analyst']),
  same('Analista de infraestrutura', ['infrastructure analyst']),
  same('Analista de segurança', ['security analyst']),
  same('Analista de TI', ['it analyst']),
  same('Cientista', ['scientist']),
  same('Cientista de dados', ['data scientist']),
  // Liderança técnica
  same('Tech Lead', ['technical lead', 'tech leader', 'technical leader']),
  role('Líder técnico', 'Líder técnica', 'Líder técnico(a)'),
  same('Líder', ['leader']),
  same('Líder de equipe', ['team lead', 'team leader', 'líder de time']),
  same('Líder de engenharia', ['engineering lead']),
  // Gestão
  role('Gerente', 'Gerenta', 'Gerente', ['manager']),
  role('Gerente de projetos', 'Gerenta de projetos', 'Gerente de projetos', ['project manager', 'gerente de projeto', 'gerenta de projeto']),
  role('Gerente de produto', 'Gerenta de produto', 'Gerente de produto', ['product manager', 'gerente de produtos', 'gerenta de produtos']),
  role('Gerente de engenharia', 'Gerenta de engenharia', 'Gerente de engenharia', ['engineering manager']),
  role('Gerente de TI', 'Gerenta de TI', 'Gerente de TI', ['it manager']),
  role('Gestor', 'Gestora', 'Gestor(a)'),
  role('Coordenador', 'Coordenadora', 'Coordenador(a)', ['coordinator']),
  role('Supervisor', 'Supervisora', 'Supervisor(a)'),
  role('Diretor', 'Diretora', 'Diretor(a)', ['director']),
  role('Diretor de tecnologia', 'Diretora de tecnologia', 'Diretor(a) de tecnologia', ['technology director']),
  role('Diretor de engenharia', 'Diretora de engenharia', 'Diretor(a) de engenharia', ['engineering director', 'director of engineering']),
  same('Head'),
  role('Presidente', 'Presidenta', 'Presidente', ['president']),
  role('Vice-presidente', 'Vice-presidenta', 'Vice-presidente', ['vice president', 'vp']),
  same('CEO', ['chief executive officer']),
  same('CTO', ['chief technology officer']),
  same('CIO', ['chief information officer']),
  same('COO', ['chief operating officer']),
  same('CPO', ['chief product officer']),
  same('CISO', ['chief information security officer']),
  same('CFO', ['chief financial officer']),
  // Negócio próprio
  role('Fundador', 'Fundadora', 'Fundador(a)', ['founder']),
  role('Cofundador', 'Cofundadora', 'Cofundador(a)', ['co-fundador', 'co-fundadora', 'cofounder', 'co-founder']),
  role('Sócio', 'Sócia', 'Sócio(a)'),
  role('Sócio-fundador', 'Sócia-fundadora', 'Sócio(a)-fundador(a)'),
  role('Proprietário', 'Proprietária', 'Proprietário(a)', ['business owner']),
  role('Empreendedor', 'Empreendedora', 'Empreendedor(a)', ['entrepreneur']),
  // Início de carreira
  role('Estagiário', 'Estagiária', 'Estagiário(a)', ['intern']),
  same('Trainee'),
  same('Aprendiz', ['apprentice']),
  same('Bolsista'),
  // Consultoria, pesquisa e ensino
  role('Consultor', 'Consultora', 'Consultor(a)', ['consultant']),
  same('Especialista', ['specialist', 'expert']),
  role('Pesquisador', 'Pesquisadora', 'Pesquisador(a)', ['researcher']),
  role('Instrutor', 'Instrutora', 'Instrutor(a)', ['instructor', 'trainer']),
  role('Professor', 'Professora', 'Professor(a)', ['teacher', 'lecturer']),
  role('Mentor', 'Mentora', 'Mentor(a)'),
  role('Tutor', 'Tutora', 'Tutor(a)'),
  // Produto e design
  same('Product Owner', ['dono do produto', 'dona do produto']),
  same('Scrum Master'),
  same('Agile Coach', ['coach ágil']),
  same('Designer'),
  same('UX Designer', ['designer de ux', 'designer ux', 'ux ui designer']),
  same('UI Designer', ['designer de ui', 'designer ui']),
  same('Designer de produto', ['product designer']),
  // Operação e apoio
  role('Administrador', 'Administradora', 'Administrador(a)', ['administrator']),
  role('Administrador de sistemas', 'Administradora de sistemas', 'Administrador(a) de sistemas', ['system administrator', 'systems administrator', 'sysadmin']),
  role('Administrador de banco de dados', 'Administradora de banco de dados', 'Administrador(a) de banco de dados', ['database administrator']),
  same('DBA'),
  role('Técnico', 'Técnica', 'Técnico(a)', ['technician']),
  role('Tecnólogo', 'Tecnóloga', 'Tecnólogo(a)'),
  role('Testador', 'Testadora', 'Testador(a)', ['tester']),
  role('Auditor', 'Auditora', 'Auditor(a)'),
  role('Recrutador', 'Recrutadora', 'Recrutador(a)', ['recruiter']),
  role('Operador', 'Operadora', 'Operador(a)', ['operator']),
  same('Assistente', ['assistant']),
  same('Auxiliar'),
];

const LEVELS: ReadonlyMap<string, string> = new Map([
  ['senior', 'Sênior'],
  ['sr', 'Sênior'],
  ['pleno', 'Pleno'],
  ['plena', 'Pleno'],
  ['mid', 'Pleno'],
  ['junior', 'Júnior'],
  ['jr', 'Júnior'],
]);

// Só depois de uma palavra de verdade: "I/O" e "S/A" não são forma neutra.
const IN_PARENTHESES = /(?<=\p{L}{3})\s?\((?:a|o|e|x|as|os|ora|ã)\)/giu; // "Engenheiro(a)", "Desenvolvedor(ora)"
const AFTER_SLASH = /(?<=\p{L}{3})\/(?:a|o|e|x|as|os|ora)(?![\p{L}\p{N}])/giu; // "Desenvolvedor/a"
const AT_SIGN = /(?<=\p{L}{3})@(?![\p{L}\p{N}])/gu; // "Engenheir@"

/** Tira a marca de forma neutra e deixa uma das formas comuns: "Engenheiro(a)" vira "Engenheiro", e "Engenheir@" também. */
export function foldNeutralSpelling(text: string): string {
  return text.replace(IN_PARENTHESES, '').replace(AFTER_SLASH, '').replace(AT_SIGN, 'o');
}

function formKey(form: string): string {
  return normalize(foldNeutralSpelling(form)).replace(/\b(back|front)end\b/gu, '$1 end').replace(/\bfullstack\b/gu, 'full stack');
}

const NEUTRAL_ENDINGS: readonly string[] = ['e', 'x'];

/** "engenheire" a partir de "engenheiro", "desenvolvedorx" a partir de "desenvolvedor". O resto volta igual. */
function spelledWith(word: string, ending: string): string {
  if (word.endsWith('or')) return word + ending;
  return word.endsWith('o') ? word.slice(0, -1) + ending : word;
}

function buildNeutralWords(): Map<string, string> {
  const words = new Map<string, string>();
  for (const { masculine, feminine } of WORK_TITLES) {
    const feminineWords = formKey(feminine).split(' ');
    formKey(masculine).split(' ').forEach((word, position) => {
      if (word === feminineWords[position]) return;
      for (const ending of NEUTRAL_ENDINGS) {
        const spelling = spelledWith(word, ending);
        if (spelling !== word) words.set(spelling, word);
      }
    });
  }
  return words;
}

/** Forma neutra escrita com "e" ou "x", para a forma masculina usada na comparação. Só palavras de cargo da lista. */
export const NEUTRAL_WORDS: ReadonlyMap<string, string> = buildNeutralWords();

function buildIndex(): Map<string, WorkTitle> {
  const index = new Map<string, WorkTitle>();
  for (const title of WORK_TITLES) {
    for (const form of [title.masculine, title.feminine, title.neutral, ...title.others]) index.set(formKey(form), title);
    for (const ending of NEUTRAL_ENDINGS) {
      const spelled = formKey(title.masculine).split(' ').map((word) => {
        const spelling = spelledWith(word, ending);
        return NEUTRAL_WORDS.get(spelling) === word ? spelling : word;
      });
      index.set(spelled.join(' '), title);
    }
  }
  return index;
}

const INDEX: ReadonlyMap<string, WorkTitle> = buildIndex();
const MAX_FORM_WORDS = Math.max(...[...INDEX.keys()].map((key) => key.split(' ').length));

// O que separa o cargo da empresa, do local ou de um complemento. Hífen só com espaço, por "Back-end" e "Sócio-fundador".
const SEGMENT_BREAK = /\s+[-–—]\s+|[|·•‧∙⋅,;:()[\]{}/]|\s*@\s*|\s+(?:at|na|no|em|in|para|for|pela|pelo)\s+/iu;

function firstTitleIn(words: readonly string[]): WorkTitle | null {
  for (let start = 0; start < words.length; start++) {
    for (let size = Math.min(MAX_FORM_WORDS, words.length - start); size >= 1; size--) {
      const title = INDEX.get(words.slice(start, start + size).join(' '));
      if (title !== undefined) return title;
    }
  }
  return null;
}

function levelIn(words: readonly string[]): string | null {
  for (const word of words) {
    const level = LEVELS.get(word);
    if (level !== undefined) return level;
  }
  return null;
}

/**
 * O rótulo da lista para uma linha de cargo, ou vazio. "Engenheira de Dados Sênior - Acme" vira "Engenheiro(a) de dados Sênior".
 * Vale o primeiro cargo da linha. O nível vem do mesmo trecho do cargo ou de um trecho que é só o nível ("Analista - Sênior").
 * Nível sem cargo não é cargo: "Senior Sistemas" pode ser uma empresa.
 */
export function workTitleOf(line: string): string {
  if (typeof line !== 'string' || line === '' || line.length > MAX_SHORT_LINE) return '';
  const segments = foldNeutralSpelling(line).split(SEGMENT_BREAK).map((segment) => formKey(segment).split(' '));
  for (const words of segments) {
    const title = firstTitleIn(words);
    if (title === null) continue;
    const level = levelIn(words) ?? levelIn(segments.find((other) => other.length === 1 && LEVELS.has(other[0] ?? '')) ?? []);
    return level === null ? title.neutral : `${title.neutral} ${level}`;
  }
  return '';
}

/** A linha tem uma palavra de cargo da lista (DP-24). */
export function hasWorkWord(line: string): boolean {
  return workTitleOf(line) !== '';
}
