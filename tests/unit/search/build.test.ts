// CA-03: textos de busca exatos (RF-20, RF-21, DP-30).
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { TOPIC_REASONS } from '../../../src/core/guard/index.ts';
import { makeRequirement } from '../../../src/core/job/requirements.ts';
import { OPERATOR_LIMITS, buildSearch, peopleSearchUrl } from '../../../src/core/search/build.ts';
import type { Importance, Requirement, RequirementKind } from '../../../src/core/model.ts';

function req(label: string, canonical?: string, kind: RequirementKind = 'term', importance: Importance = 'required'): Requirement {
  return { id: label, kind, importance, label, ...(canonical === undefined ? {} : { canonical }) };
}

const term = (name: string): Requirement => req(name, name);

function fullOf(requirements: readonly Requirement[], excludedTerms: readonly string[] = []) {
  return buildSearch({ requirements, excludedTerms }).full;
}

function shortOf(requirements: readonly Requirement[], excludedTerms: readonly string[] = []) {
  return buildSearch({ requirements, excludedTerms }).short;
}

describe('CA-03: lista completa, nas duas versões', () => {
  const requirements: readonly Requirement[] = [
    term('Java'),
    term('Kubernetes'),
    term('C++'),
    term('C#'),
    term('.NET'),
    term('Machine Learning'),
    req('Core Banking'),
    { id: 'total', kind: 'total_experience', importance: 'required', label: 'Experiência total', minYears: 5 },
    req('Inglês', 'Inglês', 'language'),
    req('AWS Solutions Architect', 'AWS Certified Solutions Architect', 'certification'),
    req('Sênior', undefined, 'title_word'),
    req('AWS', 'AWS', 'term', 'preferred'),
    req('Espanhol', 'Espanhol', 'language', 'preferred'),
  ];
  const excluded = ['PHP', 'Estagiário "junior"'];

  test('completa', () => {
    const { text, operators } = fullOf(requirements, excluded);
    assert.equal(
      text,
      '"Java" AND "Kubernetes" AND "C++" AND "C#" AND ".NET" AND "Machine Learning" AND "Core Banking" AND "Inglês"'
        + ' AND "AWS Certified Solutions Architect" AND "Sênior" NOT "PHP" NOT "Estagiário junior"',
    );
    // 9 AND, 2 NOT.
    assert.equal(operators, 11);
  });

  test('curta: 3 obrigatórios de kind term, sem excluídos', () => {
    assert.deepEqual(shortOf(requirements, excluded), { text: '"Java" AND "Kubernetes" AND "C++"', operators: 2 });
  });

  test('DP-30: a forma que trouxe resultados no teste real', () => {
    const net = [term('C#'), term('.NET'), term('ASP.NET'), term('SQL Server'), term('Git')];
    assert.deepEqual(fullOf(net), { text: '"C#" AND ".NET" AND "ASP.NET" AND "SQL Server" AND "Git"', operators: 4 });
    assert.deepEqual(shortOf(net), { text: '"C#" AND ".NET" AND "ASP.NET"', operators: 2 });
  });
});

describe('Cada termo difícil, sozinho', () => {
  const cases: ReadonlyArray<readonly [string, Requirement, string, number]> = [
    ['C++', term('C++'), '"C++"', 0],
    ['C#', term('C#'), '"C#"', 0],
    ['.NET', term('.NET'), '".NET"', 0],
    ['C', term('C'), '"C"', 0],
    ['Go', term('Go'), '"Go"', 0],
    ['R', term('R'), '"R"', 0],
    ['Node.js', term('Node.js'), '"Node.js"', 0],
    ['duas palavras', term('Spring Boot'), '"Spring Boot"', 0],
    ['nível', req('Júnior', 'Júnior', 'title_word'), '"Júnior"', 0],
    ['termo livre, como escrito', req('Open Finance'), '"Open Finance"', 0],
    ['termo livre de duas palavras com acento', req('Meios de Pagamento à Vista'), '"Meios de Pagamento à Vista"', 0],
    ['exame com número', term('Microsoft Azure Fundamentals'), '"Microsoft Azure Fundamentals"', 0],
  ];

  for (const [name, requirement, text, operators] of cases) {
    test(name, () => assert.deepEqual(fullOf([requirement]), { text, operators }));
  }
});

describe('RF-20: quem entra', () => {
  test('desejáveis não entram', () => {
    assert.deepEqual(fullOf([req('AWS', 'AWS', 'term', 'preferred')]), { text: '', operators: 0 });
  });

  test('experiência total não vira texto', () => {
    const total: Requirement = { id: 't', kind: 'total_experience', importance: 'required', label: 'Experiência total', minYears: 3 };
    assert.deepEqual(fullOf([total, term('Lua')]), { text: '"Lua"', operators: 0 });
    assert.deepEqual(shortOf([total, term('Rust')]), { text: '"Rust"', operators: 0 });
  });

  test('idioma, certificado e palavra de cargo entram por AND', () => {
    const { text } = fullOf([req('Alemão', 'Alemão', 'language'), req('Líder', undefined, 'title_word')]);
    assert.equal(text, '"Alemão" AND "Líder"');
  });

  test('o mesmo termo duas vezes entra uma só, e "C" não se confunde com "C++"', () => {
    assert.equal(fullOf([term('Lua'), req('lua', 'Lua')]).text, '"Lua"');
    assert.equal(fullOf([term('C'), term('C++')]).text, '"C" AND "C++"');
  });

  test('aspas dentro do termo saem, retas ou curvas', () => {
    assert.equal(fullOf([req('Core "Banking"')]).text, '"Core Banking"');
    assert.equal(fullOf([req('Core “Banking”')]).text, '"Core Banking"');
    assert.equal(fullOf([term('Lua')], ['ser"vi"ço']).text, '"Lua" NOT "serviço"');
  });

  test('termo que só tem aspas não entra', () => {
    assert.deepEqual(fullOf([req('"""')], ['""']), { text: '', operators: 0 });
  });

  test('palavra de operador dentro do termo fica entre aspas e não é contada', () => {
    assert.deepEqual(fullOf([req('Pesquisa AND Desenvolvimento'), req('Rock OR Roll')]), {
      text: '"Pesquisa AND Desenvolvimento" AND "Rock OR Roll"',
      operators: 1,
    });
  });

  test('só excluídos: sem termo positivo o texto fica vazio, porque NOT sozinho pode falhar no LinkedIn', () => {
    assert.deepEqual(fullOf([], ['PHP', 'php', 'Delphi']), { text: '', operators: 0 });
    assert.deepEqual(fullOf([req('AWS', 'AWS', 'term', 'preferred')], ['PHP']), { text: '', operators: 0 });
    assert.deepEqual(shortOf([], ['PHP']), { text: '', operators: 0 });
  });

  test('o excluído repetido entra uma vez só', () => {
    assert.deepEqual(fullOf([term('Lua')], ['PHP', 'php', 'Delphi']), { text: '"Lua" NOT "PHP" NOT "Delphi"', operators: 2 });
  });

  test('lista vazia', () => {
    assert.deepEqual(buildSearch({ requirements: [], excludedTerms: [] }), {
      full: { text: '', operators: 0 },
      short: { text: '', operators: 0 },
      refusedExcluded: [],
      refusedRequirements: [],
    });
  });
});

describe('RF-21: versão curta', () => {
  test('até 3, na ordem da vaga', () => {
    const short = shortOf([term('Rust'), term('Go'), term('Java'), term('Python')]);
    assert.deepEqual(short, { text: '"Rust" AND "Go" AND "Java"', operators: 2 });
  });

  test('só os de kind term, quando há algum', () => {
    const short = shortOf([req('Inglês', 'Inglês', 'language'), term('Rust'), req('Sênior', undefined, 'title_word')]);
    assert.deepEqual(short, { text: '"Rust"', operators: 0 });
  });

  test('sem term, usa os outros obrigatórios, até 3', () => {
    const short = shortOf([
      req('Inglês', 'Inglês', 'language'),
      req('Sênior', undefined, 'title_word'),
      req('AWS Solutions Architect', 'AWS Certified Solutions Architect', 'certification'),
      req('Espanhol', 'Espanhol', 'language'),
    ]);
    assert.deepEqual(short, { text: '"Inglês" AND "Sênior" AND "AWS Certified Solutions Architect"', operators: 2 });
  });

  test('desejável não entra nem na falta de obrigatório', () => {
    assert.deepEqual(shortOf([req('Rust', 'Rust', 'term', 'preferred')]), { text: '', operators: 0 });
  });
});

describe('RF-13: a trava vale para o que entra na busca', () => {
  test('termo excluído proibido sai do texto e volta com o motivo', () => {
    const built = buildSearch({ requirements: [term('Java')], excludedTerms: ['mulheres', 'PHP', 'idade', 'PCD', 'mãe', 'Campinas'] });
    assert.deepEqual(built.full, { text: '"Java" NOT "PHP"', operators: 1 });
    assert.deepEqual(built.refusedExcluded, [
      { term: 'mulheres', code: 'forbidden', topic: 'gender', reason: TOPIC_REASONS.gender },
      { term: 'idade', code: 'forbidden', topic: 'age', reason: TOPIC_REASONS.age },
      { term: 'PCD', code: 'forbidden', topic: 'disability_health', reason: TOPIC_REASONS.disability_health },
      { term: 'mãe', code: 'forbidden', topic: 'marital_family', reason: TOPIC_REASONS.marital_family },
      { term: 'Campinas', code: 'forbidden', topic: 'address_distance', reason: TOPIC_REASONS.address_distance },
    ]);
  });

  test('excluído proibido é avisado mesmo sem termo positivo', () => {
    const built = buildSearch({ requirements: [], excludedTerms: ['mulheres'] });
    assert.deepEqual(built.full, { text: '', operators: 0 });
    assert.deepEqual(built.refusedExcluded.map((item) => item.code), ['forbidden']);
  });

  test('requisito proibido guardado de antes não sai no texto, em nenhuma versão', () => {
    const stored: Requirement[] = [req('Mulheres'), req('Até 35 anos'), term('Java'), req('Sem filhos', undefined, 'title_word'), req('Campinas', undefined, 'language')];
    const built = buildSearch({ requirements: stored, excludedTerms: [] });
    assert.deepEqual(built.full, { text: '"Java"', operators: 0 });
    assert.deepEqual(built.short, { text: '"Java"', operators: 0 });
    assert.deepEqual(built.refusedRequirements.map((item) => [item.term, item.topic]), [['Mulheres', 'gender'], ['Até 35 anos', 'age'], ['Sem filhos', 'marital_family'], ['Campinas', 'address_distance']]);
  });

  test('só requisito proibido: nada sai', () => {
    assert.deepEqual(fullOf([req('Mulheres')], ['PHP']), { text: '', operators: 0 });
  });

  test('termo longo demais não entra, e o motivo diz por quê', () => {
    const long = 'a '.repeat(300);
    const built = buildSearch({ requirements: [term('Java'), req(long)], excludedTerms: [long] });
    assert.deepEqual(built.full, { text: '"Java"', operators: 0 });
    assert.deepEqual(built.refusedExcluded.map((item) => item.code), ['too_long']);
    assert.deepEqual(built.refusedRequirements.map((item) => item.code), ['too_long']);
    assert.ok((built.refusedExcluded[0]?.term.length ?? 0) <= 200);
  });
});

describe('excluído igual a um termo procurado', () => {
  test('"Java" NOT "Java" não sai, e a resposta diz isso', () => {
    const built = buildSearch({ requirements: [term('Java')], excludedTerms: ['Java', 'java', 'JAVA'] });
    assert.deepEqual(built.full, { text: '"Java"', operators: 0 });
    assert.equal(built.refusedExcluded.length, 1);
    assert.equal(built.refusedExcluded[0]?.code, 'same_as_required');
    assert.match(built.refusedExcluded[0]?.reason ?? '', /também está/u);
  });

  test('sinônimo do termo procurado também conta', () => {
    assert.deepEqual(fullOf([term('Go')], ['Golang', 'PHP']), { text: '"Go" NOT "PHP"', operators: 1 });
    assert.deepEqual(fullOf([term('JavaScript')], ['JS']), { text: '"JavaScript"', operators: 0 });
    assert.deepEqual(fullOf([term('Python')], ['Python 3']), { text: '"Python"', operators: 0 });
  });

  test('a outra forma de gênero do cargo também conta', () => {
    const built = buildSearch({ requirements: [req('Engenheiro de dados', 'Engenheiro de dados', 'title_word')], excludedTerms: ['Engenheira de dados'] });
    assert.deepEqual(built.refusedExcluded.map((item) => item.code), ['same_as_required']);
  });

  test('"C" procurado não barra "C++" excluído', () => {
    assert.deepEqual(fullOf([term('C')], ['C++']), { text: '"C" NOT "C++"', operators: 1 });
  });

  test('o termo que não entra no texto não conta como procurado', () => {
    assert.deepEqual(fullOf([term('Lua'), req('Java', 'Java', 'term', 'preferred')], ['Java']), { text: '"Lua" NOT "Java"', operators: 1 });
  });
});

describe('RD-8: cargo sai nas duas formas de gênero', () => {
  const role = (label: string): Requirement => {
    const made = makeRequirement({ kind: 'title_word', label, importance: 'required' });
    if (!made.ok) throw new Error(label);
    return made.requirement;
  };

  test('"Engenheira de dados" traz as duas formas e conta os operadores', () => {
    assert.deepEqual(fullOf([role('Engenheira de dados')]), { text: '("Engenheiro de dados" OR "Engenheira de dados")', operators: 1 });
    assert.deepEqual(fullOf([role('Engenheiro de dados')]), { text: '("Engenheiro de dados" OR "Engenheira de dados")', operators: 1 });
  });

  test('na versão curta, as duas formas ficam', () => {
    assert.deepEqual(shortOf([role('Engenheira de dados')]), { text: '("Engenheiro de dados" OR "Engenheira de dados")', operators: 1 });
    assert.deepEqual(shortOf([role('Arquiteto de software'), role('Sênior')]), { text: '("Arquiteto de software" OR "Arquiteta de software") AND "Sênior"', operators: 2 });
  });

  const cases: ReadonlyArray<readonly [string, string, string]> = [
    ['Desenvolvedor back-end', 'Desenvolvedor back-end', 'Desenvolvedora back-end'],
    ['Desenvolvedora front-end', 'Desenvolvedor front-end', 'Desenvolvedora front-end'],
    ['Administrador de sistemas', 'Administrador de sistemas', 'Administradora de sistemas'],
    ['Estagiária de software', 'Estagiário de software', 'Estagiária de software'],
    ['Pleno', 'Pleno', 'Plena'],
  ];
  for (const [label, masculine, feminine] of cases) {
    test(`${label}: as duas formas, com o acento certo`, () => {
      assert.deepEqual(shortOf([role(label)]), { text: `("${masculine}" OR "${feminine}")`, operators: 1 });
    });
  }

  test('palavra de cargo fora da lista também, escrita em qualquer das formas', () => {
    assert.deepEqual(fullOf([req('Engenheira de Plataforma', undefined, 'title_word')]), { text: '("Engenheiro de Plataforma" OR "Engenheira de Plataforma")', operators: 1 });
    assert.deepEqual(fullOf([req('Coordenador técnico', undefined, 'title_word')]), { text: '("Coordenador técnico" OR "Coordenadora técnica")', operators: 1 });
    assert.deepEqual(fullOf([req('Fundadora')]), { text: '("Fundador" OR "Fundadora")', operators: 1 });
  });

  test('as duas formas contam como o mesmo requisito', () => {
    assert.deepEqual(fullOf([req('Engenheira de Plataforma', undefined, 'title_word'), req('Engenheiro de Plataforma', undefined, 'title_word')]), { text: '("Engenheiro de Plataforma" OR "Engenheira de Plataforma")', operators: 1 });
  });

  test('cargo que não muda fica como está', () => {
    for (const [label, text] of [['Sênior', '"Sênior"'], ['Tech Lead', '"Tech Lead"'], ['Líder', '"Líder"'], ['Analista de dados', '"Analista de dados"'], ['Gerente', '"Gerente"']] as const) {
      assert.equal(fullOf([req(label, label === 'Líder' || label === 'Gerente' ? undefined : label, 'title_word')]).text, text);
    }
  });

  test('termo de tecnologia não ganha feminino', () => {
    assert.deepEqual(fullOf([req('Suporte técnico')]), { text: '"Suporte técnico"', operators: 0 });
    assert.deepEqual(fullOf([term('Java')]), { text: '"Java"', operators: 0 });
  });
});

describe('o texto de busca é sempre texto válido', () => {
  test('caractere substituto solto sai do texto, nas duas versões', () => {
    const built = buildSearch({ requirements: [req('Plataforma\uD83D')], excludedTerms: ['PHP\uDE00'] });
    assert.equal(built.full.text, '"Plataforma" NOT "PHP"');
    assert.equal(built.short.text, '"Plataforma"');
    assert.doesNotThrow(() => peopleSearchUrl(built.full.text));
  });

  test('emoji inteiro continua', () => {
    assert.equal(fullOf([req('Plataforma \u{1F680}')]).text, '"Plataforma \u{1F680}"');
  });

  test('todas as aspas duplas, contrabarra e caractere de controle saem', () => {
    assert.equal(fullOf([req('Java ＂core＂')], ['〝PHP〞']).text, '"Java core" NOT "PHP"');
    assert.equal(fullOf([req('Java\\')], ['C:\\"x']).text, '"Java" NOT "C:x"');
    assert.equal(fullOf([req('Java\u0000\u0007')]).text, '"Java"');
    assert.equal(fullOf([req('Java\nPython')]).text, '"Java Python"');
  });

  test('entrada de tipo errado não lança erro', () => {
    for (const value of [undefined, null, 0, {}, [], true]) {
      assert.deepEqual(buildSearch({ requirements: [], excludedTerms: [value as unknown as string] }).full, { text: '', operators: 0 });
      assert.deepEqual(buildSearch({ requirements: [{ id: 'x', kind: 'term', importance: 'required', label: value as unknown as string }], excludedTerms: [] }).full, { text: '', operators: 0 });
      assert.deepEqual(buildSearch({ requirements: value as unknown as Requirement[], excludedTerms: value as unknown as string[] }).full, { text: '', operators: 0 });
      assert.equal(peopleSearchUrl(value as unknown as string), 'https://www.linkedin.com/search/results/people/?keywords=');
    }
    assert.deepEqual(buildSearch(undefined as unknown as { requirements: Requirement[]; excludedTerms: string[] }).full, { text: '', operators: 0 });
  });
});

describe('peopleSearchUrl', () => {
  test('monta o endereço da busca de pessoas, com o texto codificado', () => {
    const { text } = fullOf([term('C#'), term('C++')], ['PHP']);
    const url = peopleSearchUrl(text);
    assert.ok(url.startsWith('https://www.linkedin.com/search/results/people/?keywords='));
    assert.equal(decodeURIComponent(url.split('keywords=')[1] ?? ''), text);
    assert.ok(!/[ "#+]/u.test(url.split('keywords=')[1] ?? ''), url);
  });

  test('caractere substituto solto não lança URIError', () => {
    for (const text of ['\uD800', '"Java" NOT "\uDC00"', '\uD83D', 'a\uDE00b']) {
      assert.doesNotThrow(() => peopleSearchUrl(text), text);
    }
    assert.equal(peopleSearchUrl('a\uD800b'), 'https://www.linkedin.com/search/results/people/?keywords=ab');
    assert.equal(peopleSearchUrl('\u{1F680}'), 'https://www.linkedin.com/search/results/people/?keywords=%F0%9F%9A%80');
  });

  test('o caso exato', () => {
    assert.equal(peopleSearchUrl('"C#" AND "Go"'), 'https://www.linkedin.com/search/results/people/?keywords=%22C%23%22%20AND%20%22Go%22');
  });
});

describe('as buscas dos testes reais (DP-26, DP-30)', () => {
  const built = (names: readonly string[]) => buildSearch({ requirements: names.map(term), excludedTerms: [] });

  test('6 obrigatórios: a completa, que usava 16 operadores, agora usa 5, e a curta é o texto que trouxe resultados', () => {
    const search = built(['C#', '.NET', 'ASP.NET', 'Entity Framework', 'SQL Server', 'Git']);
    assert.equal(search.full.operators, 5);
    assert.equal(search.short.text, '"C#" AND ".NET" AND "ASP.NET"');
    assert.equal(search.short.operators, 2);
  });

  test('4 obrigatórios: a completa, que usava 11 operadores, agora usa 3, e a curta não muda', () => {
    const search = built(['C#', '.NET', 'ASP.NET', 'Git']);
    assert.equal(search.full.operators, 3);
    assert.equal(search.short.text, '"C#" AND ".NET" AND "ASP.NET"');
  });
});

describe('OPERATOR_LIMITS', () => {
  test('os limites conhecidos por plano', () => {
    assert.deepEqual(OPERATOR_LIMITS, { free: null, salesNavigator: 15, recruiter: null });
  });
});
