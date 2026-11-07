// Perfis gêmeos, todos inventados (CA-07, RF-57). Um perfil-base e variações que mudam só o que não conta.
//
// As variações não só trocam o texto: elas colocam ali os termos da vaga que o perfil-base NÃO tem e períodos longos. Se
// qualquer coisa vazasse de uma seção ignorada ou do cabeçalho, um "não encontrado" viraria crédito, e o teste acusaria.
import type { Requirement } from '../../../src/core/model.ts';
import type { YearMonth } from '../../../src/core/time/types.ts';

export const TWIN_AS_OF: YearMonth = { year: 2024, month: 10 };
export const TWIN_URL = 'https://www.linkedin.com/in/clara-ficticia/';

export interface TwinSection {
  readonly title: string;
  readonly lines: readonly string[];
}

export interface TwinProfile {
  readonly header: readonly string[];
  readonly sections: readonly TwinSection[];
}

export function renderProfile(profile: TwinProfile): string {
  const blocks = profile.sections.map(({ title, lines }) => [title, ...lines].join('\n'));
  return [profile.header.join('\n'), ...blocks].join('\n\n');
}

export const BASE_ABOUT = 'Desenvolvo sistemas de pagamento e estudo Python nas horas vagas. Gosto de código simples.';

export const BASE_PROFILE: TwinProfile = {
  header: [
    'Clara Fictícia Exemplo',
    'Ela/Dela · 2º',
    'Desenvolvedora Backend na Empresa Fictícia Alfa',
    'São Paulo, São Paulo, Brasil · Informações de contato',
    '1.234 seguidores · 500+ conexões',
    'Disponível para trabalhar',
    'Mensagem',
  ],
  sections: [
    { title: 'Sobre', lines: [BASE_ABOUT] },
    {
      title: 'Experiência',
      lines: [
        'Desenvolvedora Sênior',
        'Empresa Fictícia Alfa · Tempo integral',
        'jan de 2020 - dez de 2023 · 4 anos',
        'São Paulo, Brasil · Híbrida',
        'Desenvolvimento de APIs de pagamento em Java.',
        'Competências: Java, Go',
        'Desenvolvedora Plena',
        'Empresa Fictícia Beta · Tempo integral',
        'jan de 2014 - dez de 2019 · 6 anos',
        'Curitiba, Paraná · Presencial',
        'Manutenção de sistemas legados.',
        'Tecnologias: PHP',
      ],
    },
    { title: 'Formação acadêmica', lines: ['Universidade Inventada', 'Bacharelado em Ciência da Computação', '2005 - 2009'] },
    { title: 'Trabalho voluntário', lines: ['Voluntária', 'ONG Imaginária', 'mar de 2005 - dez de 2006 · 1 ano 10 meses'] },
    { title: 'Competências', lines: ['Spring', 'Docker'] },
    { title: 'Recomendações', lines: ['Recebidas', 'Fulano Inventado', 'A Clara é ótima colega.'] },
    { title: 'Idiomas', lines: ['Português', 'Nativo ou bilíngue', 'Inglês', 'Avançado'] },
    { title: 'Interesses', lines: ['Empresas', 'Companhia Imaginária'] },
    { title: 'Causas', lines: ['Meio ambiente'] },
    { title: 'Projetos', lines: ['Biblioteca de Exemplo', 'Biblioteca de código aberto em Kotlin.'] },
  ],
};

export const TWIN_REQUIREMENTS: readonly Requirement[] = [
  { id: 'java', kind: 'term', importance: 'required', label: 'Java', canonical: 'Java', minYears: 5 },
  { id: 'spring', kind: 'term', importance: 'required', label: 'Spring' },
  { id: 'go', kind: 'term', importance: 'required', label: 'Go', canonical: 'Go' },
  { id: 'python', kind: 'term', importance: 'required', label: 'Python', canonical: 'Python' },
  { id: 'k8s', kind: 'term', importance: 'required', label: 'Kubernetes', canonical: 'Kubernetes' },
  { id: 'core', kind: 'term', importance: 'required', label: 'core banking' },
  { id: 'total', kind: 'total_experience', importance: 'required', label: 'Experiência total', minYears: 12 },
  { id: 'senior', kind: 'title_word', importance: 'required', label: 'Sênior' },
  { id: 'aws', kind: 'term', importance: 'preferred', label: 'AWS', canonical: 'AWS' },
  { id: 'ingles', kind: 'language', importance: 'preferred', label: 'Inglês', canonical: 'Inglês' },
  { id: 'alemao', kind: 'language', importance: 'preferred', label: 'Alemão', canonical: 'Alemão' },
  { id: 'kotlin', kind: 'term', importance: 'preferred', label: 'Kotlin', canonical: 'Kotlin' },
  { id: 'cert', kind: 'certification', importance: 'preferred', label: 'AWS Solutions Architect', canonical: 'AWS Certified Solutions Architect' },
  { id: 'diretor', kind: 'title_word', importance: 'preferred', label: 'Diretor' },
];

/** O que a vaga pede e o perfil-base não tem. Vazar qualquer um destes muda a nota. */
const BAIT = 'Kubernetes, AWS, core banking, Alemão, AWS Certified Solutions Architect';
const BAIT_PERIOD = 'jan de 1980 - dez de 2013 · 34 anos';

function withHeader(profile: TwinProfile, change: (header: readonly string[]) => readonly string[]): TwinProfile {
  return { ...profile, header: change(profile.header) };
}

function replaceHeaderLine(profile: TwinProfile, index: number, line: string): TwinProfile {
  return withHeader(profile, (header) => header.map((old, position) => (position === index ? line : old)));
}

function removeHeaderLine(profile: TwinProfile, index: number): TwinProfile {
  return withHeader(profile, (header) => header.filter((_, position) => position !== index));
}

function withSection(profile: TwinProfile, title: string, lines: readonly string[]): TwinProfile {
  return { ...profile, sections: profile.sections.map((section) => (section.title === title ? { title, lines } : section)) };
}

function withoutSection(profile: TwinProfile, title: string): TwinProfile {
  return { ...profile, sections: profile.sections.filter((section) => section.title !== title) };
}

const IGNORED_TITLES: ReadonlySet<string> = new Set(['Formação acadêmica', 'Trabalho voluntário', 'Recomendações', 'Interesses', 'Causas']);

/** As seções ignoradas trocam de lugar entre si, e as que contam ficam onde estão. */
function ignoredReversed(profile: TwinProfile): TwinProfile {
  const ignored = profile.sections.filter((section) => IGNORED_TITLES.has(section.title)).reverse();
  let next = 0;
  return {
    ...profile,
    sections: profile.sections.map((section) => (IGNORED_TITLES.has(section.title) ? (ignored[next++] ?? section) : section)),
  };
}

function ignoredFirst(profile: TwinProfile): TwinProfile {
  const counted = profile.sections.filter((section) => !IGNORED_TITLES.has(section.title));
  const ignored = profile.sections.filter((section) => IGNORED_TITLES.has(section.title));
  return { ...profile, sections: [...ignored, ...counted] };
}

const EXTRA_SECTIONS: readonly TwinSection[] = [
  { title: 'Publicações', lines: [`Artigo sobre ${BAIT}`, '2001'] },
  { title: 'Prêmios', lines: [`Prêmio de ${BAIT}`, 'Concedido em 1999'] },
  { title: 'Organizações', lines: [`Associação de ${BAIT}`, BAIT_PERIOD] },
  { title: 'Cursos', lines: [BAIT, 'Curso de Kubernetes'] },
  { title: 'Atividade', lines: ['12 publicações', `Comentou sobre ${BAIT}`] },
];

const NEW_EDUCATION = ['Faculdade Imaginária de Kubernetes', `Pós em ${BAIT}`, '1980 - 1984', BAIT_PERIOD, 'Competências: Kubernetes, AWS'];
const NEW_VOLUNTEERING = ['Diretor Sênior Voluntário', 'Igreja Imaginária', BAIT_PERIOD, BAIT];
const NEW_RECOMMENDATIONS = ['Dadas', 'Beltrana Inventada', `A pessoa tem 58 anos e domina ${BAIT}.`];
const NEW_INTERESTS = ['Grupos', 'Católicos Imaginários', `Comunidade de ${BAIT}`];
const NEW_CAUSES = ['Direitos Humanos', 'Religião', BAIT];

function everythingTogether(): TwinProfile {
  let profile: TwinProfile = {
    ...BASE_PROFILE,
    header: ['Bento Imaginário Silva', 'Ele/Dele · 3º', `Diretor Sênior de ${BAIT}`, '61 anos', 'Complexo do Alemão, Rio de Janeiro', '10 seguidores', 'Open to work'],
  };
  profile = withSection(profile, 'Formação acadêmica', NEW_EDUCATION);
  profile = withSection(profile, 'Trabalho voluntário', NEW_VOLUNTEERING);
  profile = withSection(profile, 'Recomendações', NEW_RECOMMENDATIONS);
  profile = withSection(profile, 'Interesses', NEW_INTERESTS);
  profile = withSection(profile, 'Causas', NEW_CAUSES);
  profile = ignoredFirst(profile);
  return { ...profile, sections: [...EXTRA_SECTIONS, ...profile.sections] };
}

export interface TwinVariant {
  readonly name: string;
  readonly profile: TwinProfile;
}

/** Grupo 1: só muda o que está fora da lista fechada de seções. */
export const OUTSIDE_VARIANTS: readonly TwinVariant[] = [
  { name: 'nome trocado', profile: replaceHeaderLine(BASE_PROFILE, 0, 'Bento Imaginário Silva') },
  { name: 'nome feito de termos da vaga', profile: replaceHeaderLine(BASE_PROFILE, 0, 'Kubernetes Aws Alemão Silva') },
  { name: 'pronomes trocados', profile: replaceHeaderLine(BASE_PROFILE, 1, 'Ele/Dele · 2º') },
  { name: 'pronomes em inglês e outro grau de conexão', profile: replaceHeaderLine(BASE_PROFILE, 1, 'She/Her · 3º') },
  { name: 'sem pronomes', profile: removeHeaderLine(BASE_PROFILE, 1) },
  { name: 'idade no cabeçalho', profile: withHeader(BASE_PROFILE, (header) => [...header, '52 anos', 'Nascida em 1972']) },
  { name: 'outra idade no cabeçalho', profile: withHeader(BASE_PROFILE, (header) => [...header, '23 anos', 'Nascida em 2001']) },
  { name: 'cidade trocada', profile: replaceHeaderLine(BASE_PROFILE, 3, 'Manaus, Amazonas, Brasil · Informações de contato') },
  { name: 'cidade com nome de termo da vaga', profile: replaceHeaderLine(BASE_PROFILE, 3, 'Complexo do Alemão, Rio de Janeiro, Brasil') },
  { name: 'número de seguidores', profile: replaceHeaderLine(BASE_PROFILE, 4, '987.654 seguidores · 12 conexões') },
  { name: 'sem selo de disponibilidade', profile: removeHeaderLine(BASE_PROFILE, 5) },
  { name: 'selo de disponibilidade em inglês', profile: replaceHeaderLine(BASE_PROFILE, 5, 'Open to work') },
  { name: 'título profissional com termos da vaga', profile: replaceHeaderLine(BASE_PROFILE, 2, `Diretora Sênior de ${BAIT}`) },
  { name: 'contato no cabeçalho', profile: withHeader(BASE_PROFILE, (header) => [...header, 'clara@exemplo.test', '+55 11 90000-0000']) },
  { name: 'formação inteira trocada, com formatura antiga', profile: withSection(BASE_PROFILE, 'Formação acadêmica', NEW_EDUCATION) },
  { name: 'formação com formatura recente', profile: withSection(BASE_PROFILE, 'Formação acadêmica', ['Escola Inventada', '2020 - 2023']) },
  { name: 'sem formação', profile: withoutSection(BASE_PROFILE, 'Formação acadêmica') },
  { name: 'voluntariado trocado, com período longo', profile: withSection(BASE_PROFILE, 'Trabalho voluntário', NEW_VOLUNTEERING) },
  { name: 'sem voluntariado', profile: withoutSection(BASE_PROFILE, 'Trabalho voluntário') },
  { name: 'recomendações trocadas', profile: withSection(BASE_PROFILE, 'Recomendações', NEW_RECOMMENDATIONS) },
  { name: 'sem recomendações', profile: withoutSection(BASE_PROFILE, 'Recomendações') },
  { name: 'interesses trocados', profile: withSection(BASE_PROFILE, 'Interesses', NEW_INTERESTS) },
  { name: 'sem interesses', profile: withoutSection(BASE_PROFILE, 'Interesses') },
  { name: 'causas trocadas', profile: withSection(BASE_PROFILE, 'Causas', NEW_CAUSES) },
  { name: 'sem causas', profile: withoutSection(BASE_PROFILE, 'Causas') },
  { name: 'seções ignoradas em ordem invertida', profile: ignoredReversed(BASE_PROFILE) },
  { name: 'seções ignoradas antes de todas', profile: ignoredFirst(BASE_PROFILE) },
  { name: 'outras seções ignoradas a mais', profile: { ...BASE_PROFILE, sections: [...BASE_PROFILE.sections, ...EXTRA_SECTIONS] } },
  { name: 'tudo junto', profile: everythingTogether() },
];

/** Grupo 2: dado pessoal dentro de "Sobre", com uma vaga que não pede nada disso. */
export const ABOUT_SENTENCES: readonly (readonly [string, string])[] = [
  ['idade', 'Tenho 52 anos e nasci em 1972.'],
  ['outra idade', 'Tenho 23 anos e nasci em 2001.'],
  ['religião católica', 'Sou católica praticante e frequento a Igreja Imaginária.'],
  ['religião evangélica', 'Sou evangélica e canto no coral da igreja.'],
  ['religião muçulmana', 'Sou muçulmana e faço o jejum do Ramadã.'],
  ['casada', 'Sou casada há vinte anos.'],
  ['solteira', 'Sou solteira e moro sozinha.'],
  ['divorciada', 'Sou divorciada.'],
  ['filhos', 'Mãe de dois filhos pequenos.'],
  ['deficiência', 'Sou pessoa com deficiência auditiva.'],
  ['raça', 'Sou mulher negra e indígena.'],
  ['orientação sexual', 'Sou lésbica e casada com outra mulher.'],
  ['endereço', 'Moro no bairro Imaginário, na rua Fictícia, número 100.'],
  ['política e sindicato', 'Sou filiada ao Partido Imaginário e ao Sindicato Inventado.'],
];

export function withAboutSentence(sentence: string): TwinProfile {
  return withSection(BASE_PROFILE, 'Sobre', [`${BASE_ABOUT} ${sentence}`]);
}

/** Grupo 3: entrada de pausa na carreira dentro de Experiência, que é dado de saúde ou de família. */
export const CAREER_BREAK_LABELS: readonly string[] = [
  'Licença-maternidade', 'Licença maternidade', 'Licença-paternidade', 'Licença parental', 'Licença médica',
  'Pausa na carreira', 'Pausa profissional', 'Career break', 'Maternity leave', 'Paternity leave', 'Parental leave',
  'Medical leave', 'Caregiving', 'Cuidados familiares', 'Health and well-being', 'Saúde e bem-estar',
  'Maternidade', 'Paternidade', 'Licença-adoção', 'Licença para cuidar de filho', 'Sabático', 'Tratamento de saúde', 'Tratamento de câncer', 'Cuidador',
  'Cuidando dos filhos', 'Leave of absence', 'Mãe', 'Dona de casa',
];

export const CAREER_BREAK_POSITIONS: Readonly<Record<string, number>> = { 'na frente': 0, 'no meio': 6, 'no fim': 12 };

/** A entrada traz período que não sobrepõe nada e os termos que o perfil-base não tem. Vazar qualquer coisa muda a nota. */
export function withCareerBreak(label: string, position: number): TwinProfile {
  const experience = BASE_PROFILE.sections.find((section) => section.title === 'Experiência')?.lines ?? [];
  const entry = [label, 'jan de 2024 - out de 2024 · 10 meses', 'Cuidando da família, enquanto estudava Kubernetes e AWS.', 'Competências: Kubernetes, AWS, Alemão'];
  return withSection(BASE_PROFILE, 'Experiência', [...experience.slice(0, position), ...entry, ...experience.slice(position)]);
}

export function withSkillAdded(skill: string): TwinProfile {
  return withSection(BASE_PROFILE, 'Competências', ['Spring', 'Docker', skill]);
}
