// A planilha (RF-74, CA-14) e o nome do arquivo.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { csvCell, renderCsv } from '../../../src/core/report/csv.ts';
import { reportFileName } from '../../../src/core/report/filename.ts';
import { buildReport } from '../../../src/core/report/model.ts';
import { FOOTER_PHRASE, MISSING_NOTICE, PERSONAL_DATA_NOTICE, REVIEW_NOTICE } from '../../../src/core/report/model.ts';
import { JOB, NOW, candidate } from './helpers.ts';

describe('CA-14: neutralização de fórmula', () => {
  test('= + - @ tabulação e retorno ganham apóstrofo', () => {
    for (const start of ['=1+1', '+55', '-2', '@SOMA(A1)', '\tx', '\rx', ' =HYPERLINK("x")']) {
      assert.ok(csvCell(start).replace(/^"/, '').startsWith("'"), JSON.stringify(start));
    }
    assert.equal(csvCell('Ana'), 'Ana');
    assert.equal(csvCell('a=b'), 'a=b');
  });

  test('o texto de terceiros no nome, cargo e notas sai neutralizado no arquivo', () => {
    const c = candidate({ id: 'a', name: '=cmd|"/c calc"!A1', currentTitle: '@dev', notes: '+1 ligar' });
    const csv = renderCsv(buildReport({ job: JOB, candidates: [c], scope: 'all', includeNotes: true, now: NOW }));
    assert.ok(csv.includes(`"'=cmd|""/c calc""!A1"`));
    assert.ok(csv.includes(";'@dev;"));
    assert.ok(csv.includes(";'+1 ligar"));
  });
});

// Com a legenda de "Faltou" e sem "A rever". Título, data, "Requisitos da vaga", 4 requisitos, abrangência, legenda de "Faltou", frase, aviso e linha em branco.
const INTRO_LINES = 12;

describe('renderCsv', () => {
  test('o cabeçalho traz o mesmo que o PDF: título, data, requisitos, abrangência, legenda e avisos (RF-70 a RF-72)', () => {
    const c = candidate({ id: 'a', statuses: ['met', 'met', 'not_found', 'needs_reanalysis'] });
    const csv = renderCsv(buildReport({ job: JOB, candidates: [c], scope: 'all', includeNotes: false, now: NOW }));
    const lines = csv.replace(/^\uFEFF/, '').split('\r\n');
    assert.equal(lines[0], 'Triagem+: Pessoa Desenvolvedora Java Sênior');
    assert.equal(lines[1], 'Relatório gerado em 06/11/2026');
    assert.ok(lines.includes('Java;Obrigatório') && lines.includes('AWS;Desejável'));
    for (const piece of [MISSING_NOTICE, REVIEW_NOTICE, FOOTER_PHRASE, PERSONAL_DATA_NOTICE, '1 candidato']) assert.ok(lines.includes(csvCell(piece)), piece);
    assert.ok(lines.indexOf(PERSONAL_DATA_NOTICE) < lines.findIndex((line) => line.startsWith('Posição;')));
  });

  test('o texto de terceiros no título da vaga também sai neutralizado', () => {
    const csv = renderCsv(buildReport({ job: { ...JOB, title: '=1+1' }, candidates: [], scope: 'all', includeNotes: false, now: NOW }));
    assert.ok(!csv.includes('\n=1+1'));
  });

  test('lista filtrada diz N de M e quais filtros valem', () => {
    const list = [candidate({ id: 'a' })];
    const model = buildReport({ job: JOB, candidates: list, scope: 'all', includeNotes: false, now: NOW, allCount: 3, filterTexts: ['termo "Java"'] });
    assert.equal(model.scopeText, '1 de 3 candidatos, com filtro: termo "Java"');
    assert.ok(renderCsv(model).includes('1 de 3 candidatos'));
  });

  test('BOM, ponto e vírgula, CRLF, aspas e quebra de linha dentro da célula', () => {
    const c = candidate({ id: 'a', name: 'Ana; "Bia" Souza', notes: 'linha 1\nlinha 2', statuses: ['met', 'partial', 'not_found', 'needs_reanalysis'] });
    const csv = renderCsv(buildReport({ job: JOB, candidates: [c], scope: 'all', includeNotes: true, now: NOW }));
    assert.ok(csv.startsWith('\uFEFF'));
    assert.ok(csv.includes('\r\nPosição;Nome;Link;Nota;Faixa;Experiência total;Cargo atual;Etapa;Bateu;Faltou;A rever;Notas\r\n'));
    assert.ok(csv.includes('"Ana; ""Bia"" Souza"'));
    assert.ok(csv.includes('"linha 1\nlinha 2"'));
    assert.ok(csv.includes('Java, Spring Boot (em parte)'));
    assert.ok(csv.includes(';AWS;Inglês;'), 'faltou e a rever em colunas separadas');
    assert.ok(csv.endsWith('\r\n'));
    assert.equal(csv.split('\r\n').length, INTRO_LINES + 4); // com "A rever": +1, cabeçalho, linha e fim
  });

  test('sem notas pedidas, não há coluna nem texto de notas', () => {
    const c = candidate({ id: 'a', notes: 'segredo' });
    const csv = renderCsv(buildReport({ job: JOB, candidates: [c], scope: 'all', includeNotes: false, now: NOW }));
    assert.ok(!csv.includes('segredo'));
    assert.ok(!csv.includes('Notas'));
  });

  test('sem nota e sem candidatos', () => {
    const none = candidate({ id: 'a', statuses: ['needs_reanalysis'], score: 0, band: 'weak' });
    const csv = renderCsv(buildReport({ job: JOB, candidates: [none], scope: 'all', includeNotes: false, now: NOW }));
    assert.ok(csv.includes(';sem nota;;'));
    assert.equal(renderCsv(buildReport({ job: JOB, candidates: [], scope: 'all', includeNotes: false, now: NOW })).split('\r\n').length, INTRO_LINES + 1);
  });
});

describe('reportFileName', () => {
  test('forma triagem-<vaga>-<data>.<ext>', () => {
    assert.equal(reportFileName('Pessoa Desenvolvedora Java Sênior', NOW, 'pdf'), 'triagem-pessoa-desenvolvedora-java-senior-2026-11-06.pdf');
    assert.equal(reportFileName('Dev', NOW, 'csv'), 'triagem-dev-2026-11-06.csv');
  });

  test('caminhos, nomes reservados do Windows e títulos sem letra latina', () => {
    for (const title of ['../../etc/passwd', 'C:\\Windows\\x', 'CON', 'NUL', 'com1', 'aux.', '日本語', '', '   ', '<>:"|?*']) {
      const name = reportFileName(title, NOW, 'pdf');
      assert.match(name, /^triagem-[a-z0-9]+(-[a-z0-9]+)*-2026-11-06\.pdf$/, name);
    }
    assert.equal(reportFileName('日本語', NOW, 'pdf'), 'triagem-vaga-2026-11-06.pdf');
    assert.equal(reportFileName('CON', NOW, 'pdf'), 'triagem-con-2026-11-06.pdf');
  });

  test('título comprido é cortado', () => {
    assert.ok(reportFileName('a'.repeat(500), NOW, 'pdf').length < 80);
  });
});
