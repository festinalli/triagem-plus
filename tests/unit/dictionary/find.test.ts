import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { findTerms } from '../../../src/core/dictionary/index.ts';

function names(text: string): string[] {
  return findTerms(text).map((hit) => hit.canonical);
}

function has(text: string, canonical: string): boolean {
  return names(text).includes(canonical);
}

describe('Spring: a estação do ano não conta', () => {
  const seasons = [
    'In spring 2020 we moved the team to a new office.',
    'spring 2020',
    'Spring 2021 cohort',
    'We hired interns over spring break.',
    'spring break',
    'this spring',
    'Courses of the spring semester',
    'Java developer who loves spring cleaning',
    'In spring we shipped the Java service.',
    'Java, spring break',
    'Internship with spring 2020 cohort',
    'Início em spring 2027',
  ];
  for (const text of seasons) {
    test(`não conta: ${text}`, () => assert.equal(has(text, 'Spring'), false));
  }

  const framework = [
    'Spring Framework',
    'APIs com Spring e Hibernate',
    'Microsserviços em Spring',
    'Experiência com Spring',
    'Java e Spring',
    'Java, Spring',
    'Spring MVC e Spring Data',
    'Built services using Spring',
    'Spring Security',
  ];
  for (const text of framework) {
    test(`conta: ${text}`, () => assert.equal(has(text, 'Spring'), true));
  }

  test('Spring Boot é termo próprio e traz Spring junto', () => {
    assert.deepEqual(names('Serviços em Spring Boot'), ['Spring Boot', 'Spring']);
    assert.deepEqual(names('Java 17 com Spring Boot'), ['Java', 'Spring Boot', 'Spring']);
  });
});

describe('Oracle e níveis', () => {
  test('Oracle, com ou sem Database', () => {
    assert.deepEqual(names('Banco Oracle em produção'), ['Oracle', 'SQL']);
    assert.deepEqual(names('Oracle Database 19c'), ['Oracle', 'SQL']);
    assert.deepEqual(names('Oracle Certified Professional Java'), ['Oracle Certified Professional Java']);
  });

  const levels: ReadonlyArray<readonly [string, string]> = [
    ['Desenvolvedora Sênior', 'Sênior'],
    ['Senior Software Engineer', 'Sênior'],
    ['Analista Sr.', 'Sênior'],
    ['Desenvolvedor Java Pleno', 'Pleno'],
    ['Engenheira Plena', 'Pleno'],
    ['Analista Júnior', 'Júnior'],
    ['Junior Developer', 'Júnior'],
    ['Programador Jr', 'Júnior'],
  ];
  for (const [text, canonical] of levels) {
    test(`${text}: ${canonical}`, () => assert.ok(has(text, canonical)));
  }

  for (const text of ['Empresa em pleno crescimento', 'Startup em plena expansão', 'Sistema em pleno funcionamento', 'Pleno domínio de Java']) {
    test(`"pleno" como adjetivo não é nível: ${text}`, () => assert.equal(has(text, 'Pleno'), false));
  }
});

describe('termos ambíguos contam nos casos certos (CA-04)', () => {
  const positives: Array<[string, string]> = [
    ['Experiência sólida em C e C++ para sistemas embarcados', 'C'],
    ['Linguagens: C, Python e SQL', 'C'],
    ['Programação em C no Linux (kernel)', 'C'],
    ['Conhecimento de C++17 e boost', 'C++'],
    ['Desenvolvedor C# com .NET 8', 'C#'],
    ['Programação funcional com F# e C#', 'F#'],
    ['Backend em Go (Golang), microsserviços', 'Go'],
    ['Desenvolvedor Go sênior', 'Go'],
    ['Experiência com Go e Kubernetes', 'Go'],
    ['We use Python and Go for our services', 'Go'],
    ['Estatística em R e Python', 'R'],
    ['Linguagem R, RStudio e tidyverse', 'R'],
    ['Experience with R and SQL', 'R'],
    ['Sistemas em Rust e Python', 'Rust'],
    ['Rust developer for low-latency systems', 'Rust'],
    ['Python, Rust, TypeScript', 'Rust'],
    ['Desenvolvedor Swift para iOS', 'Swift'],
    ['Swift and Kotlin for mobile apps', 'Swift'],
    ['App em Swift e SwiftUI', 'Swift'],
    ['Apps multiplataforma com Dart e Flutter', 'Dart'],
    ['Dart, Kotlin e Swift', 'Dart'],
    ['ASP.NET e .NET Core', '.NET'],
    ['Sistemas em .NET', '.NET'],
    ['VB.NET legado', '.NET'],
    ['API em Node.js com Express', 'Node.js'],
    ['Node.js', 'Node.js'],
    ['Vue, React e Angular', 'Vue.js'],
    ['Vue.js 3 com Pinia', 'Vue.js'],
    ['Front-end com React e TypeScript', 'React'],
    ['React.js, Next.js e Tailwind', 'React'],
    ['SSR com Next.js', 'Next.js'],
    ['Ruby on Rails ou Ruby com RSpec', 'Ruby'],
    ['Julia, Python e R para ciência de dados', 'Julia'],
  ];
  for (const [text, canonical] of positives) {
    test(`"${text}" tem ${canonical}`, () => {
      assert.ok(has(text, canonical), `esperava ${canonical} em ${JSON.stringify(names(text))}`);
    });
  }
});

describe('termos ambíguos não contam em frases comuns (CA-04)', () => {
  const negatives: Array<[string, string]> = [
    ['Estratégia de go to market para o produto', 'Go'],
    ['Plano go-to-market em Python', 'Go'],
    ['Vamos go to market com Python e Java', 'Go'],
    ['Salário de R$ 5.000 mais benefícios', 'R'],
    ['Faixa salarial: R$ 8.000 a R$ 12.000. Python e SQL', 'R'],
    ['Bônus em US$ 3.000, Python', 'R'],
    ['Reporta a um C level da empresa', 'C'],
    ['Interação com C-level e Python', 'C'],
    ['Apresentações ao C-suite, sql', 'C'],
    ['Integração com Swift payments e Python', 'Swift'],
    ['Transferências Swift internacionais', 'Swift'],
    ['Resposta swift e atenta ao cliente', 'Swift'],
    ['Quando o aço sofre rust no ambiente úmido', 'Rust'],
    ['Rust never sleeps', 'Rust'],
    ['Gostamos de jogar dart nos fins de semana', 'Dart'],
    ['Julia Santos, analista', 'Julia'],
    ['Ruby Silva coordena a equipe', 'Ruby'],
    ['A equipe precisa react to changes quickly', 'React'],
    ['Cada node da árvore tem um valor', 'Node.js'],
    ['Vá ao escritório às segundas', 'Go'],
    ['Let us go ahead and r plan it', 'R'],
    ['Peça um go do gestor', 'Go'],
  ];
  for (const [text, canonical] of negatives) {
    test(`"${text}" não tem ${canonical}`, () => {
      assert.ok(!has(text, canonical), `não esperava ${canonical} em ${JSON.stringify(names(text))}`);
    });
  }

  test('frases comuns sem tecnologia não devolvem nada', () => {
    for (const text of ['go to market', 'r$ 5.000', 'c level', 'swift payments', 'vá', 'rust', 'go', 'r', 'c', 'swift', 'dart']) {
      assert.deepEqual(names(text), [], text);
    }
  });

  test('swift payments (rede bancária) não é a linguagem, mesmo num texto de vaga com outra tecnologia', () => {
    assert.deepEqual(names('Integração com swift payments, Python'), ['Python']);
    // Decisão documentada: a frase inteira é descartada. Se o texto também fala de iOS, Swift conta por esse contexto.
    assert.ok(has('Swift para apps iOS', 'Swift'));
  });

  test('forma protegida só vale como palavra inteira', () => {
    assert.ok(!has('abc++ e xyz#', 'C++'));
    assert.ok(!has('abc++ e xyz#', 'C#'));
  });
});

describe('sinônimos apontam para o canônico', () => {
  const synonyms: Array<[string, string]> = [
    ['JS', 'JavaScript'],
    ['TS', 'TypeScript'],
    ['K8s', 'Kubernetes'],
    ['Postgres', 'PostgreSQL'],
    ['GCP', 'Google Cloud Platform'],
    ['AWS', 'AWS'],
    ['Golang', 'Go'],
    ['ReactJS', 'React'],
    ['Node', 'Node.js'],
    ['nodejs', 'Node.js'],
    ['NextJS', 'Next.js'],
    ['Vue', 'Vue.js'],
    ['dotnet', '.NET'],
    ['csharp', 'C#'],
    ['cpp', 'C++'],
  ];
  for (const [alias, canonical] of synonyms) {
    test(`${alias} aponta para ${canonical}`, () => {
      assert.ok(has(`Experiência com ${alias} e backend`, canonical), JSON.stringify(names(`Experiência com ${alias} e backend`)));
    });
  }

  test('sinônimos sozinhos, sem contexto, também contam quando não são ambíguos', () => {
    assert.deepEqual(names('K8s'), ['Kubernetes']);
    assert.deepEqual(names('Postgres'), ['PostgreSQL', 'SQL']);
    assert.deepEqual(names('GCP'), ['Google Cloud Platform']);
    assert.deepEqual(names('Golang'), ['Go']);
    assert.deepEqual(names('ReactJS'), ['React']);
    assert.deepEqual(names('JS'), ['JavaScript']);
    assert.deepEqual(names('TS'), ['TypeScript']);
  });
});

describe('acento, caixa e idioma', () => {
  test('acento e maiúsculas não importam', () => {
    assert.deepEqual(names('PROGRAMAÇÃO ORIENTADA A OBJETOS'), names('programacao orientada a objetos'));
    assert.ok(has('Visão Computacional e APRENDIZADO DE MÁQUINA', 'Visão computacional'));
    assert.ok(has('visao computacional e aprendizado de maquina', 'Machine Learning'));
    assert.deepEqual(names('PYTHON'), names('python'));
    assert.deepEqual(names('Ingles tecnico e Inglês'), ['Inglês']);
  });

  test('texto em português e em inglês', () => {
    assert.ok(has('Buscamos pessoa desenvolvedora com experiência em microsserviços e integração contínua', 'Microsserviços'));
    assert.ok(has('Buscamos pessoa desenvolvedora com experiência em microsserviços e integração contínua', 'Integração contínua'));
    assert.ok(has('We need a backend engineer with microservices and continuous integration experience', 'Microsserviços'));
    assert.ok(has('We need a backend engineer with microservices and continuous integration experience', 'Integração contínua'));
    assert.ok(has('Fluent English required', 'Inglês'));
  });

  test('CI/CD, pontuação e quebras de linha', () => {
    assert.ok(has('Pipelines de CI/CD', 'Integração contínua'));
    assert.deepEqual(names('Python,\nGo;\nSQL.'), ['Python', 'Go', 'SQL']);
  });

  test('conta ocorrências e mantém a ordem da primeira aparição', () => {
    const hits = findTerms('Python, SQL e mais Python');
    assert.deepEqual(
      hits.map((h) => [h.canonical, h.category, h.count]),
      [
        ['Python', 'technology', 2],
        ['SQL', 'technology', 1],
      ],
    );
  });

  test('entrada vazia ou que não é texto devolve lista vazia', () => {
    assert.deepEqual(findTerms(''), []);
    assert.deepEqual(findTerms(undefined as unknown as string), []);
  });
});

describe('Java e JavaScript são termos diferentes', () => {
  test('"Java" não dispara em "JavaScript"', () => {
    assert.deepEqual(names('JavaScript'), ['JavaScript']);
    assert.deepEqual(names('Node.js e JavaScript'), ['Node.js', 'JavaScript']);
    assert.ok(!has('Experiência com JavaScript e TypeScript', 'Java'));
  });

  test('"JavaScript" não dispara em "Java"', () => {
    assert.deepEqual(names('Java'), ['Java']);
    assert.deepEqual(names('Java 17 com Spring Boot'), ['Java', 'Spring Boot', 'Spring']);
    assert.ok(!has('Backend em Java', 'JavaScript'));
  });

  test('os dois juntos contam cada um uma vez', () => {
    assert.deepEqual(names('Java e JavaScript'), ['Java', 'JavaScript']);
  });
});

describe('desempenho', () => {
  function longText(size: number): string {
    const paragraph =
      'Buscamos pessoa desenvolvedora back-end com experiência em Java, Spring Boot, PostgreSQL e Docker. ' +
      'Diferencial: Kubernetes, AWS e CI/CD. Salário de R$ 9.000 a R$ 12.000, go to market, C-level e Python. ' +
      'We value teamwork, clean code and ownership; react to feedback quickly. Node.js, C#, .NET e Go são bem-vindos. ';
    let text = '';
    while (text.length < size) text += paragraph;
    return text.slice(0, size);
  }

  test('texto de 20 mil caracteres roda em menos de 50 ms', () => {
    const text = longText(20_000);
    assert.equal(text.length, 20_000);
    findTerms(text); // aquece o motor de expressões regulares
    const start = performance.now();
    const hits = findTerms(text);
    const elapsed = performance.now() - start;
    assert.ok(elapsed < 50, `levou ${elapsed.toFixed(1)} ms`);
    assert.ok(hits.some((h) => h.canonical === 'Java' && h.count >= 50));
  });

  test('texto longo de uma letra só, sem espaços, também termina rápido', () => {
    const start = performance.now();
    findTerms('c'.repeat(20_000));
    findTerms('c '.repeat(10_000));
    findTerms('c++ '.repeat(5_000));
    const elapsed = performance.now() - start;
    assert.ok(elapsed < 150, `levou ${elapsed.toFixed(1)} ms`);
  });
});
