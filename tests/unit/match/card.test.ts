// A ficha: o que entra, em que seção, com que tempo (RF-34, RF-42, RF-43, CA-04, seção 9).
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { impliedTerms } from '../../../src/core/dictionary/index.ts';
import { buildCard } from '../../../src/core/match/card.ts';
import { computeMatch } from '../../../src/core/match/score.ts';
import type { CardTerm, ProfileCard, Requirement } from '../../../src/core/model.ts';
import { parseProfileText } from '../../../src/core/profile/parse.ts';
import { AS_OF, free, language, listed, profileText, titleWord } from './helpers.ts';

function cardFor(sections: Readonly<Record<string, readonly string[]>>, requirements: readonly Requirement[] = []): ProfileCard {
  return buildCard(parseProfileText(profileText(sections), AS_OF), requirements);
}

function term(card: ProfileCard, key: string): CardTerm | undefined {
  return card.terms.find((candidate) => candidate.key === key);
}

const JOB = (title: string, period: string, ...body: string[]): string[] => [title, 'Empresa Fictícia · Tempo integral', period, ...body];

describe('Termos ambíguos (CA-04)', () => {
  test('"Go" em Competências conta', () => {
    const card = cardFor({ Competências: ['Go'] });
    assert.deepEqual(term(card, 'Go')?.sections, ['skills']);
  });

  test('"Go" em lista separada por vírgula e por ponto do meio', () => {
    assert.ok(term(cardFor({ Competências: ['Go, Rust'] }), 'Go'));
    assert.ok(term(cardFor({ Competências: ['Docker · Go · R'] }), 'Go'));
    assert.ok(term(cardFor({ Competências: ['Docker · Go · R'] }), 'R'));
  });

  test('"Go" com nível ao lado continua sendo item de lista', () => {
    assert.ok(term(cardFor({ Competências: ['Go (avançado)'] }), 'Go'));
    assert.ok(term(cardFor({ Competências: ['Go - avançado'] }), 'Go'));
  });

  test('"go to market" em Sobre não conta', () => {
    const card = cardFor({ Sobre: ['Cuidei da estratégia de go to market da empresa.'] });
    assert.equal(term(card, 'Go'), undefined);
    const { results } = computeMatch(card, [listed('Go')]);
    assert.equal(results[0]?.status, 'not_found');
  });

  test('"go to market" em Competências não conta', () => {
    assert.equal(term(cardFor({ Competências: ['Go to market'] }), 'Go'), undefined);
    assert.equal(term(cardFor({ Competências: ['Vendas, go-to-market'] }), 'Go'), undefined);
  });

  test('"Go" solto em Sobre, sem contexto, não conta; com contexto, conta como citação', () => {
    assert.equal(term(cardFor({ Sobre: ['Vamos que vamos, go team.'] }), 'Go'), undefined);
    assert.deepEqual(term(cardFor({ Sobre: ['Tenho experiência com Go.'] }), 'Go')?.sections, ['about']);
  });

  test('o contexto não atravessa seções: "golang" em Projetos não valida "go" em Sobre', () => {
    const card = cardFor({ Sobre: ['Vamos que vamos, go team.'], Projetos: ['Biblioteca em golang.'] });
    assert.deepEqual(term(card, 'Go')?.sections, ['projects']);
  });

  test('o contexto não atravessa experiências', () => {
    const card = cardFor({
      Experiência: [
        ...JOB('Desenvolvedora', 'jan de 2020 - dez de 2020 · 1 ano', 'Desenvolvimento em Go.'),
        ...JOB('Analista', 'jan de 2015 - dez de 2015 · 1 ano', 'Lema do time: go team.'),
      ],
    });
    assert.equal(term(card, 'Go')?.months, 12);
    assert.deepEqual(term(card, 'Go')?.jobTitles, ['Desenvolvedor(a)']);
  });

  test('C, C++, C#, .NET e Node.js não se confundem', () => {
    const card = cardFor({ Competências: ['C++', 'C#', '.NET', 'Node.js'] });
    assert.deepEqual(card.terms.map((found) => found.key), ['.NET', 'C#', 'C++', 'Node.js']);
    assert.equal(term(cardFor({ Competências: ['C++'] }), 'C'), undefined);
  });
});

describe('Spring, Oracle e níveis', () => {
  const spring = listed('Spring');

  test('"Spring" em Competências é termo da lista e conta', () => {
    const card = cardFor({ Competências: ['Spring'] }, [spring]);
    assert.deepEqual(card.searchedFreeTerms, []);
    assert.equal(computeMatch(card, [spring]).results[0]?.credit, 1);
  });

  test('quem escreveu Spring Boot atende a quem pede Spring, com o mesmo tempo', () => {
    const card = cardFor({ Experiência: JOB('Desenvolvedora', 'jan de 2020 - dez de 2020 · 1 ano', 'Serviços em Spring Boot.') });
    assert.deepEqual(term(card, 'Spring')?.sections, ['experience']);
    assert.equal(term(card, 'Spring')?.months, 12);
    assert.ok(term(card, 'Spring Boot'));
  });

  test('quem escreveu Spring não atende a quem pede Spring Boot', () => {
    const card = cardFor({ Competências: ['Spring'] });
    assert.equal(computeMatch(card, [listed('Spring Boot')]).results[0]?.status, 'not_found');
  });

  test('"spring 2020" em Sobre não conta, nem com Java no texto', () => {
    assert.equal(term(cardFor({ Sobre: ['In spring 2020 I started with Java.'] }), 'Spring'), undefined);
  });

  test('Oracle em Competências, com ou sem Database', () => {
    assert.ok(term(cardFor({ Competências: ['Oracle'] }), 'Oracle'));
    assert.ok(term(cardFor({ Competências: ['Oracle Database'] }), 'Oracle'));
  });

  const levels: ReadonlyArray<readonly [string, string, string]> = [
    ['Sênior', 'Sênior', 'Desenvolvedora Sênior'],
    ['Sênior', 'Sênior', 'Analista Sr.'],
    ['Sênior', 'Sênior', 'Senior Developer'],
    ['Pleno', 'Pleno', 'Desenvolvedora Plena'],
    ['Pleno', 'Pleno', 'Desenvolvedor Pleno'],
    ['Júnior', 'Júnior', 'Analista Jr'],
    ['Júnior', 'Júnior', 'Junior Developer'],
  ];
  for (const [label, canonical, title] of levels) {
    test(`nível ${canonical} acha o cargo "${title}"`, () => {
      const level: Requirement = { id: 'n', kind: 'title_word', importance: 'required', label, canonical };
      const card = cardFor({ Experiência: JOB(title, 'jan de 2020 - dez de 2020 · 1 ano') }, [level]);
      assert.equal(computeMatch(card, [level]).results[0]?.status, 'met');
    });
  }

  test('nível só vale no cargo: "sênior" em Sobre não atende a palavra de cargo', () => {
    const level: Requirement = { id: 'n', kind: 'title_word', importance: 'required', label: 'Sênior', canonical: 'Sênior' };
    const card = cardFor({ Sobre: ['Sou sênior.'], Experiência: JOB('Analista', 'jan de 2020 - dez de 2020 · 1 ano') }, [level]);
    assert.equal(computeMatch(card, [level]).results[0]?.status, 'not_found');
  });
});

describe('Linhas rotuladas dentro da experiência', () => {
  for (const line of ['Competências: Go, Rust', 'Tecnologias: Go · Rust', 'Skills: Go, Rust', 'Tech stack: Go e Rust', 'Stack: Go/Rust']) {
    test(line, () => {
      const card = cardFor({ Experiência: JOB('Desenvolvedora', 'jan de 2020 - dez de 2020 · 1 ano', 'Sistemas internos.', line) });
      for (const key of ['Go', 'Rust']) {
        assert.deepEqual(term(card, key)?.sections, ['experience'], key);
        assert.equal(term(card, key)?.months, 12, key);
      }
    });
  }

  test('símbolos na linha rotulada: C#, Node.js', () => {
    const card = cardFor({ Experiência: JOB('Desenvolvedora', 'jan de 2020 - dez de 2020 · 1 ano', 'Tecnologias: C#, Node.js') });
    assert.ok(term(card, 'C#'));
    assert.ok(term(card, 'Node.js'));
  });

  test('rótulo qualquer não designa: "Lema: Go" fica sem contexto', () => {
    const card = cardFor({ Experiência: JOB('Desenvolvedora', 'jan de 2020 - dez de 2020 · 1 ano', 'Lema: Go, time.') });
    assert.equal(term(card, 'Go'), undefined);
  });
});

describe('Todas as seções são lidas', () => {
  const card = cardFor({
    Sobre: ['Trabalho com Python.'],
    Experiência: JOB('Desenvolvedora', 'jan de 2020 - dez de 2020 · 1 ano', 'APIs em Java.'),
    Competências: ['Docker'],
    'Licenças e certificados': ['AWS Certified Solutions Architect', 'Emitido em jan de 2022'],
    Idiomas: ['Inglês', 'Avançado'],
    Projetos: ['Biblioteca em Kotlin.'],
  });

  const cases: ReadonlyArray<readonly [string, CardTerm['sections']]> = [
    ['Python', ['about']],
    ['Java', ['experience']],
    ['Docker', ['skills']],
    ['AWS Certified Solutions Architect', ['certifications']],
    ['Inglês', ['languages']],
    ['Kotlin', ['projects']],
  ];
  for (const [key, sections] of cases) {
    test(`${key} em ${sections.join(', ')}`, () => assert.deepEqual(term(card, key)?.sections, sections));
  }

  test('o mesmo termo em várias seções, na ordem do modelo', () => {
    const both = cardFor({ Projetos: ['Feito em Java.'], Competências: ['Java'], Sobre: ['Uso Java.'] });
    assert.deepEqual(term(both, 'Java')?.sections, ['about', 'skills', 'projects']);
  });

  test('termos da lista entram mesmo sem requisito nenhum', () => {
    assert.ok(card.terms.length >= 6);
    assert.deepEqual(card.searchedFreeTerms, []);
  });

  test('idioma com nível na mesma linha', () => {
    assert.ok(term(cardFor({ Idiomas: ['Inglês · Avançado'] }), 'Inglês'));
    assert.ok(term(cardFor({ Idiomas: ['Inglês - Fluente'] }), 'Inglês'));
    assert.ok(term(cardFor({ Idiomas: ['English'] }), 'Inglês'));
  });
});

describe('Termo livre', () => {
  test('acha a sequência inteira, sem acento e sem diferença de maiúsculas', () => {
    const card = cardFor({ Projetos: ['Atuei com CORE BANKING no atacado.'] }, [free('Core Banking')]);
    assert.deepEqual(term(card, 'core banking')?.sections, ['projects']);
    assert.deepEqual(card.searchedFreeTerms, ['core banking']);
  });

  test('entra em searchedFreeTerms mesmo sem achar', () => {
    const card = cardFor({ Sobre: ['Nada a ver.'] }, [free('Core Banking')]);
    assert.equal(term(card, 'core banking'), undefined);
    assert.deepEqual(card.searchedFreeTerms, ['core banking']);
  });

  test('palavra inteira: "ban" não acha "banking", e a sequência não pode ter buraco', () => {
    const card = cardFor({ Projetos: ['Atuei com core de banking.'] }, [free('ban'), free('core banking')]);
    assert.equal(term(card, 'ban'), undefined);
    assert.equal(term(card, 'core banking'), undefined);
  });

  test('não atravessa o fim da linha', () => {
    const card = cardFor({ Competências: ['core', 'banking'] }, [free('core banking')]);
    assert.equal(term(card, 'core banking'), undefined);
  });

  test('em todas as seções que contam menos Sobre, com tempo só em experiência', () => {
    const card = cardFor(
      {
        Sobre: ['core banking'],
        Experiência: JOB('Desenvolvedora', 'jan de 2020 - dez de 2020 · 1 ano', 'Plataforma de core banking.'),
        Competências: ['Core Banking'],
        'Licenças e certificados': ['Certificado em core banking'],
        Idiomas: ['core banking'],
        Projetos: ['Modelo de core banking.'],
      },
      [free('core banking')],
    );
    assert.deepEqual(term(card, 'core banking'), {
      key: 'core banking',
      sections: ['experience', 'skills', 'certifications', 'languages', 'projects'],
      months: 12,
      jobTitles: ['Desenvolvedor(a)'],
    });
  });

  test('sem canônico é termo livre, mesmo que a palavra exista na lista', () => {
    const card = cardFor({ Projetos: ['Cuidei de go to market.'] }, [free('Go')]);
    assert.deepEqual(card.searchedFreeTerms, ['go']);
    assert.equal(term(card, 'go'), undefined);
  });

  test('canônico fora da lista é procurado como texto', () => {
    const stale: Requirement = { id: 's', kind: 'term', importance: 'required', label: 'Zeta', canonical: 'Zeta Framework' };
    const card = cardFor({ Competências: ['Zeta Framework'] }, [stale]);
    assert.deepEqual(card.searchedFreeTerms, ['zeta framework']);
    assert.equal(computeMatch(card, [stale]).results[0]?.status, 'met');
  });

  test('sem nenhuma palavra não entra na ficha', () => {
    assert.deepEqual(cardFor({ Sobre: ['Nada.'] }, [free('++')]).searchedFreeTerms, []);
  });

  test('idioma e certificado fora da lista também são procurados', () => {
    const klingon: Requirement = { id: 'k', kind: 'language', importance: 'preferred', label: 'Klingon' };
    const card = cardFor({ Idiomas: ['Klingon', 'Básico'] }, [klingon]);
    assert.deepEqual(term(card, 'klingon')?.sections, ['languages']);
  });
});

describe('Palavra de cargo', () => {
  const experience = [
    ...JOB('Desenvolvedora Sênior', 'jan de 2020 - dez de 2021 · 2 anos', 'Mentoria de pessoas plenas.'),
    ...JOB('Analista', 'jan de 2015 - dez de 2015 · 1 ano', 'Trabalho com gente sênior.'),
  ];

  test('procura só nos cargos', () => {
    const card = cardFor({ Sobre: ['Sou diretora.'], Experiência: experience, Competências: ['Diretor'] }, [titleWord('Sênior'), titleWord('Diretor')]);
    assert.deepEqual(term(card, 'title:senior'), { key: 'title:senior', sections: ['experience'], months: 24, jobTitles: ['Desenvolvedor(a) Sênior'] });
    assert.equal(term(card, 'title:diretor'), undefined);
    assert.deepEqual(card.searchedFreeTerms, ['title:diretor', 'title:senior']);
  });

  test('inclui os sinônimos quando é termo da lista', () => {
    const card = cardFor(
      { Experiência: JOB('Líder Técnico do Time', 'jan de 2020 - dez de 2020 · 1 ano') },
      [titleWord('Tech Lead')],
    );
    assert.deepEqual(term(card, 'title:tech lead')?.jobTitles, ['Líder técnico(a)']);
  });

  test('a chave usa o canônico, quando há', () => {
    const lead: Requirement = { id: 'l', kind: 'title_word', importance: 'required', label: 'lider tecnico', canonical: 'Tech Lead' };
    const card = cardFor({ Experiência: JOB('Tech Lead', 'jan de 2020 - dez de 2020 · 1 ano') }, [lead]);
    assert.deepEqual(card.searchedFreeTerms, ['title:tech lead']);
    assert.equal(computeMatch(card, [lead]).results[0]?.status, 'met');
  });

  test('palavra da lista com símbolo não casa com a letra sozinha', () => {
    const card = cardFor({ Experiência: JOB('Analista C', 'jan de 2020 - dez de 2020 · 1 ano') }, [titleWord('C++')]);
    assert.equal(term(card, 'title:c'), undefined);
  });
});

describe('Tempo por termo (RF-43, CA-06)', () => {
  test('união dos períodos, sem contar sobreposição duas vezes', () => {
    const card = cardFor({
      Experiência: [
        ...JOB('Desenvolvedora', 'jan de 2020 - dez de 2021 · 2 anos', 'Sistemas em Java.'),
        ...JOB('Consultora', 'jan de 2021 - dez de 2022 · 2 anos', 'Consultoria em Java.'),
        ...JOB('Analista', 'jan de 2015 - dez de 2015 · 1 ano', 'Sistemas em PHP.'),
      ],
    });
    assert.equal(term(card, 'Java')?.months, 36);
    assert.equal(term(card, 'PHP')?.months, 12);
    assert.equal(card.totalMonths, 48);
  });

  test('experiência atual é medida até a data de referência', () => {
    const card = cardFor({ Experiência: JOB('Desenvolvedora', 'jan de 2024 - o momento · 10 meses', 'Sistemas em Java.') });
    assert.equal(term(card, 'Java')?.months, 10);
  });

  test('atual e antiga juntas, com a referência vindo do leitor', () => {
    const card = buildCard(
      parseProfileText(
        profileText({
          Experiência: [
            ...JOB('Desenvolvedora', 'jan de 2020 - o momento', 'Sistemas em Java.'),
            ...JOB('Analista', 'jan de 2018 - jun de 2020', 'Legados em Java.'),
          ],
        }),
        { year: 2021, month: 1 },
      ),
      [],
    );
    assert.equal(term(card, 'Java')?.months, 37);
  });

  test('fim depois da data de referência é cortado nela', () => {
    const card = buildCard(
      parseProfileText(profileText({ Experiência: JOB('Desenvolvedora', 'jan de 2020 - dez de 2030', 'Sistemas em Java.') }), { year: 2020, month: 6 }),
      [],
    );
    assert.equal(term(card, 'Java')?.months, 6);
  });

  test('nulo se só aparece fora de experiência', () => {
    assert.equal(term(cardFor({ Competências: ['Java'] }), 'Java')?.months, null);
  });

  test('nulo se a experiência não tem período legível', () => {
    const card = cardFor({ Experiência: ['Desenvolvedora', 'Sistemas em Java.'] });
    assert.deepEqual(term(card, 'Java')?.sections, ['experience']);
    assert.equal(term(card, 'Java')?.months, null);
    assert.equal(card.totalMonths, null);
  });

  test('uma legível e outra não: vale a legível', () => {
    const card = cardFor({
      Experiência: [
        ...JOB('Desenvolvedora', 'jan de 2020 - dez de 2020 · 1 ano', 'Sistemas em Java.'),
        ...JOB('Analista', 'jan de 2015 - dez de 2014', 'Legados em Java.'),
      ],
    });
    assert.equal(term(card, 'Java')?.months, 12);
  });
});

describe('Cargos', () => {
  const ordered = [
    ...JOB('Consultora', 'jan de 2018 - dez de 2018 · 1 ano', 'Em Java.'),
    ...JOB('Analista', 'jan de 2014 - dez de 2014 · 1 ano', 'Em Java.'),
    ...JOB('Desenvolvedora', 'jan de 2020 - dez de 2020 · 1 ano', 'Em Java.'),
    ...JOB('Arquiteta de Software', 'jan de 2016 - dez de 2016 · 1 ano', 'Em Java.'),
  ];

  test('até 3, da mais recente para a mais antiga, mesmo fora de ordem no texto', () => {
    assert.deepEqual(term(cardFor({ Experiência: ordered }), 'Java')?.jobTitles, ['Desenvolvedor(a)', 'Consultor(a)', 'Arquiteto(a) de software']);
  });

  test('sem repetição', () => {
    const card = cardFor({
      Experiência: [
        ...JOB('Analista', 'jan de 2020 - dez de 2020 · 1 ano', 'Em Java.'),
        ...JOB('Analista', 'jan de 2015 - dez de 2015 · 1 ano', 'Em Java.'),
      ],
    });
    assert.deepEqual(term(card, 'Java')?.jobTitles, ['Analista']);
  });

  test('cargo vazio não entra', () => {
    const card = buildCard(
      {
        name: null,
        about: '',
        experiences: [{ title: '', span: { start: { year: 2020, month: 1 }, end: null }, months: 10, text: 'Em Java.' }],
        skillsText: '',
        certificationsText: '',
        languagesText: '',
        projectsText: '',
        sectionsRead: ['experience'],
        truncated: false,
        totalMonths: 10,
      },
      [],
    );
    assert.deepEqual(term(card, 'Java')?.jobTitles, []);
    assert.equal(card.currentTitle, null);
  });

  test('currentTitle: a experiência atual, mesmo que outra tenha começado depois', () => {
    const card = cardFor({
      Experiência: [
        ...JOB('Consultora', 'jan de 2023 - fev de 2023'),
        ...JOB('Analista', 'jan de 2020 - o momento'),
      ],
    });
    assert.equal(card.currentTitle, 'Analista');
  });

  test('currentTitle: sem atual, a de início mais recente', () => {
    const card = cardFor({ Experiência: [...JOB('Analista', 'jan de 2010 - dez de 2011'), ...JOB('Consultora', 'jan de 2018 - dez de 2019')] });
    assert.equal(card.currentTitle, 'Consultor(a)');
  });

  test('currentTitle: sem experiência é nulo', () => {
    assert.equal(cardFor({ Competências: ['Java'] }).currentTitle, null);
  });
});

describe('O que mais a ficha guarda', () => {
  test('sinal de leitura cortada e seções lidas, na ordem do modelo', () => {
    const card = cardFor({ Projetos: ['Algo em Java.'], Competências: ['Java', 'Exibir todas as 12 competências'] });
    assert.equal(card.truncated, true);
    assert.deepEqual(card.sectionsRead, ['skills', 'projects']);
  });

  test('perfil vazio não quebra', () => {
    const card = buildCard(parseProfileText('', AS_OF), [listed('Java'), free('x'), titleWord('y'), language('Inglês')]);
    assert.deepEqual(card, {
      totalMonths: null,
      currentTitle: null,
      terms: [],
      searchedFreeTerms: ['title:y', 'x'],
      sectionsRead: [],
      truncated: false,
    });
  });
});

describe('DP-23: cargo na ficha só com palavras da lista', () => {
  const textOf = (...experience: readonly string[]) => cardFor({ Experiência: experience });

  test('a frase pessoal não vira cargo', () => {
    assert.equal(textOf('Tenho 38 anos, sou casada', 'Python no dia a dia.').currentTitle, null);
  });

  test('a empresa não vira cargo, em nenhuma posição', () => {
    for (const lines of [
      ['Acme', 'Engenheira', 'jan de 2020 - o momento', 'Python'],
      ['Engenheira', 'Acme', 'jan de 2020 - o momento', 'Python'],
      ['Engenheira - Acme', 'jan de 2020 - o momento', 'Python'],
      ['Engenheira na Acme', 'jan de 2020 - o momento', 'Python'],
      ['Engenheira at Acme', 'jan de 2020 - o momento', 'Python'],
      ['Engenheira @ Acme', 'jan de 2020 - o momento', 'Python'],
      ['Engenheira, Acme', 'jan de 2020 - o momento', 'Python'],
      ['Engenheira | Acme', 'jan de 2020 - o momento', 'Python'],
    ]) {
      const card = textOf(...lines);
      assert.equal(card.currentTitle, 'Engenheiro(a)', lines.join(' / '));
      assert.deepEqual(term(card, 'Python')?.jobTitles, ['Engenheiro(a)'], lines.join(' / '));
      assert.equal(term(card, 'Python')?.months, 58, lines.join(' / '));
    }
  });

  test('sem cargo da lista, fica vazio, e o tempo do emprego continua valendo', () => {
    const card = textOf('Acme', 'jan de 2020 - o momento', 'Sistemas em Java.');
    assert.equal(card.currentTitle, null);
    assert.deepEqual(term(card, 'Java')?.jobTitles, []);
    assert.equal(term(card, 'Java')?.months, 58);
  });

  test('o gênero da linha não muda o que a ficha guarda', () => {
    const feminine = cardFor({ Experiência: JOB('Engenheira de Dados Plena', 'jan de 2020 - dez de 2020 · 1 ano', 'Pipelines em Python.') });
    const masculine = cardFor({ Experiência: JOB('Engenheiro de Dados Pleno', 'jan de 2020 - dez de 2020 · 1 ano', 'Pipelines em Python.') });
    assert.equal(feminine.currentTitle, 'Engenheiro(a) de dados Pleno');
    assert.deepEqual(feminine, masculine);
  });
});

describe('Palavra de cargo: gênero por regra de sufixo (RD-8)', () => {
  const pairs: ReadonlyArray<readonly [string, string]> = [
    ['Tecnólogo', 'Tecnóloga'], ['Operador', 'Operadora'], ['Assessor', 'Assessora'], ['Tutor', 'Tutora'], ['Monitor', 'Monitora'], ['Revisor', 'Revisora'],
    ['Redator', 'Redatora'], ['Inspetor', 'Inspetora'], ['Vendedor', 'Vendedora'], ['Empreendedor', 'Empreendedora'], ['Facilitador', 'Facilitadora'],
    ['Integrador', 'Integradora'], ['Colaborador', 'Colaboradora'], ['Servidor Público', 'Servidora Pública'], ['Funcionário', 'Funcionária'],
    ['Proprietário', 'Proprietária'], ['Presidente', 'Presidenta'], ['Chefe', 'Chefa'], ['Encarregado', 'Encarregada'], ['Contratado', 'Contratada'],
    ['Autor', 'Autora'], ['Organizador', 'Organizadora'], ['Educador', 'Educadora'], ['Criador', 'Criadora'], ['Executor', 'Executora'], ['Avaliador', 'Avaliadora'],
    ['Mentor', 'Mentora'], ['Pesquisador', 'Pesquisadora'], ['Sócio', 'Sócia'], ['Bacharel', 'Bacharela'], ['Doutor', 'Doutora'], ['Mestre', 'Mestra'],
    ['Auditor', 'Auditora'], ['Testador', 'Testadora'], ['Desenvolvedor Autônomo', 'Desenvolvedora Autônoma'], ['Especializado', 'Especializada'], ['Desenhista', 'Desenhista'],
    ['Gerente de Produto', 'Gerenta de Produto'], ['Capitão', 'Capitã'], ['Patrão', 'Patrona'], ['Enfermeiro', 'Enfermeira'], ['Dono do Produto', 'Dona do Produto'],
    ['Engenheiro de Software', 'Engenheira de Software'], ['Analista Pleno', 'Analista Plena'], ['Líder Técnico', 'Líder Técnica'],
  ];
  for (const [masculine, feminine] of pairs) {
    for (const asked of [masculine, feminine]) {
      for (const written of [masculine, feminine]) {
        test(`pede "${asked}", a linha diz "${written}"`, () => {
          const requirement = titleWord(asked);
          const card = cardFor({ Experiência: JOB(written, 'jan de 2020 - dez de 2020 · 1 ano') }, [requirement]);
          assert.equal(computeMatch(card, [requirement]).results[0]?.status, 'met');
        });
      }
    }
  }

  test('forma neutra na linha também acha', () => {
    for (const written of ['Engenheiro(a) de Software', 'Engenheira(o) de Software', 'Engenheir@ de Software', 'Engenheire de Software']) {
      const requirement = titleWord('Engenheiro');
      const card = cardFor({ Experiência: JOB(written, 'jan de 2020 - dez de 2020 · 1 ano') }, [requirement]);
      assert.equal(computeMatch(card, [requirement]).results[0]?.status, 'met', written);
    }
  });

  test('a regra vale só em palavra de cargo: termo livre continua exato', () => {
    const requirement = free('Banco de dados interno');
    const card = cardFor({ Competências: ['Banca de dados interna'] }, [requirement]);
    assert.equal(term(card, 'banco de dados interno'), undefined);
  });
});

describe('Rótulo não engole termo', () => {
  const credit = (section: string, line: string, requirement: Requirement): number | undefined =>
    computeMatch(cardFor({ [section]: [line] }), [requirement]).results[0]?.credit;

  const cases: ReadonlyArray<readonly [string, string, Requirement]> = [
    ['Competências', 'Python: avançado', listed('Python')],
    ['Competências', 'Java: 5 anos', listed('Java')],
    ['Competências', 'Go: 3 anos', listed('Go')],
    ['Competências', 'Go avançado', listed('Go')],
    ['Competências', 'Docker: containers', listed('Docker')],
    ['Competências', 'Linguagens: Go, Rust', listed('Go')],
    ['Competências', 'Linguagens: Go, Rust', listed('Rust')],
    ['Competências', 'Java, Python: avançado', listed('Java')],
    ['Idiomas', 'Inglês: Fluente', language('Inglês')],
    ['Idiomas', 'Inglês: avançado', language('Inglês')],
    ['Idiomas', 'Inglês - Avançado', language('Inglês')],
    ['Idiomas', 'Inglês (C1)', language('Inglês')],
    ['Idiomas', 'Inglês fluente', language('Inglês')],
    ['Licenças e certificados', 'AWS: Solutions Architect', listed('AWS')],
  ];
  for (const [section, line, requirement] of cases) {
    test(`${section}: "${line}" conta para ${requirement.label}`, () => assert.equal(credit(section, line, requirement), 1));
  }

  test('rótulo que não é termo continua sendo só rótulo', () => {
    const card = cardFor({ Competências: ['Nível: alto'] });
    assert.deepEqual(card.terms, []);
  });
});

describe('DP-25: termo livre não é procurado em Sobre', () => {
  test('só em Sobre: não encontrado', () => {
    const requirement = free('Campinas');
    const card = cardFor({ Sobre: ['Moro em Campinas.'] }, [requirement]);
    assert.equal(term(card, 'campinas'), undefined);
    assert.deepEqual(card.searchedFreeTerms, ['campinas']);
    assert.equal(computeMatch(card, [requirement]).results[0]?.status, 'not_found');
  });

  for (const [section, line] of [['Competências', 'Core Banking'], ['Licenças e certificados', 'Certificado em core banking'], ['Projetos', 'Modelo de core banking.'], ['Idiomas', 'core banking']] as const) {
    test(`em ${section}, é procurado`, () => {
      const card = cardFor({ [section]: [line] }, [free('core banking')]);
      assert.ok(term(card, 'core banking'));
    });
  }

  test('em Experiência, é procurado', () => {
    const card = cardFor({ Experiência: JOB('Analista', 'jan de 2020 - dez de 2020 · 1 ano', 'Plataforma de core banking.') }, [free('core banking')]);
    assert.deepEqual(term(card, 'core banking')?.sections, ['experience']);
  });

  test('termo da lista continua sendo procurado em Sobre', () => {
    const card = cardFor({ Sobre: ['Estudo Kubernetes.'] }, [listed('Kubernetes')]);
    assert.deepEqual(term(card, 'Kubernetes')?.sections, ['about']);
  });

  test('a cidade em Sobre não muda a nota', () => {
    const requirement = free('Campinas');
    const one = computeMatch(cardFor({ Sobre: ['Moro em Campinas.'] }, [requirement]), [requirement]);
    const other = computeMatch(cardFor({ Sobre: ['Moro em Recife.'] }, [requirement]), [requirement]);
    assert.deepEqual(one, other);
  });
});

describe('Termos implícitos: o item que designa o termo também vale para o que ele implica', () => {
  const cases: ReadonlyArray<readonly [string, string]> = [
    ['SQL Server', 'SQL'], ['PostgreSQL', 'SQL'], ['MySQL', 'SQL'], ['ASP.NET', '.NET'], ['Spring Boot', 'Spring'], ['Next.js', 'React'],
  ];
  for (const [item, implied] of cases) {
    test(`${item} em Competências conta para ${implied}`, () => {
      assert.ok(impliedTerms(item).includes(implied), `a tabela de termos implícitos não tem ${item}`);
      const card = cardFor({ Competências: [item] });
      assert.deepEqual(term(card, implied)?.sections, ['skills']);
      assert.equal(computeMatch(card, [listed(implied)]).results[0]?.credit, 1);
    });

    test(`${item} na linha de competências do cargo conta para ${implied}, com o mesmo tempo`, () => {
      const card = cardFor({ Experiência: JOB('Analista', 'jan de 2020 - dez de 2020 · 1 ano', `Tecnologias: ${item}, Docker`) });
      assert.equal(term(card, implied)?.months, 12);
    });
  }

  test('o implícito não vale ao contrário', () => {
    assert.equal(term(cardFor({ Competências: ['SQL'] }), 'PostgreSQL'), undefined);
    assert.equal(term(cardFor({ Competências: ['.NET'] }), 'ASP.NET'), undefined);
  });
});

describe('UF em texto corrido e em lista não vira termo', () => {
  const go = [listed('Go')];
  const score = (sections: Readonly<Record<string, readonly string[]>>): number => computeMatch(cardFor(sections), go).score;

  test('linha de local depois do período', () => {
    assert.equal(score({ Experiência: JOB('Analista', 'jan de 2020 - dez de 2021', 'Goiânia, GO', 'Java no dia a dia.') }), 0);
  });

  test('"GO" solto depois do período', () => {
    assert.equal(score({ Experiência: JOB('Analista', 'jan de 2020 - dez de 2021', 'GO', 'Java no dia a dia.') }), 0);
  });

  test('dentro de uma frase', () => {
    assert.equal(score({ Experiência: JOB('Analista', 'jan de 2020 - dez de 2021', 'Trabalhei em Goiânia, GO, com Java.') }), 0);
    assert.equal(score({ Sobre: ['Moro em Goiânia/GO e uso Python.'] }), 0);
    assert.equal(score({ Projetos: ['Sistema da prefeitura de Goiânia - GO em Java.'] }), 0);
  });

  test('stack continua contando', () => {
    assert.equal(score({ Competências: ['Java, Go'] }), 100);
    assert.equal(score({ Experiência: JOB('Analista', 'jan de 2020 - dez de 2021', 'Tecnologias: Go, Rust') }), 100);
    assert.equal(score({ Experiência: JOB('Analista', 'jan de 2020 - dez de 2021', 'Desenvolvimento em Go.') }), 100);
  });
});

describe('Texto bem curto', () => {
  for (const name of ['C#', 'F#', 'C++', '.NET']) {
    test(`"${name}" sozinho em Projetos conta como citado`, () => {
      const result = computeMatch(cardFor({ Projetos: [name] }), [listed(name)]).results[0];
      assert.equal(result?.credit, 0.5);
      assert.equal(result?.note, 'mentioned_only');
    });

    test(`"${name}" sozinho em Sobre conta como citado`, () => {
      assert.equal(computeMatch(cardFor({ Sobre: [name] }), [listed(name)]).results[0]?.credit, 0.5);
    });
  }
});
