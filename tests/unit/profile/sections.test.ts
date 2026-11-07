// Títulos de seção (RF-40, RF-41, DP-02, DP-05): depois de limpar o que está em volta, a linha inteira é comparada a uma lista
// de títulos completos. Título inexato não pode deixar formação ou voluntariado dentro da seção anterior, e uma frase que só
// começa igual não pode abrir nem fechar seção.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeProfile } from '../../../src/core/match/analyze.ts';
import type { ProfileSection, Requirement } from '../../../src/core/model.ts';
import { parseProfileText } from '../../../src/core/profile/parse.ts';
import { titleRole } from '../../../src/core/profile/sections.ts';
import type { SectionRole } from '../../../src/core/profile/sections.ts';
import { AS_OF, listed, totalYears } from '../match/helpers.ts';

const parse = (text: string) => parseProfileText(text, AS_OF);

const TITLES_BY_ROLE: Readonly<Record<SectionRole, readonly string[]>> = {
  about: ['Sobre', 'About', 'Resumo', 'Summary', 'Resumo profissional', 'Professional summary'],
  experience: [
    'Experiência', 'Experience', 'Experiências', 'Experiência profissional', 'Experiências profissionais', 'Professional experience',
    'Work experience', 'Histórico profissional', 'Employment history', 'Work history',
  ],
  skills: [
    'Competências', 'Skills', 'Habilidades', 'Conhecimentos', 'Tecnologias', 'Ferramentas', 'Technical skills', 'Top skills',
    'Competências técnicas', 'Habilidades técnicas', 'Conhecimentos técnicos', 'Principais competências', 'Tech stack', 'Linguagens',
    'Linguagens de programação', 'Programming languages', 'Technologies', 'Tools',
  ],
  certifications: [
    'Licenças e certificados', 'Licenças e certificações', 'Licenses & certifications', 'Licenses and certifications', 'Certificações',
    'Certificados', 'Licenças', 'Certifications', 'Certificates', 'Licenses',
  ],
  languages: ['Idiomas', 'Languages', 'Idioma', 'Language', 'Línguas', 'Língua', 'Línguas estrangeiras', 'Foreign languages'],
  projects: ['Projetos', 'Projects', 'Projetos pessoais', 'Personal projects', 'Principais projetos', 'Portfólio', 'Portfolio'],
  ignored: [
    'Formação', 'Formação acadêmica', 'Formação complementar', 'Formação profissional', 'Educação', 'Escolaridade', 'Histórico acadêmico',
    'Histórico escolar', 'Graduação', 'Pós-graduação', 'Ensino superior', 'Education', 'Academic background', 'Educational background',
    'Education and training', 'Formação e cursos', 'Formação Acadêmica e Complementar', 'Cursos', 'Courses', 'Cursos livres',
    'Cursos e certificações', 'Certificados e cursos', 'Treinamentos', 'Trabalho voluntário', 'Trabalhos voluntários', 'Voluntariado',
    'Volunteer work', 'Volunteering', 'Volunteer', 'Volunteer experience', 'Experiência voluntária', 'Experiência de voluntariado',
    'Ações sociais', 'Recomendações', 'Recomendações recebidas', 'Recommendations received', 'Interesses', 'Interesses pessoais',
    'Hobbies', 'Hobbies e interesses', 'Hobbies & Interests', 'Causas', 'Causas que apoio', 'Prêmios', 'Prêmios e reconhecimentos',
    'Reconhecimentos', 'Awards', 'Publicações', 'Organizações', 'Atividade', 'Atividades', 'Atividades extracurriculares',
    'Dados pessoais', 'Informações pessoais', 'Personal', 'Informações adicionais', 'Additional information', 'Sobre mim', 'About me',
    'Contato', 'Contact', 'Idade', 'Família', 'Perfil', 'Objetivo', 'Referências',
    'Pessoas que você pode conhecer', 'Talvez você conheça', 'Others also viewed', 'Perfis semelhantes',
  ],
};

const DECORATIONS: ReadonlyArray<(title: string) => string> = [
  (title) => title,
  (title) => `${title}:`,
  (title) => `${title} :`,
  (title) => `${title}.`,
  (title) => `${title} -`,
  (title) => `• ${title}`,
  (title) => `- ${title}`,
  (title) => `# ${title}`,
  (title) => `**${title}**`,
  (title) => `🎓 ${title}`,
  (title) => `1. ${title}`,
  (title) => `${title} (5)`,
  (title) => `${title} (12):`,
  (title) => `${title} · 12`,
  (title) => `${title}: 3`,
  (title) => title.toUpperCase(),
  (title) => title.toLowerCase(),
];

describe('Cada título cai no papel certo, com qualquer enfeite em volta', () => {
  for (const [role, titles] of Object.entries(TITLES_BY_ROLE) as ReadonlyArray<[SectionRole, readonly string[]]>) {
    for (const title of titles) {
      test(`${title}: ${role}`, () => {
        for (const decorate of DECORATIONS) {
          assert.equal(titleRole(decorate(title)), role, decorate(title));
        }
      });
    }
  }
});

describe('RF-41: frase que só começa igual não abre nem fecha seção', () => {
  const sentences = [
    'Formação de equipes técnicas', 'Formação de equipes técnicas.', 'Educação continuada em Java', 'Experiência com AWS',
    'Experiência em Java', 'Competências: Java', 'Tecnologias: Java, Spring', 'Idiomas: Inglês', 'Projetos de migração',
    'Cursos de Java', 'Graduação em Python', 'Certificados de conclusão', 'Sobre o projeto', 'Voluntariado em ONG',
    'Habilidades de comunicação', 'Licenças de software', 'Interesse em Java', 'Atividades do time', 'Recomendações de arquitetura',
    'Resumo das entregas', 'Línguas de programação funcional', 'Perfil de acesso', 'Projetos 2021', 'Experiência 2020',
  ];

  for (const sentence of sentences) {
    test(`não é título: ${sentence}`, () => assert.equal(titleRole(sentence), null));

    test(`dentro da descrição, não corta o cargo seguinte: ${sentence}`, () => {
      const profile = parse([
        'Experiência',
        'Analista',
        'Empresa Fictícia Um · Tempo integral',
        'jan de 2020 - dez de 2020',
        sentence,
        'Desenvolvedora',
        'Empresa Fictícia Dois · Tempo integral',
        'jan de 2018 - dez de 2018',
      ].join('\n'));
      assert.deepEqual(profile.sectionsRead, ['experience']);
      assert.equal(profile.experiences.length, 2);
      assert.equal(profile.totalMonths, 24);
    });
  }
});

describe('Nome comum de competência não corta a lista', () => {
  for (const skill of ['Redes sociais', 'Social media', 'Training', 'Ensino', 'Eventos', 'Events']) {
    test(skill, () => {
      assert.equal(titleRole(skill), null);
      assert.equal(parse(`Competências\nJava\n${skill}\nPython`).skillsText, `Java\n${skill}\nPython`);
    });
  }
});

describe('RF-41: seção de fora da lista não entra na nota, mesmo com título inexato', () => {
  const requirements: readonly Requirement[] = [listed('Python'), listed('Apache Kafka'), listed('Docker', 'preferred'), totalYears(10)];
  const body = 'Universidade Python Kafka Docker\nBacharelado em Python e Kafka\nCompetências: Docker\n2005 - 2009';
  const run = (text: string) => analyzeProfile({ text, url: '', requirements, asOf: AS_OF });
  const decorated = (title: string): readonly string[] => [title, `${title}:`, `${title.toUpperCase()}:`, `• ${title}`, `${title} (2)`, `**${title}**`];

  // O que a revisão mediu: 58 de 61 títulos deixavam a formação entrar.
  const REVIEW_TITLES = [
    'Formação acadêmica', 'FORMAÇÃO ACADÊMICA', 'Formação acadêmica (2)', 'Formação acadêmica:', 'FORMAÇÃO:', 'Formação Acadêmica e Complementar',
    'Formação e cursos', 'Cursos e certificações', 'Escolaridade', 'Graduação', 'Ensino superior', 'Education:', 'EDUCATION AND TRAINING',
    'Academic background', 'Educação:', 'Formação complementar:', 'Cursos:', 'Cursos livres', 'Certificados e cursos', '🎓 Formação acadêmica',
    '• Formação', '# Formação', '**Formação**', 'Formação acadêmica.', 'Formação acadêmica -', 'Trabalho voluntário:', 'Voluntariado:', 'Volunteer',
    'Volunteer work', 'Experiência voluntária', 'Experiência de voluntariado', 'Volunteer Experience:', 'Ações sociais', 'Recomendações:',
    'Recomendações recebidas', 'Recommendations received', 'Interesses:', 'Interesses pessoais', 'Hobbies e interesses', 'Hobbies:',
    'Hobbies & Interests', 'Causas que apoio', 'Prêmios e reconhecimentos', 'Reconhecimentos', 'Awards:', 'Publicações:', 'Dados pessoais:',
    'Informações adicionais', 'Additional information', 'Personal', 'Sobre mim:', 'Contato:', 'Pessoas que você pode conhecer', 'Talvez você conheça',
    'Others also viewed', 'Perfis semelhantes', 'Atividades', 'Atividades extracurriculares', 'Organizações:', 'Idade', 'Família',
  ];

  const afterSkills = 'Ana Souza\nExperiência\nDesenvolvedora\nEmpresa Fictícia · Tempo integral\njan de 2021 - dez de 2021\nCompetências\nJava\n';
  const afterExperience = 'Ana Souza\nCompetências\nJava\nExperiência\nDesenvolvedora\nEmpresa Fictícia · Tempo integral\njan de 2021 - dez de 2021\n';

  for (const title of REVIEW_TITLES) {
    test(`depois de Competências: ${title}`, () => {
      assert.deepEqual(run(`${afterSkills}${title}\n${body}`), run(afterSkills));
    });
  }

  for (const title of ['Formação', 'Formação acadêmica', 'Educação', 'Education', 'Graduação', 'Voluntariado', 'Volunteer work', 'Trabalho voluntário', 'Cursos']) {
    for (const line of decorated(title)) {
      test(`depois de Experiência, o período não soma: ${line}`, () => {
        const twin = run(`${afterExperience}${line}\n${body}`);
        assert.deepEqual(twin, run(afterExperience));
        assert.equal(twin.card.totalMonths, 12);
      });
    }
  }

  test('o caso central: Python só na formação não dá nota', () => {
    const python = [listed('Python')];
    const { match } = analyzeProfile({ text: 'Ana\nCompetências\nJava\nFormação acadêmica:\nBacharelado em Python\n', url: '', requirements: python, asOf: AS_OF });
    assert.equal(match.score, 0);
  });

  test('o caso central: USP de 2005 a 2009 não soma 60 meses', () => {
    const { card } = analyzeProfile({ text: 'Ana\nExperiência\nEng\nX · Tempo integral\njan de 2021 - dez de 2021\nFormação:\nUSP\n2005 - 2009\n', url: '', requirements: [], asOf: AS_OF });
    assert.equal(card.totalMonths, 12);
  });
});

describe('RF-40: o mesmo perfil com títulos escritos de outro jeito dá a mesma ficha', () => {
  const requirements: readonly Requirement[] = [listed('Python'), listed('Java', 'required', 3), listed('React', 'preferred'), listed('Inglês', 'preferred')];
  const run = (text: string) => analyzeProfile({ text, url: '', requirements, asOf: AS_OF });
  const body = (about: string, experience: string, skills: string, languages: string, education: string): string =>
    `Ana Souza\n${about}\nGosto de React.\n${experience}\nEngenheira\nAcme · Tempo integral\njan de 2020 - o momento · 4 anos\nCompetências: Java\n${skills}\nPython\n${languages}\nInglês\n${education}\nUSP\n2005 - 2009\n`;
  const base = run(body('Sobre', 'Experiência', 'Competências', 'Idiomas', 'Formação acadêmica'));

  const twins: ReadonlyArray<readonly [string, string]> = [
    ['maiúsculas', body('SOBRE', 'EXPERIÊNCIA', 'COMPETÊNCIAS', 'IDIOMAS', 'FORMAÇÃO ACADÊMICA')],
    ['contagem', body('Sobre', 'Experiência (1)', 'Competências (1)', 'Idiomas (1)', 'Formação acadêmica (1)')],
    ['contagem com ponto', body('Sobre', 'Experiência · 1', 'Competências · 1', 'Idiomas · 1', 'Formação acadêmica · 1')],
    ['dois-pontos', body('Sobre:', 'Experiência:', 'Competências:', 'Idiomas:', 'Formação acadêmica:')],
    ['marcadores', body('• Sobre', '• Experiência', '• Competências', '• Idiomas', '• Formação acadêmica')],
    ['variantes', body('Resumo', 'Experiência profissional', 'Habilidades', 'Idioma', 'Educação')],
    ['em inglês', body('Summary', 'Work Experience', 'Technical Skills', 'Languages', 'Education')],
  ];
  for (const [name, text] of twins) {
    test(name, () => {
      const twin = run(text);
      assert.deepEqual(twin.card, base.card);
      assert.deepEqual(twin.match, base.match);
    });
  }

  test('o controle prova alguma coisa: nota e seções conferidas', () => {
    assert.equal(base.card.totalMonths, 58);
    assert.deepEqual(base.card.sectionsRead, ['about', 'experience', 'skills', 'languages'] satisfies ProfileSection[]);
    assert.equal(base.match.score, 94);
  });
});

describe('Rótulo da lista de um cargo não corta os cargos seguintes', () => {
  const twoJobs = (label: string): string => [
    'Experiência',
    'Desenvolvedora',
    'Empresa Fictícia Um · Tempo integral',
    'jan de 2020 - dez de 2020',
    label,
    'Java, Spring',
    'Analista',
    'Empresa Fictícia Dois · Tempo integral',
    'jan de 2018 - dez de 2018',
    'Sistemas em PHP.',
    'Competências',
    'Docker',
  ].join('\n');

  for (const label of ['Tecnologias:', 'Tecnologias', 'Ferramentas:', 'Habilidades:', 'Conhecimentos:', 'Competências:', 'Projetos:', 'Atividades:', 'Atividades']) {
    test(label, () => {
      const profile = parse(twoJobs(label));
      assert.equal(profile.experiences.length, 2);
      assert.equal(profile.totalMonths, 24);
      assert.equal(profile.skillsText, 'Docker');
      assert.match(profile.experiences[0]?.text ?? '', /Java, Spring/u);
    });
  }

  test('dois rótulos no mesmo cargo', () => {
    const profile = parse(twoJobs('Atividades:\nApoio ao time.\nTecnologias:'));
    assert.equal(profile.experiences.length, 2);
    assert.equal(profile.totalMonths, 24);
  });

  test('sem outro período depois, é título de verdade', () => {
    const profile = parse('Experiência\nDesenvolvedora\nEmpresa Fictícia · Tempo integral\njan de 2020 - dez de 2020\nTecnologias:\nJava\nFormação:\nUSP\n2005 - 2009');
    assert.equal(profile.skillsText, 'Java');
    assert.equal(profile.totalMonths, 12);
  });

  test('título de seção comum continua sendo título, mesmo com período depois dele', () => {
    const profile = parse('Experiência\nDesenvolvedora\nEmpresa Fictícia · Tempo integral\njan de 2020 - dez de 2020\nProjetos\nBiblioteca de Exemplo\nmar de 2021 - abr de 2021');
    assert.equal(profile.totalMonths, 12);
    assert.match(profile.projectsText, /Biblioteca/u);
  });

  test('muitos rótulos não travam a leitura', () => {
    const text = `Experiência\n${'Tecnologias\nAtividades\n'.repeat(45_000)}`;
    const startedAt = performance.now();
    parse(text);
    const elapsed = performance.now() - startedAt;
    assert.ok(elapsed < 5000, `${elapsed.toFixed(0)} ms`);
  });
});
