// Títulos de seção e linhas da própria página, em português e inglês (RF-40, RF-41, DP-02, DP-17).
import { normalize } from '../text/normalize.ts';
import type { ProfileSection } from '../model.ts';
import { MAX_SHORT_LINE } from './lines.ts';

/** A lista de resultados não é uma seção do perfil: nenhum título leva a ela. */
type TitledSection = Exclude<ProfileSection, 'listing'>;

export type SectionRole = TitledSection | 'ignored';

/** A lista fechada do que conta. Só estas seções chegam a algum campo do resultado. */
const COUNTED: Readonly<Record<TitledSection, readonly string[]>> = {
  about: ['Sobre', 'About', 'Resumo', 'Summary', 'Resumo profissional', 'Professional summary', 'Perfil profissional', 'Professional profile'],
  experience: [
    'Experiência', 'Experience', 'Experiências', 'Experiences', 'Experiência profissional', 'Experiências profissionais',
    'Professional experience', 'Work experience', 'Histórico profissional', 'Trajetória profissional', 'Employment history',
    'Work history', 'Career history',
  ],
  skills: [
    'Competências', 'Skills', 'Conhecimentos', 'Habilidades', 'Tecnologias', 'Tecnologia', 'Ferramentas', 'Technologies', 'Tools',
    'Competências técnicas', 'Habilidades técnicas', 'Conhecimentos técnicos', 'Principais competências', 'Competências principais',
    'Principais habilidades', 'Technical skills', 'Top skills', 'Key skills', 'Hard skills', 'Soft skills', 'Stack', 'Tech stack',
    'Stack técnica', 'Stack tecnológica', 'Linguagens', 'Linguagens de programação', 'Programming languages',
    'Tecnologias e ferramentas', 'Ferramentas e tecnologias', 'Technologies and tools', 'Tools and technologies',
    'Habilidades e competências', 'Competências e habilidades', 'Conhecimentos e habilidades', 'Habilidades e conhecimentos',
    'Competências e recomendações', 'Skills and endorsements',
  ],
  certifications: [
    'Licenças e certificados', 'Licenças e certificações', 'Licenses and certifications', 'Certificações', 'Certificados',
    'Certificação', 'Certificado', 'Licenças', 'Certifications', 'Certificates', 'Certification', 'Licenses',
    'Certificações e licenças', 'Certificados e licenças', 'Certifications and licenses',
  ],
  languages: ['Idiomas', 'Languages', 'Idioma', 'Language', 'Línguas', 'Língua', 'Línguas estrangeiras', 'Idiomas estrangeiros', 'Foreign languages'],
  projects: [
    'Projetos', 'Projects', 'Projetos pessoais', 'Personal projects', 'Side projects', 'Projetos relevantes', 'Principais projetos',
    'Projetos profissionais', 'Portfólio', 'Portfolio',
  ],
};

/**
 * Encerram o trecho, e o conteúdo é descartado até o próximo título. Errar para este lado só perde texto; errar para
 * o outro deixaria formação ou recomendação dentro da seção anterior. Por isso há variantes prováveis (RF-41: "qualquer
 * outra seção conhecida") e os itens do rodapé, que vêm num "selecionar tudo" logo depois de um "Sobre" do rodapé.
 *
 * "Recursos" e "Análises" não entram de propósito: na página, vêm antes de Sobre, onde tudo já é descartado, e uma linha
 * assim dentro da descrição de um cargo encerraria a Experiência e tiraria da nota os cargos seguintes. "Redes sociais", "Social
 * media", "Training", "Ensino" e "Eventos" também não: são nomes comuns de competência, e cortariam a lista no meio. "Sobre mim" fica
 * aqui, e não em Sobre: a seção Sobre é a que a página mostra, e o resto é texto pessoal que só atrapalha.
 */
const IGNORED: readonly string[] = [
  // Formação (DP-05)
  'Formação', 'Formação acadêmica', 'Formação complementar', 'Formação profissional', 'Formação e cursos',
  'Formação acadêmica e complementar', 'Formação acadêmica e profissional', 'Formação e certificações', 'Educação', 'Educação formal',
  'Escolaridade', 'Histórico acadêmico', 'Histórico escolar', 'Graduação', 'Pós-graduação', 'Ensino superior', 'Ensino médio',
  'Titulação', 'Qualificações', 'Experiência acadêmica', 'Projetos acadêmicos', 'Education', 'Education and training', 'Academic background',
  'Academic history', 'Academic experience', 'Academic education', 'Academic projects', 'Educational background', 'Degrees', 'Qualifications',
  'Cursos', 'Cursos livres', 'Cursos complementares', 'Cursos e certificações', 'Cursos e certificados', 'Certificados e cursos',
  'Certificações e cursos', 'Cursos e treinamentos', 'Treinamentos', 'Treinamentos e cursos', 'Courses', 'Courses and certifications',
  'Certifications and courses',
  // Voluntariado
  'Trabalho voluntário', 'Trabalhos voluntários', 'Voluntariado', 'Experiência voluntária', 'Experiências voluntárias',
  'Experiência de voluntariado', 'Ações sociais', 'Ação social', 'Ações voluntárias', 'Atuação social', 'Trabalho social', 'Trabalhos sociais',
  'Responsabilidade social', 'Projetos voluntários', 'Volunteering', 'Volunteer', 'Volunteer work', 'Volunteer experience', 'Social work',
  'Community service', 'Community involvement',
  // Recomendações, interesses e causas
  'Recomendações', 'Recomendações recebidas', 'Recomendações dadas', 'Referências', 'Recommendations', 'Recommendations received',
  'Recommendations given', 'References', 'Interesses', 'Interesses pessoais', 'Interests', 'Personal interests', 'Hobbies', 'Hobbies e interesses',
  'Interesses e hobbies', 'Hobbies and interests', 'Passatempos', 'Causas', 'Causas sociais', 'Causas que apoio', 'Causes', 'Causes I care about',
  // Atividade e publicações
  'Atividade', 'Atividades', 'Atividades extracurriculares', 'Atividades complementares', 'Activity', 'Activities', 'Extracurricular activities',
  'Publicações', 'Publicações e artigos', 'Artigos publicados', 'Publications', 'Palestras', 'Palestras e eventos',
  // Prêmios e organizações
  'Prêmios', 'Honras', 'Prêmios e honras', 'Honras e prêmios', 'Prêmios e reconhecimentos', 'Reconhecimentos', 'Premiações', 'Conquistas',
  'Honors and awards', 'Honors', 'Awards', 'Awards and recognition', 'Achievements', 'Organizações', 'Associações', 'Afiliações',
  'Organizations', 'Memberships', 'Affiliations',
  // Outras seções da página
  'Destaques', 'Featured', 'Patentes', 'Patents', 'Notas de provas', 'Test scores', 'Serviços', 'Services',
  // Dados pessoais e contato
  'Contato', 'Contatos', 'Informações de contato', 'Dados de contato', 'Contact', 'Contact info', 'Contact information',
  'Dados pessoais', 'Informações pessoais', 'Personal information', 'Personal details', 'Personal', 'Pessoal', 'Sobre mim', 'About me',
  'Informações adicionais', 'Informações complementares', 'Outras informações', 'Mais informações', 'Additional information', 'Other information',
  'Idade', 'Família', 'Family', 'Estado civil', 'Nacionalidade', 'Endereço', 'Address', 'Telefone', 'Phone', 'E-mail',
  'Perfil', 'Profile', 'Objetivo', 'Objetivos', 'Objetivo profissional', 'Objective', 'Career objective',
  // Sugestões e rodapé
  'Pessoas também viram', 'Outras pessoas também viram', 'People also viewed', 'Others also viewed',
  'Pessoas que talvez você conheça', 'Pessoas que você pode conhecer', 'Talvez você conheça', 'People you may know',
  'Mais perfis para você', 'More profiles for you', 'Perfis semelhantes', 'Similar profiles', 'Você também pode gostar', 'You might like',
  'Acessibilidade', 'Accessibility',
  'Central de Ajuda', 'Help Center',
  'Privacidade e termos', 'Privacy and Terms',
];

const MAX_TITLE_LINE = 80;
const MIN_TITLE_LINE = 5;
// Marcador na frente, com número ou sem ele: "• ", "- ", "# ", "**", "🎓 ", "1. ", "2) ".
const LEADING_MARKS = /^[^\p{L}\p{N}]*(?:\d{1,2}[.)][^\p{L}\p{N}]*)?/u;
// O que sobra no fim: ":", ".", " -", "**". O parêntese fica para a contagem.
const TRAILING_MARKS = /[^\p{L}\p{N})\]]+$/u;
// "Experiência (5)", "Competências · 12", "Idiomas: 3", "Projetos 4".
const COUNT = /\s*(?:[([]\s*\d{1,3}\s*[)\]]|[·•|‧∙⋅:–—-]\s*\d{1,3}|\s\d{1,3})$/u;
// "Licenses & certifications", "Licenses and certifications" e "Licenças e certificados" têm a mesma forma de comparação.
const JOINER = / (?:e|and) /gu;

function titleKey(line: string): string {
  const cleaned = line.replace(LEADING_MARKS, '').replace(TRAILING_MARKS, '').replace(COUNT, '');
  return normalize(cleaned).replace(JOINER, ' ');
}

const TITLES: ReadonlyMap<string, SectionRole> = new Map<string, SectionRole>([
  ...Object.entries(COUNTED).flatMap(([section, titles]) =>
    titles.map((title): [string, SectionRole] => [titleKey(title), section as TitledSection])),
  ...IGNORED.map((title): [string, SectionRole] => [titleKey(title), 'ignored']),
]);

/**
 * Um título só é título quando é a linha inteira (RF-41). Em volta dele pode haver pontuação, dois-pontos, contagem, marcador e
 * qualquer caixa, mas "Formação de equipes técnicas" ou "Experiência com AWS" nunca batem, porque não há comparação por prefixo.
 */
export function titleRole(line: string): SectionRole | null {
  if (line.length < MIN_TITLE_LINE || line.length > MAX_TITLE_LINE) return null;
  return TITLES.get(titleKey(line)) ?? null;
}

/** Palavras que também rotulam a lista de um cargo, escritas sozinhas na linha: "Tecnologias", "Atividades". */
const JOB_LABELS: ReadonlySet<string> = new Set(
  ['Tecnologias', 'Tecnologia', 'Ferramentas', 'Technologies', 'Tools', 'Habilidades', 'Conhecimentos', 'Stack', 'Tech stack', 'Atividades', 'Activities', 'Conquistas', 'Achievements'].map(titleKey),
);
const ENDS_IN_COLON = /[:：]\s*$/u;

/**
 * Dentro de Experiência, a linha pode ser só o rótulo da lista daquele cargo, e não o começo de outra seção. Se fosse título, os
 * cargos seguintes cairiam na seção errada e a nota mudaria pelo jeito de escrever. O leitor decide olhando o que vem depois:
 * rótulo tem outro período antes do próximo título. "Formação:" nunca é rótulo, e "Projetos" sem dois-pontos é título.
 */
export function canLabelJob(line: string): boolean {
  if (line.length < MIN_TITLE_LINE || line.length > MAX_TITLE_LINE) return false;
  const key = titleKey(line);
  if (JOB_LABELS.has(key)) return true;
  const role = TITLES.get(key);
  return (role === 'skills' || role === 'projects') && ENDS_IN_COLON.test(line);
}

// "Exibir todas as 12 experiências", "Exibir todas", "Show all 8 skills", "Show all". Até 5 palavras depois do número,
// e sem pontuação de frase no fim: "Ver todos os relatórios de vendas e corrigir os erros." é descrição.
const LIST_CUT = /^(?:exibir|mostrar|ver|show|see|view) (?:todas|todos|tudo|all)(?: (?:as|os|the))?(?: \d+)?(?: [\p{L}\p{N}]+){0,5}$/u;
const SENTENCE_END = /[.!?:;]$/u;

/** Sinal de lista cortada (RF-35). A linha nunca entra em nenhum texto. */
export function isListCutLine(line: string): boolean {
  if (line.length > MAX_SHORT_LINE || SENTENCE_END.test(line)) return false;
  return LIST_CUT.test(normalize(line));
}

// "…ver mais": parte do texto ficou escondida. Também pede para completar, como a lista cortada.
const HIDDEN_TEXT = /^(?:(?:ver|exibir|mostrar) mais|(?:see|show) more)$/u;

export function isHiddenTextLine(line: string): boolean {
  if (line.length > MAX_SHORT_LINE) return false;
  return HIDDEN_TEXT.test(normalize(line));
}

// Linhas da interface dentro de uma seção que conta. As de endosso importam: trazem nome de outras pessoas e não
// podem sobrar no texto de competências.
const PAGE_NOISE: readonly RegExp[] = [
  /^(?:exibir|mostrar|ver|show|see|view) (?:menos|less)$/u,
  /^(?:exibir|mostrar|ver|show|see|view) (?:a )?(?:credencial|credential|projeto|project)$/u,
  /^(?:endossar|endorse)$/u,
  /^\d+ (?:endossos?|endorsements?)$/u,
  /^(?:endossad[oa]|endorsed) (?:por|by)\b/u,
  /^\d+ (?:experiencias?|experiences?) (?:n[ao]|em|at)\b/u,
  /^(?:codigo da credencial|credential id)\b/u,
];

export function isPageNoiseLine(line: string): boolean {
  if (line.length > MAX_SHORT_LINE) return false;
  const key = normalize(line);
  return PAGE_NOISE.some((pattern) => pattern.test(key));
}
