import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { findTerms, impliedTerms } from '../../../src/core/dictionary/index.ts';

function names(text: string): string[] {
  return findTerms(text).map((hit) => hit.canonical);
}

describe('termos implícitos', () => {
  const implied: ReadonlyArray<readonly [string, string, string]> = [
    ['ASP.NET', 'ASP.NET', '.NET'],
    ['ASP.NET Core', 'ASP.NET', '.NET'],
    ['.NET Core', '.NET', '.NET'],
    ['SQL Server', 'SQL Server', 'SQL'],
    ['PostgreSQL', 'PostgreSQL', 'SQL'],
    ['MySQL', 'MySQL', 'SQL'],
    ['MariaDB', 'MariaDB', 'SQL'],
    ['Oracle', 'Oracle', 'SQL'],
    ['SQLite', 'SQLite', 'SQL'],
    ['T-SQL', 'T-SQL', 'SQL'],
    ['PL/SQL', 'PL/SQL', 'SQL'],
    ['Spring Boot', 'Spring Boot', 'Spring'],
    ['J2EE', 'Java EE', 'Java'],
    ['Next.js', 'Next.js', 'React'],
    ['Nuxt.js', 'Nuxt.js', 'Vue.js'],
  ];
  for (const [text, explicit, implicit] of implied) {
    test(`${text} traz ${implicit}`, () => {
      const found = names(`Experiência com ${text}`);
      assert.ok(found.includes(explicit), JSON.stringify(found));
      assert.ok(found.includes(implicit), JSON.stringify(found));
    });
  }

  test('o implícito vem logo depois de quem o implica, sem repetir', () => {
    assert.deepEqual(names('Java 17 com Spring Boot'), ['Java', 'Spring Boot', 'Spring']);
    assert.deepEqual(names('PostgreSQL e MySQL'), ['PostgreSQL', 'SQL', 'MySQL']);
    assert.deepEqual(names('SQL e PostgreSQL'), ['SQL', 'PostgreSQL']);
  });

  test('a contagem do implícito soma quem o implica; o citado por extenso mantém a sua', () => {
    const hits = findTerms('MySQL, MySQL e PostgreSQL');
    assert.equal(hits.find((hit) => hit.canonical === 'SQL')?.count, 3);
    assert.equal(hits.find((hit) => hit.canonical === 'SQL')?.category, 'technology');
    const own = findTerms('SQL, SQL e MySQL');
    assert.equal(own.find((hit) => hit.canonical === 'SQL')?.count, 2);
  });

  test('Vue 3 e semelhantes contam como o próprio termo', () => {
    assert.deepEqual(names('Vue 3'), ['Vue.js']);
    assert.deepEqual(names('Vue 2 e Angular 15'), ['Vue.js', 'Angular']);
  });
});

describe('o que NÃO é implícito', () => {
  const none: ReadonlyArray<readonly [string, string, string]> = [
    ['NoSQL não implica SQL', 'Experiência com NoSQL', 'SQL'],
    ['React Native não implica React', 'Apps com React Native', 'React'],
    ['JavaScript não implica TypeScript', 'Experiência com JavaScript', 'TypeScript'],
    ['TypeScript não implica JavaScript', 'Experiência com TypeScript', 'JavaScript'],
    ['Java não implica JavaScript', 'Experiência com Java', 'JavaScript'],
    ['JavaScript não implica Java', 'Experiência com JavaScript', 'Java'],
    ['.NET não implica ASP.NET', 'Sistemas em .NET', 'ASP.NET'],
    ['SQL não implica PostgreSQL', 'Experiência com SQL', 'PostgreSQL'],
    ['Spring não implica Spring Boot', 'Serviços em Spring', 'Spring Boot'],
    ['MongoDB não implica SQL', 'Experiência com MongoDB', 'SQL'],
  ];
  for (const [title, text, absent] of none) {
    test(title, () => assert.ok(!names(text).includes(absent), JSON.stringify(names(text))));
  }

  test('impliedTerms: tabela e exceções', () => {
    assert.deepEqual([...impliedTerms('ASP.NET')], ['.NET']);
    assert.deepEqual([...impliedTerms('Spring Boot')], ['Spring']);
    for (const canonical of ['NoSQL', 'React Native', 'JavaScript', 'TypeScript', 'Java', 'Python', 'termo desconhecido']) {
      assert.deepEqual([...impliedTerms(canonical)], [], canonical);
    }
  });
});
