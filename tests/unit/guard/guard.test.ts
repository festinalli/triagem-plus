import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { checkTerm, findForbidden, TOPIC_REASONS } from '../../../src/core/guard/index.ts';
import type { ForbiddenTopic } from '../../../src/core/guard/index.ts';

function topicOf(text: string): ForbiddenTopic | null {
  const result = checkTerm(text);
  return result.allowed ? null : result.topic;
}

function topicsIn(text: string): ForbiddenTopic[] {
  return findForbidden(text).map((hit) => hit.topic);
}

const CAPITALS = [
  'Rio Branco', 'Maceió', 'Macapá', 'Manaus', 'Salvador', 'Fortaleza', 'Brasília', 'Vitória', 'Goiânia', 'São Luís', 'Cuiabá', 'Campo Grande', 'Belo Horizonte', 'Belém',
  'João Pessoa', 'Curitiba', 'Recife', 'Teresina', 'Rio de Janeiro', 'Natal', 'Porto Alegre', 'Porto Velho', 'Boa Vista', 'Florianópolis', 'São Paulo', 'Aracaju', 'Palmas',
];

describe('CA-02', () => {
  test('recusa os termos do critério de aceite', () => {
    const expected: readonly (readonly [string, ForbiddenTopic])[] = [
      ['Até 35 anos', 'age'],
      ['boa aparência', 'appearance'],
      ['mulheres', 'gender'],
      ['solteiro', 'marital_family'],
      ['PCD', 'disability_health'],
      ['mora perto', 'address_distance'],
      ['no máximo 5 anos', 'max_experience'],
    ];
    for (const [text, topic] of expected) {
      assert.equal(topicOf(text), topic, text);
      assert.deepEqual(topicsIn(text), [topic], text);
    }
  });

  test('deixa passar os termos do critério de aceite', () => {
    for (const text of ['Qualidade de software', 'Java', 'core banking', 'C++']) {
      assert.deepEqual(checkTerm(text), { allowed: true }, text);
      assert.deepEqual(findForbidden(text), [], text);
    }
  });
});

describe('forma do resultado', () => {
  test('checkTerm recusa com assunto, trecho normalizado e motivo', () => {
    assert.deepEqual(checkTerm('Até 35 anos'), { allowed: false, topic: 'age', matched: 'ate 35 anos', reason: TOPIC_REASONS.age });
  });

  test('findForbidden lista na ordem de leitura, sem repetir o mesmo trecho', () => {
    assert.deepEqual(findForbidden('Mulheres até 35 anos\nmulheres solteiras até 35 anos'), [
      { topic: 'gender', matched: 'mulheres', reason: TOPIC_REASONS.gender },
      { topic: 'age', matched: 'ate 35 anos', reason: TOPIC_REASONS.age },
      { topic: 'marital_family', matched: 'solteiras', reason: TOPIC_REASONS.marital_family },
    ]);
  });

  test('"até 35 anos de idade" é um achado só', () => {
    assert.deepEqual(topicsIn('até 35 anos de idade'), ['age']);
  });

  test('texto vazio, só pontuação ou sem ser texto não recusa nem lança erro', () => {
    for (const text of ['', '   ', '...', '---', '\n\n']) {
      assert.deepEqual(checkTerm(text), { allowed: true });
      assert.deepEqual(findForbidden(text), []);
    }
    assert.deepEqual(checkTerm(undefined as unknown as string), { allowed: true });
    assert.deepEqual(findForbidden(null as unknown as string), []);
  });
});

describe('motivo em português simples', () => {
  test('endereço indica o filtro de local do próprio LinkedIn', () => {
    const result = checkTerm('zona sul');
    assert.equal(result.allowed, false);
    if (!result.allowed) assert.match(result.reason, /filtro de local do próprio LinkedIn/u);
  });

  test('deficiência explica que vaga afirmativa é tratada fora da ferramenta (DP-07)', () => {
    const result = checkTerm('PCD');
    assert.equal(result.allowed, false);
    if (!result.allowed) {
      assert.match(result.reason, /afirmativa/u);
      assert.match(result.reason, /fora da ferramenta/u);
    }
  });

  test('teto de experiência explica que funciona como filtro de idade (RF-14)', () => {
    assert.match(TOPIC_REASONS.max_experience, /filtro de idade/u);
    assert.match(TOPIC_REASONS.max_experience, /mínimo/u);
  });
});

describe('idade ou teto de experiência', () => {
  const cases: readonly (readonly [string, ForbiddenTopic])[] = [
    ['até 35 anos', 'age'],
    ['até 5 anos de experiência', 'max_experience'],
    ['até 5 anos', 'max_experience'],
    ['até 15 anos', 'max_experience'],
    ['até 16 anos', 'age'],
    ['até 20 anos de experiência', 'max_experience'],
    ['no máximo 5 anos', 'max_experience'],
    ['no máximo 35 anos', 'age'],
    ['no máximo 35 anos de idade', 'age'],
    ['35 anos no máximo', 'age'],
    ['máximo de 5 anos de experiência', 'max_experience'],
    ['menos de 3 anos de experiência', 'max_experience'],
    ['menos de 30 anos', 'age'],
    ['entre 25 e 35 anos', 'age'],
    ['entre 3 e 5 anos', 'max_experience'],
    ['entre 3 e 5 anos de experiência', 'max_experience'],
    ['at most 5 years', 'max_experience'],
    ['at most 35 years', 'age'],
    ['up to 5 years of experience', 'max_experience'],
    ['up to 35 years', 'age'],
    ['under 35', 'age'],
    ['under 5 years', 'max_experience'],
    ['até 5 anos de idade', 'age'],
    ['dos 25 aos 35 anos', 'age'],
    ['entre 5 anos e 10 anos', 'max_experience'],
    ['Programa de trainee para até 28 anos', 'age'],
    ['Programa trainee até 28 anos', 'age'],
    ['Engenheiro de dados até 35 anos', 'age'],
    ['Analista de sistemas com até 30 anos', 'age'],
    ['Data engineer up to 35 years', 'age'],
    ['mínimo de 1 ano e máxima de 3 anos', 'max_experience'],
  ];
  for (const [text, topic] of cases) {
    test(text, () => {
      assert.equal(topicOf(text), topic);
      assert.ok(topicsIn(`Requisito da vaga: ${text}.`).includes(topic));
    });
  }
});

describe('número sem "anos" não dispara', () => {
  for (const text of ['35', '5', 'até 35', 'até 5', 'entre 25 e 35', 'no máximo 5', 'máximo de 5', 'menos de 3', 'up to 5', 'at most 5', 'mais de 35', 'Até 35 tabelas', 'No máximo 5 sprints', 'menor de 30 segundos', 'menor de 30 ms', 'under 30 ms', 'under 50 kb', 'over 30 clients', 'até 35 horas semanais', 'Menos de 3 meses']) {
    test(text, () => {
      assert.deepEqual(checkTerm(text), { allowed: true });
      assert.deepEqual(findForbidden(text), []);
    });
  }
});

describe('mínimo de experiência passa (DP-04)', () => {
  for (const text of ['pelo menos 5 anos', 'no mínimo 5 anos', 'mínimo de 5 anos', 'mais de 5 anos', '5+ anos', '5 anos', 'ao menos 3 anos', 'não menos de 5 anos', 'at least 5 years', 'no less than 5 years', 'not less than 5 years', '5+ years', '5 anos de experiência', '5+ years of experience', 'mínimo de 5 anos de experiência', '20 anos de experiência', 'mais de 20 anos de experiência', 'Pelo menos 3 anos de Java', 'Java (5+ anos)']) {
    test(text, () => {
      assert.deepEqual(checkTerm(text), { allowed: true });
      assert.deepEqual(findForbidden(text), []);
    });
  }
});

describe('uma linha não contamina a outra', () => {
  test('expressão não atravessa a quebra de linha', () => {
    assert.deepEqual(findForbidden('Até\n35 anos'), []);
    assert.deepEqual(findForbidden('boa\naparência'), []);
    assert.deepEqual(findForbidden('mora\r\nperto'), []);
  });

  test('o contexto da linha de cima não muda a de baixo', () => {
    assert.deepEqual(topicsIn('Contrato CLT\nAté 35 anos'), ['age']);
    assert.deepEqual(topicsIn('Experiência em Java\nAté 35 anos'), ['age']);
    assert.deepEqual(topicsIn('under 35\nPython'), ['age']);
    assert.deepEqual(topicsIn('Java\r\nmulheres\rPython'), ['gender']);
  });
});

describe('prazo que não fala de quem se candidata', () => {
  for (const text of ['Contrato de até 2 anos', 'Projeto de no máximo 2 anos', 'Projetos de até 2 anos', 'Retenção de logs por até 5 anos', 'Promoção em até 2 anos', 'Empresa fundada há menos de 5 anos', 'Auxílio-creche para filhos de até 5 anos', 'Até 2 anos de carência no plano', 'Contract of up to 2 years', 'Startup com menos de 5 anos', 'Sistemas com mais de 10 anos', 'Somos uma empresa com mais de 30 anos']) {
    test(text, () => assert.deepEqual(findForbidden(text), []));
  }
});

describe('endereço e local', () => {
  test('cada capital é recusada em checkTerm e não dispara solta em findForbidden', () => {
    assert.equal(CAPITALS.length, 27);
    for (const city of CAPITALS) {
      assert.equal(topicOf(city), 'address_distance', city);
      assert.equal(topicOf(city.toUpperCase()), 'address_distance', city);
      assert.equal(topicOf(`Em ${city}`), 'address_distance', city);
      assert.deepEqual(findForbidden(city), [], city);
      assert.deepEqual(findForbidden(`Nossa sede fica em ${city}, com escritório próximo ao metrô.`), [], city);
    }
  });

  test('o texto da vaga pode citar o local sem isso virar critério', () => {
    for (const text of ['Sede em São Paulo', 'Escritório na zona sul de São Paulo', 'Escritório próximo ao metrô', 'Av. Paulista, 1000, CEP 01310-100', 'Bairro Pinheiros', 'Híbrido em Curitiba', 'Presencial em São Paulo', 'Office in Recife']) {
      assert.deepEqual(findForbidden(text), [], text);
    }
  });

  test('o que dá ordem sobre onde morar dispara também em frase', () => {
    for (const text of ['É preciso residir em São Paulo', 'Morar em Curitiba', 'More perto do escritório', 'Mora perto da empresa', 'Preferência para quem reside em Santos', 'Candidatos que residam em Recife', 'Moradores da zona sul', 'Até 10 km do escritório', 'Must live in Recife', 'Comprovante de residência']) {
      assert.deepEqual(topicsIn(text), ['address_distance'], text);
    }
  });

  test('remoto, híbrido e presencial não são proibidos', () => {
    for (const text of ['Remoto', 'remota', 'Híbrido', 'hibrida', 'Presencial', 'presencial', 'Remote', 'Hybrid', 'On-site', 'Trabalho remoto', 'Vaga híbrida', 'Vaga presencial']) {
      assert.deepEqual(checkTerm(text), { allowed: true }, text);
      assert.deepEqual(findForbidden(text), [], text);
    }
  });
});

describe('pontuação colada não abre brecha', () => {
  const cases: readonly (readonly [string, ForbiddenTopic])[] = [
    ['Java,mulheres', 'gender'],
    ['Java;mulheres;Python', 'gender'],
    ['Java(mulheres)', 'gender'],
    ['(mulheres)Java', 'gender'],
    ['Vaga.Mulheres', 'gender'],
    ["women's", 'gender'],
    ['idade:30', 'age'],
    ['idade=30', 'age'],
    ['Java,até 35 anos', 'age'],
    ['Até 35anos', 'age'],
    ['P.C.D.', 'disability_health'],
    ['L.G.B.T.', 'orientation'],
    ['U.S. citizens', 'nationality_origin'],
    ['mu\u200Blheres', 'gender'],
    ['mulhe\u0301res', 'gender'],
    ['boa-aparência', 'appearance'],
    ['estado_civil', 'marital_family'],
  ];
  for (const [text, topic] of cases) {
    test(text, () => {
      assert.equal(topicOf(text), topic);
      assert.ok(topicsIn(text).includes(topic));
    });
  }

  test('a separação não estraga o que depende da pontuação', () => {
    for (const text of ['solteiro(a)', 'solteiros(as)', 'recém-formado(a)']) assert.notEqual(topicOf(text), null, text);
    for (const text of ['C++', 'C#', '.NET', 'Node.js', 'ASP.NET', 'CI/CD', 'R$ 5.000,00', 'e-mail', 'https://empresa.com.br/vagas']) {
      assert.deepEqual(checkTerm(text), { allowed: true }, text);
      assert.deepEqual(findForbidden(text), [], text);
    }
  });
});

describe('em frase', () => {
  const cases: readonly (readonly [string, ForbiddenTopic])[] = [
    ['Procuramos mulheres com Java', 'gender'],
    ['Vaga exclusiva para homens', 'gender'],
    ['Buscamos pessoas jovens e dinâmicas', 'age'],
    ['Pessoa acima de 40 anos', 'age'],
    ['Procuramos nativos digitais', 'age'],
    ['Looking for digital natives', 'age'],
    ['Exigimos boa apresentação pessoal', 'appearance'],
    ['Somente candidatas', 'gender'],
    ['Profissional recém-formado em computação', 'age'],
    ['Pessoa nascida em 1995', 'age'],
    ['Foco na geração Z', 'age'],
    ['Must be under 35 with Python', 'age'],
    ['Candidatos menores de 30 com Java', 'age'],
    ['Pessoas negras têm prioridade', 'race'],
    ['Somente brancos', 'race'],
    ['Exigimos boa aparência', 'appearance'],
    ['Enviar currículo com foto', 'appearance'],
    ['Respeito à religião católica', 'religion'],
    ['Sem filiação partidária', 'politics'],
    ['Não aceitamos sindicalizados', 'politics'],
    ['Preferência por pessoas sem filhos', 'marital_family'],
    ['Profissional solteira', 'marital_family'],
    ['Vaga para PCD', 'disability_health'],
    ['Pessoa com deficiência auditiva', 'disability_health'],
    ['Precisa ter boa saúde', 'disability_health'],
    ['Somente brasileiros', 'nationality_origin'],
    ['Nacionalidade brasileira', 'nationality_origin'],
    ['US citizens only', 'nationality_origin'],
    ['Experiência de no máximo 5 anos com Java', 'max_experience'],
    ['Profissionais com até 5 anos de experiência', 'max_experience'],
    ['At most 5 years of Java', 'max_experience'],
    ['Between 3 and 5 years of experience', 'max_experience'],
  ];
  for (const [text, topic] of cases) {
    test(text, () => assert.ok(topicsIn(text).includes(topic), `${text} => ${topicsIn(text).join(',')}`));
  }
});
