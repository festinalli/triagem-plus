import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_INPUT_CHARS, MAX_PROFILE_CHARS } from '../../../src/core/profile/lines.ts';
import { parseProfileText } from '../../../src/core/profile/parse.ts';
import { AS_OF, fixture } from './fixtures.ts';

const parse = (text: string) => parseProfileText(text, AS_OF);
const titles = (text: string) => parse(text).experiences.map((experience) => experience.title);

describe('CA-05: português, um cargo por empresa', () => {
  const profile = parse(fixture('pt-um-cargo'));

  test('seções', () => {
    assert.deepEqual(profile.sectionsRead, ['about', 'experience', 'certifications', 'skills', 'languages', 'projects']);
    assert.equal(profile.about, 'Desenvolvo sistemas de pagamento e gosto de código simples.');
    assert.equal(profile.skillsText, 'Java\nSpring\nOracle');
    assert.equal(profile.languagesText, 'Português\nNativo ou bilíngue\nInglês\nAvançado');
    assert.match(profile.certificationsText, /Certificação Inventada de Java/);
    assert.match(profile.projectsText, /Biblioteca de código aberto em Kotlin\./);
    assert.equal(profile.truncated, false);
  });

  test('nome sem pronomes', () => {
    assert.equal(profile.name, 'Clara Fictícia Exemplo');
  });

  test('cargos, períodos e meses', () => {
    assert.deepEqual(
      profile.experiences.map((e) => [e.title, e.months, e.span]),
      [
        ['Desenvolvedora Sênior', 58, { start: { year: 2020, month: 1 }, end: null }],
        ['Desenvolvedora Plena', 34, { start: { year: 2017, month: 3 }, end: { year: 2019, month: 12 } }],
      ],
    );
    assert.equal(profile.totalMonths, 92);
  });

  test('text traz cargo, descrição e competências, e nada de empresa, local ou período', () => {
    assert.equal(
      profile.experiences[0]?.text,
      'Desenvolvedora Sênior\nDesenvolvimento de APIs de pagamento.\nCompetências: Java, Spring',
    );
    assert.equal(
      profile.experiences[1]?.text,
      'Desenvolvedora Plena\nManutenção de sistemas legados em Java.\nCompetências: Java, Oracle',
    );
  });

  test('datas de projetos e certificados não entram no total', () => {
    assert.match(profile.projectsText, /mar de 2021 - abr de 2021/);
    assert.equal(profile.experiences.length, 2);
  });
});

describe('CA-05: português, vários cargos na mesma empresa', () => {
  const profile = parse(fixture('pt-varios-cargos'));

  test('cada período abre uma experiência, e o cargo nunca é a empresa', () => {
    assert.deepEqual(
      profile.experiences.map((e) => [e.title, e.months]),
      [
        ['Engenheiro de Software Líder', 46],
        ['Engenheiro de Software', 22],
        ['Analista de Sistemas', 33],
      ],
    );
    assert.equal(profile.totalMonths, 101);
    assert.equal(profile.name, 'Bento Imaginário Silva');
  });

  test('text sem empresa, tipo de contrato, local ou período', () => {
    assert.deepEqual(
      profile.experiences.map((e) => e.text),
      [
        'Engenheiro de Software Líder\nLiderança do time de plataforma.\nCompetências: Kotlin, Kubernetes',
        'Engenheiro de Software\nMicrosserviços em Kotlin.\nCompetências: Kotlin, Kafka',
        'Analista de Sistemas\nManutenção de sistemas em PHP.',
      ],
    );
  });

  test('um grupo depois de outra experiência não deixa a empresa na descrição anterior', () => {
    const text = [
      'Experiência',
      'Analista',
      'Empresa Fictícia Um · Tempo integral',
      'jan de 2015 - dez de 2015 · 1 ano',
      'Descrição do cargo anterior.',
      'Empresa Fictícia Dois',
      'Tempo integral · 2 anos',
      'Cargo Novo',
      'jan de 2016 - dez de 2016 · 1 ano',
      'Outro Cargo',
      'jan de 2017 - dez de 2017 · 1 ano',
    ].join('\n');
    const { experiences } = parse(text);
    assert.deepEqual(experiences.map((e) => e.title), ['Analista', 'Cargo Novo', 'Outro Cargo']);
    assert.equal(experiences[0]?.text, 'Analista\nDescrição do cargo anterior.');
  });

  test('empresa com a duração na mesma linha do grupo', () => {
    const text = 'Experiência\nEmpresa Fictícia · 5 anos\nCargo A\n2020 - 2021\nCargo B\n2018 - 2019';
    assert.deepEqual(titles(text), ['Cargo A', 'Cargo B']);
  });
});

describe('CA-05: inglês', () => {
  const profile = parse(fixture('en'));

  test('seções, com as ignoradas de fora', () => {
    assert.deepEqual(profile.sectionsRead, ['about', 'experience', 'certifications', 'projects', 'skills', 'languages']);
    assert.equal(profile.skillsText, 'Go\nPostgreSQL\nPython');
    assert.match(profile.languagesText, /Portuguese/);
    assert.doesNotMatch(profile.languagesText, /Mia Placeholder|Staff Engineer/);
  });

  test('nome, cargos e meses', () => {
    assert.equal(profile.name, 'Ivy Madeup Example');
    assert.deepEqual(
      profile.experiences.map((e) => [e.title, e.months]),
      [
        ['Senior Software Engineer', 58],
        ['Software Engineer', 28],
        ['Consultant', 48],
      ],
    );
  });

  test('CA-06: a sobreposição de janeiro a junho de 2020 conta uma vez, e o ano isolado vale de janeiro a dezembro', () => {
    // 58 + 28 + 48 = 134 somando cada cargo; 128 sem contar duas vezes os 6 meses em comum.
    assert.equal(profile.totalMonths, 128);
  });

  test('text sem empresa, local nem modalidade', () => {
    assert.equal(profile.experiences[0]?.text, 'Senior Software Engineer\nBuilt payment APIs in Go.\nSkills: Go, PostgreSQL');
    assert.equal(profile.experiences[1]?.text, 'Software Engineer\nMaintained Python services.\nSkills: Python');
    assert.equal(profile.experiences[2]?.text, 'Consultant\nAdvised small teams on Ruby.');
  });
});

describe('CA-06: tempo', () => {
  test('sobreposição não conta duas vezes', () => {
    const text = [
      'Experiência',
      'Cargo A',
      'Empresa Fictícia Um · Tempo integral',
      'jan de 2020 - dez de 2020 · 1 ano',
      'Cargo B',
      'Empresa Fictícia Dois · Meio período',
      'jul de 2020 - jun de 2021 · 1 ano',
    ].join('\n');
    const profile = parse(text);
    assert.deepEqual(profile.experiences.map((e) => e.months), [12, 12]);
    assert.equal(profile.totalMonths, 18);
  });

  test('emprego atual usa asOf', () => {
    const text = 'Experiência\nCargo\nEmpresa Fictícia · Tempo integral\njan de 2020 - o momento · 4 anos 10 meses';
    assert.equal(parseProfileText(text, { year: 2024, month: 10 }).totalMonths, 58);
    assert.equal(parseProfileText(text, { year: 2020, month: 1 }).totalMonths, 1);
    assert.equal(parseProfileText(text, { year: 2030, month: 1 }).experiences[0]?.months, 121);
  });

  test('os marcadores de "atual" e as formas de intervalo', () => {
    const forms = [
      'jan de 2020 - o momento',
      'jan de 2020 – o momento',
      'jan 2020 - atual',
      'Jan 2020 - Present',
      'Jan 2020 – Present · 4 yrs 10 mos',
      'janeiro de 2020 até o momento',
      '01/2020 - atual',
      'jan 2020-atual',
      'jan de 2020 - o momento 4 anos 10 meses',
    ];
    for (const form of forms) {
      const profile = parse(`Experiência\nCargo\nEmpresa Fictícia · Tempo integral\n${form}\nDescrição.`);
      assert.equal(profile.totalMonths, 58, form);
      assert.equal(profile.experiences[0]?.text, 'Cargo\nDescrição.', form);
    }
  });

  test('anos soltos e meses fechados', () => {
    assert.equal(parse('Experiência\nAnalista\n2019 - 2021').totalMonths, 36);
    assert.equal(parse('Experiência\nAnalista\n2019-2021').totalMonths, 36);
    assert.equal(parse('Experiência\nAnalista\nset de 2018 - mar de 2020 · 1 ano 7 meses').totalMonths, 19);
  });

  test('um mês só, com a duração ao lado', () => {
    assert.equal(parse('Experiência\nAnalista\nmar de 2020 · 1 mês').totalMonths, 1);
  });

  test('período ilegível abre a experiência sem tempo e fica fora do total', () => {
    const profile = parse([
      'Experiência',
      'Cargo Trocado',
      'Empresa Fictícia · Tempo integral',
      'mar de 2021 - jan de 2020',
      'Descrição.',
      'Cargo Certo',
      'Empresa Fictícia · Tempo integral',
      'jan de 2022 - dez de 2022',
    ].join('\n'));
    assert.deepEqual(profile.experiences.map((e) => [e.title, e.span === null, e.months]), [
      ['Cargo Trocado', true, null],
      ['Cargo Certo', false, 12],
    ]);
    assert.equal(profile.totalMonths, 12);
  });

  test('total nulo quando nenhum período é legível', () => {
    assert.equal(parse('Experiência\nCargo\nEmpresa · Tempo integral\nmar de 2021 - jan de 2020').totalMonths, null);
    assert.equal(parse('Sobre\nTexto.').totalMonths, null);
  });

  test('linha com data no meio de uma frase não é período', () => {
    const profile = parse([
      'Experiência',
      'Cargo',
      'Empresa Fictícia · Tempo integral',
      'jan de 2020 - dez de 2020',
      'Entre 2019 - 2021 liderei o time.',
      'Certificação ISO-9001 - 2015',
      'jan de 2020 - migração para a nuvem',
    ].join('\n'));
    assert.equal(profile.experiences.length, 1);
    assert.equal(profile.totalMonths, 12);
  });
});

describe('Variações do cabeçalho da experiência', () => {
  test('empresa sem tipo de contrato não vira cargo', () => {
    const profile = parse([
      'Experiência',
      'Cargo Um',
      'Empresa Fictícia Um',
      'jan de 2020 - dez de 2020',
      'São Paulo, Brasil',
      'Descrição um.',
      'Cargo Dois',
      'Empresa Fictícia Dois',
      'jan de 2019 - dez de 2019',
      'Descrição dois.',
    ].join('\n'));
    assert.deepEqual(profile.experiences.map((e) => e.title), ['Cargo Um', 'Cargo Dois']);
    assert.deepEqual(profile.experiences.map((e) => e.text), ['Cargo Um\nDescrição um.', 'Cargo Dois\nDescrição dois.']);
  });

  test('cargo com vírgula continua cargo', () => {
    assert.deepEqual(
      titles('Experiência\nEngenheiro de Software, Backend\nEmpresa Fictícia · Tempo integral\n2020 - 2021'),
      ['Engenheiro de Software, Backend'],
    );
    assert.deepEqual(
      titles('Experiência\nEmpresa Fictícia\nTempo integral · 5 anos\nEngenheiro de Software, Backend\n2020 - 2021'),
      ['Engenheiro de Software, Backend'],
    );
  });

  test('cargo que termina em modalidade continua cargo', () => {
    assert.deepEqual(
      titles('Experiência\nEmpresa Fictícia\nTempo integral · 5 anos\nDesenvolvedor Remoto\n2020 - 2021'),
      ['Desenvolvedor Remoto'],
    );
  });

  test('local colado antes do período não vira cargo', () => {
    assert.deepEqual(
      titles('Experiência\nCargo\nEmpresa Fictícia · Tempo integral\nSão Paulo, Brasil · Remota\n2020 - 2021'),
      ['Cargo'],
    );
  });

  test('tipo de contrato por cargo, dentro de um grupo', () => {
    const text = 'Experiência\nEmpresa Fictícia\n5 anos\nCargo A\nTempo integral\n2020 - 2021\nCargo B\nTempo integral\n2018 - 2019';
    assert.deepEqual(titles(text), ['Cargo A', 'Cargo B']);
  });

  test('sem nenhuma linha para ser o cargo, o título fica vazio, e não uma frase ou uma empresa', () => {
    assert.deepEqual(titles('Experiência\nEmpresa Fictícia · Tempo integral\n2020 - 2021'), ['']);
    // A frase não vira cargo, mas também não se perde: fica como texto de uma experiência sem tempo.
    const profile = parse('Experiência\nAtuei com sistemas distribuídos em Go.\nEmpresa · Tempo integral\n2020 - 2021');
    assert.deepEqual(profile.experiences.map((e) => [e.title, e.months, e.text]), [
      ['', null, 'Atuei com sistemas distribuídos em Go.'],
      ['', 24, ''],
    ]);
  });

  test('abreviação no fim continua cargo', () => {
    assert.deepEqual(titles('Experiência\nDesenvolvedor Sr.\nEmpresa · Tempo integral\n2020 - 2021'), ['Desenvolvedor Sr.']);
  });

  test('local fica de fora do text, em todas as formas previstas', () => {
    const locations = [
      'São Paulo, Brasil · Híbrida',
      'São Paulo, São Paulo, Brasil',
      'Curitiba, Paraná',
      'São Paulo - SP',
      'Remota',
      'Hybrid',
      'On-site',
      'Presencial',
      'Austin, Texas, United States · Remote',
      'Brasil',
    ];
    for (const location of locations) {
      const profile = parse(`Experiência\nCargo\nEmpresa Fictícia · Tempo integral\n2020 - 2021\n${location}\nDescrição do cargo.`);
      assert.equal(profile.experiences[0]?.text, 'Cargo\nDescrição do cargo.', location);
    }
  });

  test('frase que cita o trabalho remoto fica no text', () => {
    const line = 'Atuei em modelo remoto com Java e Spring, em São Paulo, Brasil.';
    const profile = parse(`Experiência\nCargo\nEmpresa · Tempo integral\n2020 - 2021\n${line}`);
    assert.equal(profile.experiences[0]?.text, `Cargo\n${line}`);
  });

  test('"Java, Spring" solto tem forma de local, mas é stack e fica; "Campinas, Brasil" sai', () => {
    const body = 'Java, Spring\nCampinas, Brasil\nFrase qualquer.\nKotlin, Kafka\nCompetências: Go, Rust\nTecnologias: C#, Node.js';
    const profile = parse(`Experiência\nCargo\nEmpresa · Tempo integral\n2020 - 2021\n${body}`);
    assert.equal(profile.experiences[0]?.text, 'Cargo\nJava, Spring\nFrase qualquer.\nKotlin, Kafka\nCompetências: Go, Rust\nTecnologias: C#, Node.js');
  });
});

describe('Sem datas', () => {
  const profile = parse(fixture('sem-datas'));

  test('as experiências existem, sem tempo, e os termos não se perdem', () => {
    assert.deepEqual(profile.experiences, [
      {
        title: 'Desenvolvedor Python',
        span: null,
        months: null,
        text: 'Desenvolvedor Python\nAutomação de processos em Python.\nCompetências: Python, Django',
      },
      {
        title: 'Analista de Suporte',
        span: null,
        months: null,
        text: 'Analista de Suporte\nAtendimento e scripts em Bash.',
      },
    ]);
    assert.equal(profile.totalMonths, null);
    assert.deepEqual(profile.sectionsRead, ['about', 'experience', 'skills']);
  });

  test('uma linha de frase no começo não vira cargo', () => {
    const { experiences } = parse('Experiência\nAtuei com sistemas distribuídos em Go.');
    assert.equal(experiences[0]?.title, '');
    assert.equal(experiences[0]?.text, 'Atuei com sistemas distribuídos em Go.');
  });

  test('texto solto antes do primeiro período também vira experiência sem tempo', () => {
    const { experiences, totalMonths } = parse('Experiência\nCargo Antigo\nDescrição antiga.\n\nCargo\nEmpresa · Tempo integral\n2020 - 2021');
    assert.deepEqual(experiences.map((e) => [e.title, e.months]), [['Cargo Antigo', null], ['Cargo', 24]]);
    assert.equal(totalMonths, 24);
  });
});

describe('Lista cortada (RF-35)', () => {
  test('o sinal é percebido e não entra em nenhum text', () => {
    const profile = parse(fixture('lista-cortada'));
    assert.equal(profile.truncated, true);
    assert.equal(profile.experiences[0]?.text, 'Desenvolvedora Front-end\nInterfaces em React.\nCompetências: React, TypeScript');
    assert.equal(profile.skillsText, 'React\nTypeScript');
    assert.equal(profile.totalMonths, 42);
    assert.doesNotMatch(JSON.stringify(profile), /Exibir/);
  });

  for (const line of ['Exibir todas as 12 experiências', 'Exibir todas', 'Show all 8 skills', 'Show all', 'Show all 12 experiences →', 'Exibir todos os 5 projetos', 'EXIBIR TODAS']) {
    test(`"${line}"`, () => {
      const profile = parse(`Competências\nJava\n${line}\nSpring`);
      assert.equal(profile.truncated, true);
      assert.equal(profile.skillsText, 'Java\nSpring');
    });
  }

  test('sinal fora de qualquer seção também avisa, porque pode ser o que faltou', () => {
    assert.equal(parse('Exibir todas as 12 experiências').truncated, true);
  });

  test('sinal numa seção ignorada não avisa: abrir aquela lista não muda nada', () => {
    assert.equal(parse('Competências\nJava\n\nRecomendações\nExibir todas as 5 recomendações').truncated, false);
  });

  test('frase que começa igual não é sinal', () => {
    const line = 'Ver todos os relatórios de vendas e corrigir os erros encontrados.';
    const profile = parse(`Sobre\n${line}`);
    assert.equal(profile.truncated, false);
    assert.equal(profile.about, line);
  });

  test('"ver mais" some do texto e também avisa', () => {
    for (const line of ['…ver mais', '... see more', 'Exibir mais', 'Show more']) {
      const profile = parse(`Sobre\nComeço do texto\n${line}`);
      assert.equal(profile.about, 'Começo do texto', line);
      assert.equal(profile.truncated, true, line);
    }
  });

  test('sem sinal, não há aviso', () => {
    assert.equal(parse(fixture('pt-varios-cargos')).truncated, false);
  });

  test('seção só com o sinal não conta como lida', () => {
    const profile = parse('Experiência\nExibir todas as 12 experiências\nCompetências\nJava');
    assert.deepEqual(profile.sectionsRead, ['skills']);
    assert.equal(profile.truncated, true);
  });
});

describe('Colado com repetições e ruído', () => {
  const profile = parse(fixture('colado-com-ruido'));

  test('repetições somem, inclusive da âncora e dos títulos', () => {
    assert.deepEqual(profile.experiences.map((e) => [e.title, e.months]), [['Analista de Dados', 45], ['Analista Júnior', 25]]);
    assert.equal(profile.experiences[0]?.text, 'Analista de Dados\nRelatórios em SQL e Power BI.\nCompetências: SQL, Power BI');
    assert.equal(profile.about, 'Analista de dados com foco em SQL.');
    assert.equal(profile.totalMonths, 70);
  });

  test('endosso com nome de outra pessoa não fica nas competências', () => {
    assert.equal(profile.skillsText, 'SQL\nPower BI');
  });

  test('menu antes do nome: a primeira linha não é nome, então nome nulo', () => {
    assert.equal(profile.name, null);
  });

  test('nada do cabeçalho, das sugestões nem do rodapé chega a um campo', () => {
    const all = JSON.stringify(profile);
    for (const absent of ['Belo Horizonte', 'Dora', 'Beltrano', 'Sicrano', 'Fulano', 'Empresa Fictícia', 'Acessibilidade', 'Central de Ajuda', 'Minha rede', 'Desenvolvedor Java']) {
      assert.ok(!all.includes(absent), absent);
    }
  });

  test('quebras de linha de Windows, espaços duros e caracteres invisíveis', () => {
    const noisy = fixture('pt-um-cargo')
      .replace(/\n/g, '\r\n')
      .replace('Experiência', '\uFEFFExperiência\u200B')
      .replace('Clara Fictícia Exemplo', 'Clara\u00A0Fictícia   Exemplo');
    assert.deepEqual(parse(noisy), parse(fixture('pt-um-cargo')));
  });

  test('acento decomposto (NFD) e maiúsculas no título', () => {
    const profile2 = parse('EXPERIÊNCIA\nCargo\n2020 - 2021\n' + 'Competências'.normalize('NFD') + '\nJava');
    assert.deepEqual(profile2.sectionsRead, ['experience', 'skills']);
    assert.equal(profile2.skillsText, 'Java');
  });

  test('a mesma experiência colada duas vezes conta uma vez', () => {
    const block = 'Cargo\nEmpresa Fictícia · Tempo integral\njan de 2020 - dez de 2020\nDescrição.';
    const twice = parse(`Experiência\n${block}\n${block}`);
    assert.equal(twice.experiences.length, 1);
    assert.equal(twice.totalMonths, 12);
  });
});

describe('Títulos de seção', () => {
  test('português e inglês, com "Conhecimentos"', () => {
    const pairs: ReadonlyArray<readonly [string, string]> = [
      ['Sobre', 'about'], ['About', 'about'],
      ['Competências', 'skills'], ['Skills', 'skills'], ['Conhecimentos', 'skills'],
      ['Licenças e certificados', 'certifications'], ['Licenses & certifications', 'certifications'],
      ['Idiomas', 'languages'], ['Languages', 'languages'],
      ['Projetos', 'projects'], ['Projects', 'projects'],
    ];
    for (const [title, section] of pairs) {
      assert.deepEqual(parse(`${title}\nConteúdo`).sectionsRead, [section], title);
    }
    assert.deepEqual(parse('Experiência\nCargo\n2020 - 2021').sectionsRead, ['experience']);
    assert.deepEqual(parse('Experience\nRole\n2020 - 2021').sectionsRead, ['experience']);
  });

  const ignored = [
    'Formação acadêmica', 'Education', 'Trabalho voluntário', 'Volunteering', 'Volunteer experience', 'Recomendações',
    'Recommendations', 'Interesses', 'Interests', 'Causas', 'Causes', 'Atividade', 'Activity', 'Publicações',
    'Publications', 'Prêmios', 'Honras', 'Honors & awards', 'Organizações', 'Organizations', 'Cursos', 'Courses',
    'Destaques', 'Featured', 'Patentes', 'Patents', 'Pessoas também viram', 'People also viewed', 'Mais perfis para você',
    'More profiles for you', 'Formação complementar', 'Hobbies', 'Dados pessoais', 'Informações pessoais', 'Personal information',
    'Personal details', 'Contato', 'Informações de contato', 'Contact info',
  ];
  for (const title of ignored) {
    test(`"${title}" encerra o trecho, e uma seção que conta depois dela volta a ser lida`, () => {
      const profile = parse(`Competências\nJava\n${title}\nCOBOL\n2010 - 2014\nIdiomas\nPortuguês`);
      assert.equal(profile.skillsText, 'Java');
      assert.equal(profile.languagesText, 'Português');
      assert.deepEqual(profile.sectionsRead, ['skills', 'languages']);
      assert.doesNotMatch(JSON.stringify(profile), /COBOL|2014/);
    });
  }

  for (const word of ['Recursos', 'Resources', 'Análises', 'Analytics']) {
    test(`"${word}" no meio de uma descrição não corta os cargos seguintes`, () => {
      const profile = parse(['Experiência', 'Cargo Um', 'Empresa Fictícia · Tempo integral', 'jan de 2020 - dez de 2020', 'Descrição.', word, 'Mais descrição.', 'Cargo Dois', 'Empresa Fictícia · Tempo integral', 'jan de 2018 - dez de 2018', 'Competências', 'Java'].join('\n'));
      assert.deepEqual(profile.experiences.map((experience) => experience.title), ['Cargo Um', 'Cargo Dois']);
      assert.equal(profile.skillsText, 'Java');
    });

    test(`"${word}" antes de Sobre continua descartado com o cabeçalho`, () => {
      const profile = parse(`Clara Fictícia Exemplo\n${word}\n1.234 visualizações do perfil\nSobre\nDesenvolvo sistemas.`);
      assert.equal(profile.about, 'Desenvolvo sistemas.');
      assert.doesNotMatch(JSON.stringify(profile), /visualizações/);
    });
  }

  test('seção ignorada no meio encerra a experiência, e as datas dela não contam', () => {
    const profile = parse([
      'Experiência',
      'Cargo',
      'Empresa Fictícia · Tempo integral',
      'jan de 2020 - dez de 2020',
      'Descrição.',
      'Formação acadêmica',
      'Universidade Inventada',
      'Cargo Falso',
      'jan de 2005 - dez de 2009',
      'Competências',
      'Java',
    ].join('\n'));
    assert.deepEqual(profile.experiences.map((e) => e.title), ['Cargo']);
    assert.equal(profile.experiences[0]?.text, 'Cargo\nDescrição.');
    assert.equal(profile.totalMonths, 12);
    assert.equal(profile.skillsText, 'Java');
  });

  test('a palavra dentro de uma frase não abre nem encerra seção', () => {
    const sentences = [
      'Experiência com Java e Spring em ambientes críticos.',
      'Tenho Experiência em liderança.',
      'Formação acadêmica em Ciência da Computação ajudou no projeto.',
      'Projetos de migração para a nuvem',
      'Recomendações de arquitetura para o time',
      'Competências: Java, Spring',
      'Sobre o projeto: sistema de pagamento',
    ];
    const text = ['Experiência', 'Cargo', 'Empresa Fictícia · Tempo integral', '2020 - 2021', 'Descrição.', ...sentences].join('\n');
    const profile = parse(text);
    assert.deepEqual(profile.sectionsRead, ['experience']);
    assert.equal(profile.experiences.length, 1);
    assert.equal(profile.experiences[0]?.text, ['Cargo', 'Descrição.', ...sentences].join('\n'));
  });

  test('marcador, dois-pontos e ponto em volta continuam sendo título (RF-40)', () => {
    for (const title of ['- Projetos', '• Projetos', 'Projetos:', 'Projetos.', '**Projetos**']) {
      assert.deepEqual(parse(`Sobre\nTexto\n${title}\nBiblioteca.`).sectionsRead, ['about', 'projects'], title);
    }
  });

  test('abertura de frase com texto depois dos dois-pontos não é título', () => {
    const text = 'Sobre\nTexto\nProjetos: migração para a nuvem\nExperiência em Java\nFim';
    assert.deepEqual(parse(text).sectionsRead, ['about']);
    assert.equal(parse(text).about, 'Texto\nProjetos: migração para a nuvem\nExperiência em Java\nFim');
  });

  test('título com contagem e em maiúsculas', () => {
    assert.deepEqual(parse('COMPETÊNCIAS (12)\nJava').sectionsRead, ['skills']);
  });
});

describe('Robustez', () => {
  const empty = {
    name: null,
    about: '',
    experiences: [],
    skillsText: '',
    certificationsText: '',
    languagesText: '',
    projectsText: '',
    sectionsRead: [],
    truncated: false,
    totalMonths: null,
  };

  test('entrada vazia ou só com espaços', () => {
    assert.deepEqual(parse(''), empty);
    assert.deepEqual(parse('   \n\n\t\r\n  '), empty);
  });

  test('entrada que não é texto não lança erro', () => {
    for (const value of [null, undefined, 42, {}, []]) {
      assert.deepEqual(parseProfileText(value as unknown as string, AS_OF), empty);
    }
  });

  const SIZE = 200_000;
  const long: ReadonlyArray<readonly [string, string]> = [
    ['uma linha só', 'a'.repeat(SIZE)],
    ['só quebras de linha', '\n'.repeat(SIZE)],
    ['só espaços', ' '.repeat(SIZE)],
    ['parênteses abertos', '('.repeat(SIZE)],
    ['vírgulas', 'A, '.repeat(SIZE / 3)],
    ['títulos alternados', 'Sobre\nExperiência\n'.repeat(SIZE / 18)],
    ['períodos alternados', 'Experiência\n' + '2019 - 2021\n2018 - 2020\n'.repeat(SIZE / 24)],
    ['experiências diferentes', 'Experiência\n' + Array.from({ length: 6000 }, (_, i) => `Cargo ${i}\nEmpresa · Tempo integral\n2019 - 2021\nDescrição ${i}.`).join('\n')],
    ['espaços no meio do período', `Experiência\n2019${' '.repeat(SIZE)}- 2021`],
    ['dígitos', '1'.repeat(SIZE)],
    ['título repetido com texto', 'Competências\nJava\n'.repeat(SIZE / 19)],
  ];
  for (const [label, text] of long) {
    test(`${label}: 200 mil caracteres não travam`, () => {
      const startedAt = performance.now();
      const profile = parse(text);
      assert.ok(performance.now() - startedAt < 2000, 'demorou demais');
      assert.equal(typeof profile.truncated, 'boolean');
    });
  }

  test('o que passa do limite é cortado e sai com aviso', () => {
    const text = `Clara Fictícia Exemplo\nSobre\nInício.\n${'x'.repeat(SIZE)}\nCompetências\nJava`;
    const profile = parse(text);
    assert.equal(profile.name, 'Clara Fictícia Exemplo');
    assert.equal(profile.truncated, true);
    assert.equal(profile.skillsText, '');
    assert.ok(profile.about.length < SIZE);
  });

  describe('o limite de 100 mil vale só para o que conta', () => {
    const counted = 'Sobre\nDesenvolvo sistemas.\nExperiência\nCargo\nEmpresa Fictícia · Tempo integral\njan de 2020 - dez de 2020\nCompetências\nJava';
    const filler = (title: string, size: number): string => `${title}\n${'Texto de enchimento sem nada que conte.\n'.repeat(Math.ceil(size / 40))}`;
    const expected = parse(counted);

    const shapes: ReadonlyArray<readonly [string, string]> = [
      ['seção ignorada de 150 mil antes de tudo', `${filler('Recomendações', 150_000)}${counted}`],
      ['seção ignorada de 900 mil antes de tudo', `${filler('Recomendações', 900_000)}${counted}`],
      ['cabeçalho de 900 mil', `${filler('Clara', 900_000)}${counted}`],
      ['seção ignorada de 900 mil no meio', `Sobre\nDesenvolvo sistemas.\n${filler('Formação acadêmica', 900_000)}Experiência\nCargo\nEmpresa Fictícia · Tempo integral\njan de 2020 - dez de 2020\nCompetências\nJava`],
    ];
    for (const [label, text] of shapes) {
      test(`${label}: o que conta fica igual, sem aviso de corte`, () => {
        assert.ok(text.length < MAX_INPUT_CHARS);
        const profile = parse(text);
        assert.equal(profile.truncated, false);
        assert.equal(profile.about, expected.about);
        assert.equal(profile.skillsText, expected.skillsText);
        assert.deepEqual(profile.experiences, expected.experiences);
        assert.equal(profile.totalMonths, expected.totalMonths);
      });
    }

    test('texto que conta acima de 100 mil é cortado, o começo fica e sai com aviso', () => {
      const about = Array.from({ length: 5_000 }, (_, index) => `Linha ${index} do sobre, com palavras.`).join('\n');
      const profile = parse(`Sobre\n${about}\nCompetências\nJava`);
      assert.equal(profile.truncated, true);
      assert.equal(profile.skillsText, '');
      assert.ok(profile.about.startsWith('Linha 0 do sobre'));
      assert.ok(profile.about.length <= MAX_PROFILE_CHARS);
    });

    test('texto que conta exatamente no limite não sai com aviso', () => {
      const line = 'x'.repeat(MAX_PROFILE_CHARS);
      const profile = parse(`Sobre\n${line}`);
      assert.equal(profile.about, line);
      assert.equal(profile.truncated, false);
    });

    test('acima de 1 milhão de caracteres, o resto nem é lido, e sai com aviso', () => {
      const profile = parse(`${filler('Recomendações', MAX_INPUT_CHARS + 1_000)}Competências\nJava`);
      assert.equal(profile.truncated, true);
      assert.equal(profile.skillsText, '');
    });

    const big: ReadonlyArray<readonly [string, string]> = [
      ['linhas longas em seção ignorada', filler('Recomendações', MAX_INPUT_CHARS)],
      ['linhas curtas em seção ignorada', `Recomendações\n${'a\n'.repeat(MAX_INPUT_CHARS / 2)}`],
      ['linhas curtas no cabeçalho', 'a\n'.repeat(MAX_INPUT_CHARS / 2)],
      ['linhas curtas em seção que conta', `Competências\n${'a\nb\n'.repeat(MAX_INPUT_CHARS / 4)}`],
      ['uma linha só', `Sobre\n${'a'.repeat(MAX_INPUT_CHARS)}`],
    ];
    for (const [label, text] of big) {
      test(`${label}: 1 milhão de caracteres não trava`, () => {
        const startedAt = performance.now();
        parse(text);
        const elapsed = performance.now() - startedAt;
        assert.ok(elapsed < 5000, `${elapsed.toFixed(0)} ms`);
      });
    }
  });

  test('perfil de tamanho normal fica abaixo de 200 ms (RNF-07)', () => {
    const text = fixture('en');
    const startedAt = performance.now();
    parse(text);
    assert.ok(performance.now() - startedAt < 200);
  });

  test('duas leituras do mesmo texto dão o mesmo resultado', () => {
    const text = fixture('en');
    assert.deepEqual(parse(text), parse(text));
  });
});

describe('UF não vira linguagem (DP-06)', () => {
  const body = (line: string): string => `Experiência\nCargo\nEmpresa Fictícia · Tempo integral\n2020 - 2021\n${line}\nDescrição do cargo.`;
  const textOf = (line: string): string | undefined => parse(body(line)).experiences[0]?.text;

  for (const place of ['Goiânia, GO', 'Goiânia, GO, Brasil', 'Goiânia, GO · Híbrida', 'Goiânia - GO', 'Goiânia/GO', 'Goiânia GO', 'GO', 'Rio de Janeiro, RJ, Brasil', 'Recife, PE', 'Campo Grande, MS', 'Palmas, TO']) {
    test(`"${place}" sai do texto`, () => assert.equal(textOf(place), 'Cargo\nDescrição do cargo.'));
  }

  test('"GO" solto em qualquer linha depois do período', () => {
    assert.equal(parse('Experiência\nCargo\nEmpresa Fictícia · Tempo integral\n2020 - 2021\nDescrição.\nGO\nMais descrição.').experiences[0]?.text, 'Cargo\nDescrição.\nMais descrição.');
  });

  for (const stack of ['Java, Spring', 'Go, Rust', 'Go', 'AWS, Python, GO', 'Java, GO', 'Microsserviços Python GO']) {
    test(`"${stack}" é stack e fica`, () => assert.equal(textOf(stack), `Cargo\n${stack}\nDescrição do cargo.`));
  }

  test('a linha colada antes do período também é local', () => {
    assert.deepEqual(titles('Experiência\nCargo\nEmpresa Fictícia · Tempo integral\nGoiânia, GO\n2020 - 2021'), ['Cargo']);
  });

  test('nome de tecnologia logo depois do período não é confundido com lugar', () => {
    assert.equal(parse('Experiência\nAnalista\n2020 - 2021\nPython\nDescrição.').experiences[0]?.text, 'Analista\nPython\nDescrição.');
  });
});

describe('Leitura do período', () => {
  const cases: ReadonlyArray<readonly [string, number]> = [
    ['Desde jan de 2020', 58],
    ['desde janeiro de 2020', 58],
    ['Desde 01/2020', 58],
    ['Desde 2020', 58],
    ['Since 2020', 58],
    ['Since Jan 2020', 58],
    ['Desde jan de 2020 · 4 anos 10 meses', 58],
    ['jan 2020 - today', 58],
    ['Jan 2020 - Até agora', 58],
    ['jan de 2020 - agora', 58],
    ['Jan 2020 – Ongoing', 58],
    ['jan de 2020 - em andamento', 58],
    ['(jan 2020 - dez 2021)', 24],
    ['[2020 - 2021]', 24],
    ['De 2020 a 2021', 24],
    ['de jan/2020 a dez/2021', 24],
    ['20/01/2020 - 20/12/2021', 24],
  ];
  for (const [line, months] of cases) {
    test(`${line}: ${months} meses`, () => {
      assert.equal(parse(`Experiência\nAnalista\nEmpresa Fictícia · Tempo integral\n${line}\nDescrição.`).totalMonths, months);
    });
  }

  for (const line of ['Desde 2020 lidero o time.', 'Desde que entrei, cuidei do projeto.', 'De lá para cá, muita coisa mudou em 2020']) {
    test(`frase não é período: ${line}`, () => {
      const profile = parse(`Experiência\nAnalista\nEmpresa Fictícia · Tempo integral\njan de 2023 - dez de 2023\n${line}`);
      assert.equal(profile.experiences.length, 1);
      assert.equal(profile.totalMonths, 12);
    });
  }
});

describe('Mesmo cargo e mesmo período em duas entradas', () => {
  const twoCompanies = 'Experiência\nConsultor\nEmpresa Fictícia Um · Autônomo\njan de 2020 - dez de 2021\nProjetos em Java.\nConsultor\nEmpresa Fictícia Dois · Autônomo\njan de 2020 - dez de 2021\nTrabalho longo em Python e mais descrição.';

  test('as duas descrições ficam, e o tempo é um só', () => {
    const profile = parse(twoCompanies);
    const all = profile.experiences.map((experience) => experience.text).join('\n');
    assert.match(all, /Java/u);
    assert.match(all, /Python/u);
    assert.equal(profile.totalMonths, 24);
  });

  test('a mesma entrada repetida continua sendo uma só', () => {
    const block = 'Consultor\nEmpresa Fictícia Um · Autônomo\njan de 2020 - dez de 2021\nProjetos em Java.';
    assert.equal(parse(`Experiência\n${block}\n${block}`).experiences.length, 1);
  });

  test('a versão cortada some quando a completa tem todas as linhas dela', () => {
    const short = 'Consultor\nEmpresa Fictícia Um · Autônomo\njan de 2020 - dez de 2021\nProjetos em Java.';
    const long = `${short}\nE também em Kotlin.`;
    for (const text of [`${short}\n${long}`, `${long}\n${short}`]) {
      const { experiences } = parse(`Experiência\n${text}`);
      assert.equal(experiences.length, 1);
      assert.match(experiences[0]?.text ?? '', /Kotlin/u);
    }
  });

  test('muitas entradas com a mesma chave não travam', () => {
    const text = `Experiência\n${Array.from({ length: 4000 }, (_, index) => `Consultor\nEmpresa · Autônomo\n2019 - 2021\nDescrição ${index}.`).join('\n')}`;
    const startedAt = performance.now();
    parse(text);
    assert.ok(performance.now() - startedAt < 2000);
  });
});
