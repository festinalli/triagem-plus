import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { DICTIONARY_TERMS } from '../../../src/core/dictionary/index.ts';
import { TOPIC_REASONS } from '../../../src/core/guard/index.ts';
import { addRequirement, makeRequirement, MAX_REQUIREMENTS, TOTAL_EXPERIENCE_ID } from '../../../src/core/job/requirements.ts';
import type { RequirementInput } from '../../../src/core/job/requirements.ts';
import type { Requirement, RequirementKind } from '../../../src/core/model.ts';

function made(input: RequirementInput): Requirement {
  const result = makeRequirement(input);
  if (!result.ok) throw new Error(`${JSON.stringify(input)}: ${result.reason}`);
  return result.requirement;
}

function term(label: string): RequirementInput {
  return { kind: 'term', label, importance: 'required' };
}

describe('makeRequirement', () => {
  test('termo da lista traz o nome canônico; o rótulo fica como foi digitado', () => {
    assert.deepEqual(makeRequirement({ kind: 'term', label: '  postgres ', importance: 'preferred', minYears: 3 }), {
      ok: true,
      requirement: { id: 'term:postgresql', kind: 'term', importance: 'preferred', label: 'postgres', canonical: 'PostgreSQL', minYears: 3 },
    });
  });

  test('termo fora da lista entra como texto livre, sem canonical nem minYears', () => {
    assert.deepEqual(made({ kind: 'term', label: 'Liderança Técnica', importance: 'required' }), {
      id: 'term:lideranca tecnica',
      kind: 'term',
      importance: 'required',
      label: 'Liderança Técnica',
    });
  });

  test('o id é determinístico e o sinônimo cai no mesmo id', () => {
    assert.deepEqual(made(term('Java')), made(term('Java')));
    assert.equal(made(term('Postgres')).id, made(term('PostgreSQL')).id);
    assert.equal(made(term('K8s')).id, made(term('Kubernetes')).id);
    assert.equal(made(term('Lideranca tecnica')).id, made(term('LIDERANÇA TÉCNICA')).id);
  });

  test('C, C++ e C# têm ids diferentes, embora a normalização os deixe iguais', () => {
    const ids = ['C', 'C++', 'C#'].map((label) => made(term(label)).id);
    assert.deepEqual(ids, ['term:c', 'term:c plus plus', 'term:c sharp']);
    assert.equal(made(term('Linguagem C')).id, 'term:c');
  });

  test('o mesmo nome em tipos diferentes tem ids diferentes', () => {
    assert.equal(made({ kind: 'language', label: 'Inglês', importance: 'required' }).id, 'language:ingles');
    assert.equal(made({ kind: 'title_word', label: 'Tech Lead', importance: 'required' }).id, 'title_word:tech lead');
    assert.equal(made({ kind: 'certification', label: 'CKA', importance: 'required' }).kind, 'certification');
  });

  test('todos os nomes canônicos da lista viram requisito, cada um com seu id', () => {
    const ids = DICTIONARY_TERMS.map((entry) => made(term(entry.canonical)).id);
    assert.equal(new Set(ids).size, ids.length);
  });

  test('caractere substituto solto sai do rótulo', () => {
    assert.equal(made(term('Plataforma\uD83D')).label, 'Plataforma');
    assert.equal(made(term('Plataforma \u{1F680}')).label, 'Plataforma \u{1F680}');
    assert.equal(makeRequirement(term('\uD83D')).ok, false);
  });

  test('longo demais tem código próprio, e o limite não muda quem cabe', () => {
    assert.equal(made(term('a'.repeat(200))).label.length, 200);
    const result = makeRequirement(term('a'.repeat(201)));
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'too_long');
    assert.equal(makeRequirement(undefined as unknown as RequirementInput).ok, false);
  });

  test('vazio', () => {
    for (const label of ['', '   ', '\n', '---', '++', '###', '...']) {
      const result = makeRequirement(term(label));
      assert.equal(result.ok, false, label);
      if (!result.ok) {
        assert.equal(result.code, 'empty');
        assert.equal(result.topic, undefined);
        assert.ok(result.reason.length > 0);
      }
    }
    assert.equal(makeRequirement(term(undefined as unknown as string)).ok, false);
  });

  test('termo proibido é recusado com o assunto e o motivo', () => {
    assert.deepEqual(makeRequirement(term('mulheres')), { ok: false, code: 'forbidden', topic: 'gender', reason: TOPIC_REASONS.gender });
    assert.deepEqual(makeRequirement(term('Até 35 anos')), { ok: false, code: 'forbidden', topic: 'age', reason: TOPIC_REASONS.age });
    assert.deepEqual(makeRequirement({ kind: 'language', label: 'brasileiro', importance: 'required' }), { ok: false, code: 'forbidden', topic: 'nationality_origin', reason: TOPIC_REASONS.nationality_origin });
  });

  test('teto de experiência tem código próprio (RF-14)', () => {
    for (const label of ['no máximo 5 anos', 'até 5 anos de experiência', 'at most 5 years']) {
      assert.deepEqual(makeRequirement(term(label)), { ok: false, code: 'max_experience', topic: 'max_experience', reason: TOPIC_REASONS.max_experience }, label);
    }
    assert.deepEqual(makeRequirement({ kind: 'total_experience', label: 'no máximo 5 anos', importance: 'required', minYears: 5 }), {
      ok: false,
      code: 'max_experience',
      topic: 'max_experience',
      reason: TOPIC_REASONS.max_experience,
    });
  });

  test('anos mínimos: inteiro de 1 a 40', () => {
    assert.equal(made({ kind: 'term', label: 'Java', importance: 'required', minYears: 1 }).minYears, 1);
    assert.equal(made({ kind: 'term', label: 'Java', importance: 'required', minYears: 40 }).minYears, 40);
    for (const minYears of [0, -1, 41, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const result = makeRequirement({ kind: 'term', label: 'Java', importance: 'required', minYears });
      assert.equal(result.ok, false, String(minYears));
      if (!result.ok) assert.equal(result.code, 'invalid_years');
    }
  });

  test('experiência total exige anos e tem id fixo', () => {
    assert.deepEqual(made({ kind: 'total_experience', label: '5 anos de experiência', importance: 'required', minYears: 5 }), {
      id: TOTAL_EXPERIENCE_ID,
      kind: 'total_experience',
      importance: 'required',
      label: '5 anos de experiência',
      minYears: 5,
    });
    assert.equal(made({ kind: 'total_experience', label: 'Outro rótulo', importance: 'preferred', minYears: 9 }).id, TOTAL_EXPERIENCE_ID);
    const missing = makeRequirement({ kind: 'total_experience', label: 'Experiência total', importance: 'required' });
    assert.equal(missing.ok, false);
    if (!missing.ok) assert.equal(missing.code, 'invalid_years');
  });

  test('só termo e experiência total aceitam anos', () => {
    const kinds: readonly RequirementKind[] = ['language', 'certification', 'title_word'];
    for (const kind of kinds) {
      const result = makeRequirement({ kind, label: 'Inglês', importance: 'required', minYears: 3 });
      assert.equal(result.ok, false, kind);
      if (!result.ok) assert.equal(result.code, 'invalid_years');
      assert.equal(makeRequirement({ kind, label: 'Inglês', importance: 'required' }).ok, true, kind);
    }
  });
});

describe('addRequirement', () => {
  const java = made(term('Java'));
  const python = made(term('Python'));

  test('acrescenta no fim e não mexe na lista original', () => {
    const list: readonly Requirement[] = [java];
    const result = addRequirement(list, python);
    assert.deepEqual(result, { ok: true, list: [java, python] });
    assert.deepEqual(list, [java]);
  });

  test('recusa o repetido, mesmo com outra grafia ou outra classe', () => {
    const postgres = made(term('PostgreSQL'));
    const synonym = made({ kind: 'term', label: 'Postgres', importance: 'preferred' });
    const result = addRequirement([postgres], synonym);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'duplicate');
  });

  test('aceita até 30 e recusa o seguinte (RF-12)', () => {
    assert.equal(MAX_REQUIREMENTS, 30);
    const full = (size: number): Requirement[] => Array.from({ length: size }, (_, i) => made(term(`termo livre ${i}`)));
    const last = addRequirement(full(29), java);
    assert.equal(last.ok, true);
    if (last.ok) assert.equal(last.list.length, 30);
    const over = addRequirement(full(30), java);
    assert.equal(over.ok, false);
    if (!over.ok) {
      assert.equal(over.code, 'limit');
      assert.match(over.reason, /30/u);
    }
  });

  test('com a lista cheia, o repetido continua sendo repetido', () => {
    const list = Array.from({ length: 30 }, (_, i) => made(term(`termo livre ${i}`)));
    const repeated = list[0];
    assert.ok(repeated !== undefined);
    const result = addRequirement(list, repeated);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'duplicate');
  });
});
