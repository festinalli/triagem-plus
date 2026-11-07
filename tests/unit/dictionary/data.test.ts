import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEV_DICTIONARY,
  DICTIONARY_TERMS,
  TERM_CATEGORIES,
  categoryOf,
  canonicalOf,
  findTerms,
  isKnownTerm,
  synonymsOf,
} from '../../../src/core/dictionary/index.ts';
import { normalize } from '../../../src/core/text/normalize.ts';

describe('dados do dicionário', () => {
  test('compila sem entrada rejeitada nem conflito entre termos', () => {
    assert.equal(DEV_DICTIONARY.rejected, 0);
    assert.equal(DEV_DICTIONARY.terms.length, DICTIONARY_TERMS.length);
  });

  test('nomes canônicos são únicos e as categorias são válidas', () => {
    const canonicals = DICTIONARY_TERMS.map((t) => t.canonical);
    assert.equal(new Set(canonicals).size, canonicals.length);
    for (const term of DICTIONARY_TERMS) assert.ok(TERM_CATEGORIES.includes(term.category), term.canonical);
  });

  test('a lista de idiomas existe e tem a categoria language', () => {
    const languages = DICTIONARY_TERMS.filter((t) => t.category === 'language').map((t) => t.canonical);
    assert.ok(languages.includes('Inglês'));
    assert.ok(languages.includes('Espanhol'));
    assert.equal(categoryOf('English'), 'language');
  });

  test('nenhum termo trata de idade, gênero, raça, religião, estado civil, deficiência ou endereço', () => {
    // Raízes de palavras (normalizadas). "desenvolvedora" e afins são só a forma feminina do cargo, não um atributo.
    const forbidden = [
      'idade', 'anos de idade', 'nascimento', 'aniversario', 'jovem', 'idoso', 'senior citizen', 'geracao', 'age',
      'genero', 'gender', 'sexo', 'sexual', 'homem', 'mulher', 'masculino', 'feminino', 'trans', 'gay', 'lesbica', 'orientacao',
      'raca', 'cor da pele', 'etnia', 'negro', 'branco', 'indigena', 'race', 'ethnic',
      'religi', 'catolic', 'evangelic', 'muculmano', 'judeu', 'ateu', 'espirita', 'church', 'igreja',
      'estado civil', 'casado', 'solteiro', 'divorci', 'viuvo', 'marital', 'married', 'filhos', 'gravidez', 'gestante', 'maternidade',
      'deficien', 'disability', 'cadeirante', 'surdo', 'cego', 'libras', 'autis', 'doenca', 'saude',
      'endereco', 'address', 'bairro', 'cep', 'moradia', 'residencia', 'rua ',
    ];
    // Estas entradas valem como começo de palavra; as outras, só como palavra inteira.
    const stems = new Set(['religi', 'catolic', 'evangelic', 'divorci', 'deficien', 'autis']);
    for (const term of DEV_DICTIONARY.terms) {
      for (const name of [...term.names, ...term.requires]) {
        const key = ` ${normalize(name)} `;
        for (const bad of forbidden) {
          const hit = stems.has(bad) ? key.includes(bad) : key.includes(` ${bad.trim()} `);
          assert.ok(!hit, `"${name}" (${term.canonical}) contém "${bad}"`);
        }
      }
    }
  });

  test('só termos de trabalho de tecnologia: nada de vendas, finanças, marketing ou RH', () => {
    const outOfScope = ['Recrutador', 'Contador', 'Marketing digital', 'Vendas B2B', 'Microsoft Excel', 'HubSpot', 'Adobe Photoshop', 'Contabilidade', 'PMP', 'Libras'];
    for (const canonical of outOfScope) {
      assert.equal(DICTIONARY_TERMS.some((t) => t.canonical === canonical), false, canonical);
    }
    assert.equal(isKnownTerm('Contador'), false);
    assert.equal(isKnownTerm('Photoshop'), false);
  });
});

describe('consulta de termo isolado', () => {
  test('isKnownTerm separa termo da lista de texto livre', () => {
    for (const text of ['Python', 'python', 'K8s', 'C++', 'C#', '.NET', 'Node.js', 'Node', 'Go', 'R', 'Postgres', 'Inglês', 'ingles', 'JS']) {
      assert.equal(isKnownTerm(text), true, text);
    }
    for (const text of ['', '   ', 'go to market', 'R$ 5.000', 'c level', 'liderança carismática', 'swift payments', 'x'.repeat(200)]) {
      assert.equal(isKnownTerm(text), false, text);
    }
  });

  test('canonicalOf e categoryOf resolvem sinônimos', () => {
    assert.equal(canonicalOf('k8s'), 'Kubernetes');
    assert.equal(canonicalOf('Golang'), 'Go');
    assert.equal(canonicalOf('Node'), 'Node.js');
    assert.equal(canonicalOf('nada disso'), null);
    assert.equal(categoryOf('Kubernetes'), 'tool');
    assert.equal(categoryOf('TypeScript'), 'technology');
    assert.equal(categoryOf('CKA'), 'certification');
    assert.equal(categoryOf('Tech Lead'), 'role');
    assert.equal(categoryOf('TDD'), 'skill');
    assert.equal(categoryOf('nada disso'), null);
  });

  test('synonymsOf devolve o canônico primeiro e os sinônimos para a busca', () => {
    const k8s = synonymsOf('Kubernetes');
    assert.equal(k8s[0], 'Kubernetes');
    assert.ok(k8s.includes('k8s'));
    assert.deepEqual(synonymsOf('k8s'), k8s);
    assert.ok(synonymsOf('Postgres').includes('PostgreSQL'));
    assert.ok(synonymsOf('JS').includes('JavaScript'));
    assert.ok(synonymsOf('C++').includes('cpp'));
    assert.deepEqual(synonymsOf('nada disso'), []);
  });

  test('todo nome de todo termo é reconhecido por isKnownTerm e volta ao mesmo canônico', () => {
    for (const term of DEV_DICTIONARY.terms) {
      for (const name of term.names) {
        assert.equal(canonicalOf(name), term.canonical, name);
      }
    }
  });

  describe('termos novos', () => {
    const cases: ReadonlyArray<readonly [string, string, string]> = [
      ['Spring', 'Spring', 'technology'],
      ['Spring Framework', 'Spring', 'technology'],
      ['Oracle', 'Oracle', 'technology'],
      ['Oracle Database', 'Oracle', 'technology'],
      ['Sênior', 'Sênior', 'role'],
      ['senior', 'Sênior', 'role'],
      ['Sr', 'Sênior', 'role'],
      ['Sr.', 'Sênior', 'role'],
      ['Pleno', 'Pleno', 'role'],
      ['Plena', 'Pleno', 'role'],
      ['Júnior', 'Júnior', 'role'],
      ['junior', 'Júnior', 'role'],
      ['Jr', 'Júnior', 'role'],
      ['Jr.', 'Júnior', 'role'],
    ];
    for (const [name, canonical, category] of cases) {
      test(`"${name}" é ${canonical}, categoria ${category}`, () => {
        assert.equal(canonicalOf(name), canonical);
        assert.equal(categoryOf(name), category);
      });
    }

    test('Spring Boot continua sendo um termo próprio', () => {
      assert.equal(canonicalOf('Spring Boot'), 'Spring Boot');
      assert.equal(canonicalOf('Spring MVC'), 'Spring');
    });
  });

  // Se um cargo existe no masculino, existe no feminino, e vice-versa. Sem isso, "Engenheiro" e "Engenheira" dariam nota diferente.
  test('todo nome de cargo da lista tem as duas formas de gênero', () => {
    const pairs: ReadonlyArray<readonly [string, string]> = [
      ['desenvolvedor', 'desenvolvedora'], ['engenheiro', 'engenheira'], ['arquiteto', 'arquiteta'], ['programador', 'programadora'],
      ['administrador', 'administradora'], ['estagiario', 'estagiaria'], ['tecnico', 'tecnica'], ['dono', 'dona'], ['pleno', 'plena'],
    ];
    const swapped = (key: string, from: 0 | 1): string => key.split(' ').map((word) => {
      const pair = pairs.find((candidate) => candidate[from] === word);
      return pair === undefined ? word : pair[from === 0 ? 1 : 0];
    }).join(' ');

    const gaps: string[] = [];
    let checked = 0;
    for (const term of DICTIONARY_TERMS.filter((candidate) => candidate.category === 'role')) {
      for (const name of [term.canonical, ...term.synonyms]) {
        const key = normalize(name);
        for (const other of [swapped(key, 0), swapped(key, 1)]) {
          if (other === key) continue;
          checked++;
          if (canonicalOf(other) !== term.canonical) gaps.push(`${name} -> ${other}`);
        }
      }
    }
    assert.deepEqual(gaps, []);
    assert.ok(checked > 20, 'a prova não leu nada');
  });

  test('todo termo sem contexto exigido é achado pelo próprio nome em um texto', () => {
    for (const term of DEV_DICTIONARY.terms) {
      if (term.requires.length > 0) continue;
      const found = findTerms(`Experiência com ${term.canonical} no dia a dia`).map((h) => h.canonical);
      assert.ok(found.includes(term.canonical), `${term.canonical} não foi achado (${JSON.stringify(found)})`);
    }
  });
});
