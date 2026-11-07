// O modelo do relatório (RF-71): ordem, escopo, rótulos em português e notas só se pedidas.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { buildReport, formatExperience } from '../../../src/core/report/model.ts';
import { JOB, NOW, candidate } from './helpers.ts';

function fifteen() {
  return Array.from({ length: 15 }, (_, i) => candidate({ id: `c${String(i).padStart(2, '0')}`, score: 100 - i * 3, addedAt: i }));
}

describe('buildReport', () => {
  test('top10 traz 10 em ordem de nota, e all traz os 15', () => {
    const shuffled = [...fifteen()].reverse();
    const top = buildReport({ job: JOB, candidates: shuffled, scope: 'top10', includeNotes: false, now: NOW });
    assert.equal(top.rows.length, 10);
    assert.deepEqual(top.rows.map((r) => r.position), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    assert.deepEqual(top.rows.map((r) => r.scoreText), Array.from({ length: 10 }, (_, i) => String(100 - i * 3)));
    assert.equal(top.totalCandidates, 15);
    assert.equal(top.scopeText, 'Os 10 melhores entre 15 candidatos');
    const all = buildReport({ job: JOB, candidates: shuffled, scope: 'all', includeNotes: false, now: NOW });
    assert.equal(all.rows.length, 15);
    assert.equal(all.scopeText, 'Todos os 15 candidatos');
  });

  test('bateu, faltou e a rever usam os rótulos da vaga; o que precisa analisar de novo não vira falta (RF-55)', () => {
    const c = candidate({ id: 'a', statuses: ['met', 'partial', 'not_found', 'needs_reanalysis'], band: 'strong', score: 90 });
    const [row] = buildReport({ job: JOB, candidates: [c], scope: 'all', includeNotes: false, now: NOW }).rows;
    assert.ok(row);
    assert.deepEqual(row.met, ['Java', 'Spring Boot (em parte)']);
    assert.deepEqual(row.missing, ['AWS']);
    assert.deepEqual(row.review, ['Inglês']);
    assert.equal(row.bandLabel, 'Forte');
    assert.equal(row.experience, '6 anos e 3 meses');
    assert.equal(row.stageLabel, 'Em análise');
  });

  test('sem nota avaliada aparece como "sem nota"', () => {
    const c = candidate({ id: 'a', statuses: ['needs_reanalysis', 'needs_reanalysis'], score: 0, band: 'weak' });
    const [row] = buildReport({ job: JOB, candidates: [c], scope: 'all', includeNotes: false, now: NOW }).rows;
    assert.equal(row?.scoreText, 'sem nota');
    assert.equal(row?.bandLabel, null);
  });

  test('rótulos de faixa e de etapa', () => {
    const stages = ['new', 'reviewing', 'contacted', 'interview', 'offer', 'closed'] as const;
    const list = stages.map((stage, i) => candidate({ id: `s${i}`, stage, score: 60 - i }));
    const rows = buildReport({ job: JOB, candidates: list, scope: 'all', includeNotes: false, now: NOW }).rows;
    assert.deepEqual(rows.map((r) => r.stageLabel), ['Novo', 'Em análise', 'Contatado', 'Entrevista', 'Proposta', 'Encerrado']);
    const bands = [candidate({ id: 'x', band: 'strong', score: 90 }), candidate({ id: 'y', band: 'partial', score: 60 }), candidate({ id: 'z', band: 'weak', score: 10 })];
    assert.deepEqual(buildReport({ job: JOB, candidates: bands, scope: 'all', includeNotes: false, now: NOW }).rows.map((r) => r.bandLabel), ['Forte', 'Parcial', 'Fraco']);
  });

  test('notas só entram se pedidas', () => {
    const c = candidate({ id: 'a', notes: 'ligar na terça' });
    const without = buildReport({ job: JOB, candidates: [c], scope: 'all', includeNotes: false, now: NOW });
    const withNotes = buildReport({ job: JOB, candidates: [c], scope: 'all', includeNotes: true, now: NOW });
    assert.equal(without.rows[0]?.notes, null);
    assert.equal(withNotes.rows[0]?.notes, 'ligar na terça');
  });

  test('requisitos, data e vaga sem candidatos', () => {
    const model = buildReport({ job: JOB, candidates: [], scope: 'top10', includeNotes: false, now: NOW });
    assert.equal(model.rows.length, 0);
    assert.equal(model.dateText, '06/11/2026');
    assert.deepEqual(model.requirements.map((r) => r.importanceLabel), ['Obrigatório', 'Obrigatório', 'Desejável', 'Desejável']);
  });

  test('experiência em anos e meses', () => {
    assert.equal(formatExperience(null), 'Não informada');
    assert.equal(formatExperience(0), '0 meses');
    assert.equal(formatExperience(1), '1 mês');
    assert.equal(formatExperience(12), '1 ano');
    assert.equal(formatExperience(13), '1 ano e 1 mês');
    assert.equal(formatExperience(30), '2 anos e 6 meses');
  });
});
