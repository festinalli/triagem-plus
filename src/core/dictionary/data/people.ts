// Idiomas (categoria language) e cargos de tecnologia (categoria role). Escritos à mão.
// Os cargos trazem a forma feminina da palavra de cargo (desenvolvedora, engenheira...) como mesmo cargo: sem elas, um
// título escrito no feminino deixaria de casar, e isso seria um viés de gênero na busca.
import { curated } from './curated.ts';
import type { CuratedTerm } from '../types.ts';

const L = (canonical: string, synonyms: readonly string[] = []): CuratedTerm => curated('language', canonical, synonyms);
const R = (canonical: string, synonyms: readonly string[] = []): CuratedTerm => curated('role', canonical, synonyms);

export const LANGUAGES: readonly CuratedTerm[] = [
  L('Inglês', ['english', 'ingles tecnico']),
  L('Espanhol', ['spanish', 'espanol']),
  L('Português', ['portuguese', 'portugues brasileiro']),
  L('Francês', ['french', 'frances']),
  L('Alemão', ['german', 'alemao']),
  L('Italiano', ['italian']),
  L('Japonês', ['japanese', 'japones']),
  L('Mandarim', ['mandarin', 'chinese', 'chines']),
];

export const ROLES: readonly CuratedTerm[] = [
  R('Desenvolvedor de software', ['desenvolvedor', 'desenvolvedora', 'desenvolvedora de software', 'software developer', 'software engineer', 'engenheiro de software', 'engenheira de software', 'programador', 'programadora', 'desarrollador de software', 'ingeniero de software']),
  R('Desenvolvedor back-end', ['backend developer', 'back end developer', 'desenvolvedor backend', 'desenvolvedora backend', 'desenvolvedora back end', 'back end engineer', 'backend engineer', 'desarrollador backend']),
  R('Desenvolvedor front-end', ['frontend developer', 'front end developer', 'desenvolvedor frontend', 'desenvolvedora frontend', 'desenvolvedora front end', 'front end engineer', 'frontend engineer', 'desarrollador frontend']),
  R('Desenvolvedor full stack', ['full stack developer', 'fullstack developer', 'desenvolvedor fullstack', 'desenvolvedora fullstack', 'desenvolvedora full stack', 'full stack engineer']),
  R('Desenvolvedor mobile', ['mobile developer', 'mobile engineer', 'desenvolvedora mobile', 'desenvolvedor android', 'desenvolvedora android', 'desenvolvedor ios', 'desenvolvedora ios', 'android developer', 'ios developer']),
  R('Engenheiro de dados', ['data engineer', 'engenheira de dados', 'ingeniero de datos', 'engenheiro de big data', 'engenheira de big data']),
  R('Cientista de dados', ['data scientist', 'cientifico de datos']),
  R('Analista de dados', ['data analyst']),
  R('Analista de BI', ['business intelligence analyst', 'bi analyst', 'analista de business intelligence']),
  R('Engenheiro de machine learning', ['machine learning engineer', 'ml engineer', 'engenheira de machine learning', 'engenheiro de ml', 'engenheira de ml']),
  R('Engenheiro DevOps', ['devops engineer', 'engenheiro de devops', 'engenheira de devops', 'engenheira devops', 'site reliability engineer']),
  R('Analista de QA', ['qa engineer', 'analista de testes', 'test engineer', 'quality assurance analyst', 'tester']),
  R('Administrador de sistemas', ['system administrator', 'sysadmin', 'administradora de sistemas', 'administrador de servidores', 'administradora de servidores']),
  R('Arquiteto de software', ['software architect', 'arquiteta de software', 'arquiteto de solucoes', 'arquiteta de solucoes', 'solutions architect', 'arquiteto de sistemas', 'arquiteta de sistemas']),
  R('Tech Lead', ['lider tecnico', 'lider tecnica', 'technical lead', 'team lead tecnico', 'team lead tecnica']),
  R('Gerente de produto', ['product manager', 'gerente de produtos', 'gerente de produto digital']),
  R('Product Owner', ['dono do produto', 'dona do produto', 'po de produto']),
  R('Scrum Master', ['agile coach', 'coach agil']),
  R('Analista de sistemas', ['systems analyst', 'analista de sistema']),
  R('Designer de UX', ['ux designer', 'designer ux', 'ux ui designer', 'designer de experiencia']),
  R('Designer de produto', ['product designer']),
  R('Estagiário de software', ['estagiaria de software', 'estagiario de desenvolvimento', 'estagiaria de desenvolvimento', 'software intern', 'desenvolvedor estagiario', 'desenvolvedora estagiaria']),
  // Níveis. Só valem como palavra de cargo: a nota procura estes termos nos cargos, nunca em texto corrido.
  R('Sênior', ['senior', 'sr']),
  R('Pleno', ['plena']),
  R('Júnior', ['junior', 'jr']),
];
