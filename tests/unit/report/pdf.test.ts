// O PDF, lido de volta com o pdfjs-dist (CA-13, CA-27, RF-70 a RF-75).
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { buildReport } from '../../../src/core/report/model.ts';
import type { ReportScope } from '../../../src/core/report/model.ts';
import { FOOTER_PHRASE, MISSING_NOTICE, PERSONAL_DATA_NOTICE, renderPdf } from '../../../src/core/report/pdf.ts';
import { JOB, NOW, candidate, latin1, readPdf } from './helpers.ts';
import type { Spec } from './helpers.ts';

/** O texto lido volta em pedaços separados por quebra de linha; para procurar frase inteira, junta tudo com espaço. */
function flatten(text: string): string {
  return text.split(String.fromCharCode(10)).join(' ');
}

function make(specs: readonly Spec[], scope: ReportScope = 'all', includeNotes = false) {
  return renderPdf(buildReport({ job: JOB, candidates: specs.map(candidate), scope, includeNotes, now: NOW }));
}

describe('CA-13: PDF lido de volta', () => {
  const specs: Spec[] = [
    { id: 'a', name: 'Ana Souza', score: 92, band: 'strong' },
    { id: 'b', name: 'Bruno Lima', score: 61, band: 'partial', profileUrl: 'https://www.linkedin.com/in/bruno-lima/' },
    { id: 'c', name: 'Carla Dias', score: 20, band: 'weak', profileUrl: 'http://www.linkedin.com/in/carla/' },
    { id: 'd', name: 'Davi Rocha', score: 10, band: 'weak', profileUrl: 'javascript:alert(1)' },
  ];

  test('traz título, data, requisitos, nomes, notas, faixas e a frase de apoio em toda página', async () => {
    const { bytes } = make(specs);
    const pdf = await readPdf(bytes);
    const flat = flatten(pdf.text);
    assert.ok(pdf.pages.length <= 2);
    assert.ok(flat.includes(MISSING_NOTICE), 'a legenda de "Faltou" (RF-50)');
    for (const piece of ['Triagem+: Pessoa Desenvolvedora Java Sênior', '06/11/2026', 'Spring Boot', 'Obrigatório', 'Desejável', '1. Ana Souza', '2. Bruno Lima', 'Nota 92 · Forte', 'Nota 61 · Parcial', 'Nota 20 · Fraco', 'Java, Spring Boot, Inglês', 'AWS', 'Em análise', '6 anos e 3 meses', 'Engenheira de Software', FOOTER_PHRASE, PERSONAL_DATA_NOTICE, 'Gerado em 06/11/2026.', `Página 1 de ${pdf.pages.length}`]) {
      assert.ok(flat.includes(piece), `falta: ${piece}`);
    }
    assert.equal(pdf.pages[0]?.width.toFixed(0), '595');
    assert.equal(pdf.pages[0]?.height.toFixed(0), '842');
  });

  test('anotações trazem só os links https esperados', async () => {
    const pdf = await readPdf(make(specs).bytes);
    assert.deepEqual(pdf.links, ['https://www.linkedin.com/in/pessoa-a/', 'https://www.linkedin.com/in/bruno-lima/']);
    assert.ok(pdf.text.includes('http://www.linkedin.com/in/carla/'), 'link http sai como texto');
    assert.ok(pdf.text.includes('javascript:alert(1)'));
  });

  test('nada de código executável nem recurso externo nos bytes', () => {
    const raw = latin1(make(specs).bytes);
    for (const bad of ['/JS', '/JavaScript', '/OpenAction', '/Launch', '/EmbeddedFile', '/AA', '/XFA', '/SubmitForm', '/GoToR', '/Image', '/XObject', '/RichMedia']) {
      assert.ok(!raw.includes(bad), `achou ${bad}`);
    }
    assert.ok(!/\/URI\s*\(http:/.test(raw));
    assert.equal([...raw.matchAll(/\/URI \(([^)]*)\)/g)].every((m) => (m[1] ?? '').startsWith('https://')), true);
    assert.ok(raw.startsWith('%PDF-1.4'));
    assert.ok(raw.trimEnd().endsWith('%%EOF'));
  });

  test('nome malicioso sai como texto e não quebra o arquivo', async () => {
    const evil = ['Ana) Tj (x', 'Ana\\) Tj ET /JS (app.alert(1)) \\', 'Ana) >> /OpenAction << /S /JavaScript /JS (x) >> (', '(((', '\u0000\u0001Bia\u001f\u007f'];
    const { bytes } = make(evil.map((name, i) => ({ id: `e${i}`, name, score: 90 - i })));
    const pdf = await readPdf(bytes);
    assert.ok(pdf.text.includes('1. Ana) Tj (x'));
    assert.ok(pdf.text.includes('2. Ana\\) Tj ET /JS (app.alert(1)) \\') || pdf.text.includes('Ana\\) Tj ET'));
    assert.ok(pdf.text.includes('5. Bia'));
    assert.equal(pdf.links.length, evil.length, 'um link por pessoa, nenhum a mais');
    // O texto malicioso só pode existir escapado: os parênteses soltos não chegam crus ao arquivo.
    const raw = latin1(bytes);
    assert.ok(!raw.includes('(Ana) Tj (x'));
    assert.ok(!/\/Type \/Action/.test(raw));
    assert.equal(raw.match(/\/Type \/Catalog[^>]*>>/)?.[0], '/Type /Catalog /Pages 2 0 R >>');
    assert.ok(!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(raw.slice(raw.indexOf('stream\n'), raw.indexOf('endstream'))));
  });

  test('link com usuário e senha, espaço ou ponto de exclamação final não vira anotação perigosa', async () => {
    const pdf = await readPdf(make([{ id: 'a', profileUrl: 'https://user:pw@evil.example/' }, { id: 'b', profileUrl: 'https://a.example/x y' }, { id: 'c', profileUrl: '' }]).bytes);
    assert.deepEqual(pdf.links, []);
  });
});

describe('CA-27: acentos e outros alfabetos', () => {
  test('todos os acentos do português voltam certos', async () => {
    const accents = 'ã õ ç á é í ó ú â ê ô à ü Ã Õ Ç Á É Í Ó Ú Â Ê Ô À Ü ñ';
    const dash = 'a – b — c “aspas” ‘simples’ · ponto • €';
    const { bytes, replacedCount } = make([{ id: 'a', name: `Joana ${accents}`, currentTitle: dash, notes: 'ação, coração, útil' }], 'all', true);
    const pdf = await readPdf(bytes);
    assert.equal(replacedCount, 0);
    assert.ok(pdf.text.includes(`Joana ${accents}`), pdf.text.slice(0, 400));
    assert.ok(pdf.text.includes(dash));
    assert.ok(pdf.text.includes('ação, coração, útil'));
    assert.ok(pdf.text.includes('Sênior'));
  });

  test('acento decomposto (a + til) também sai certo', async () => {
    const { bytes, replacedCount } = make([{ id: 'a', name: 'João Sênior' }]);
    assert.equal(replacedCount, 0);
    assert.ok((await readPdf(bytes)).text.includes('João Sênior'));
  });

  test('nome em japonês gera "?" e conta as letras trocadas', async () => {
    const { bytes, replacedCount } = make([{ id: 'a', name: '山田 太郎' }, { id: 'b', name: 'سارة' }, { id: 'c', name: 'Emoji 😀' }]);
    const pdf = await readPdf(bytes);
    assert.equal(replacedCount, 4 + 4 + 1);
    assert.ok(pdf.text.includes('?? ??'));
    assert.ok(pdf.text.includes('Emoji ?'));
  });

  test('quebras de linha e tabulação viram espaço, e caracteres invisíveis somem sem contar', async () => {
    const { bytes, replacedCount } = make([{ id: 'a', name: 'Ana\tSouza\nLima​­x' }]);
    assert.equal(replacedCount, 0);
    assert.ok((await readPdf(bytes)).text.includes('Ana Souza Lima'));
  });
});

describe('ordem, escopo, notas e vazio', () => {
  const fifteen: Spec[] = Array.from({ length: 15 }, (_, i) => ({ id: `c${String(i).padStart(2, '0')}`, name: `Pessoa ${String.fromCharCode(65 + i)}`, score: 100 - i * 4, addedAt: i }));

  test('top10 com 15 traz 10 em ordem; all traz 15', async () => {
    const top = await readPdf(make([...fifteen].reverse(), 'top10').bytes);
    const names = [...top.text.matchAll(/^(\d+)\. (Pessoa \w)$/gm)].map((m) => `${m[1]} ${m[2]}`);
    assert.deepEqual(names, Array.from({ length: 10 }, (_, i) => `${i + 1} Pessoa ${String.fromCharCode(65 + i)}`));
    assert.ok(top.text.includes('Os 10 melhores entre 15 candidatos'));
    const all = await readPdf(make([...fifteen].reverse(), 'all').bytes);
    assert.equal([...all.text.matchAll(/^\d+\. Pessoa \w$/gm)].length, 15);
  });

  test('notas só com includeNotes', async () => {
    const spec: Spec = { id: 'a', notes: 'combinar horário\nsegunda parágrafo' };
    const off = await readPdf(make([spec], 'all', false).bytes);
    assert.ok(!off.text.includes('combinar horário'));
    assert.ok(!off.text.includes('Notas'));
    const on = await readPdf(make([spec], 'all', true).bytes);
    assert.ok(on.text.includes('combinar horário'));
    assert.ok(on.text.includes('segunda parágrafo'));
    assert.ok((await readPdf(make([{ id: 'a' }], 'all', true).bytes)).text.includes('Sem notas'));
  });

  test('sem nota avaliada aparece como "sem nota"', async () => {
    const pdf = await readPdf(make([{ id: 'a', statuses: ['needs_reanalysis', 'needs_reanalysis', 'needs_reanalysis', 'needs_reanalysis'], score: 0, band: 'weak' }]).bytes);
    assert.ok(pdf.text.includes('Nota: sem nota'));
    assert.ok(pdf.text.includes('A rever'));
    const flat = flatten(pdf.text);
    assert.ok(flat.includes('Faltou   Nenhum'), 'o que precisa analisar de novo não aparece como falta');
    assert.ok(flat.includes('A rever   Java, Spring Boot, AWS, Inglês'));
    assert.ok(flatten(pdf.text).includes('Eles não pesam na nota.'));
  });

  test('vaga sem candidatos gera PDF válido dizendo isso', async () => {
    const { bytes } = make([]);
    const pdf = await readPdf(bytes);
    assert.equal(pdf.pages.length, 1);
    assert.ok(pdf.text.includes('Nenhum candidato nesta vaga.'));
    assert.ok(pdf.text.includes(FOOTER_PHRASE));
    assert.ok(flatten(pdf.text).includes(PERSONAL_DATA_NOTICE));
  });

  test('vaga sem requisitos e com título enorme não quebra', async () => {
    const job = { ...JOB, title: 'Pessoa desenvolvedora '.repeat(40), requirements: [] };
    const { bytes } = renderPdf(buildReport({ job, candidates: [candidate({ id: 'a' })], scope: 'all', includeNotes: false, now: NOW }));
    const pdf = await readPdf(bytes);
    assert.ok(pdf.text.includes('Esta vaga ainda não tem requisitos.'));
  });
});

describe('paginação e quebra de linha', () => {
  test('muitos candidatos paginam sem linha cortada nem fora da página', async () => {
    const specs: Spec[] = Array.from({ length: 80 }, (_, i) => ({ id: `p${String(i).padStart(3, '0')}`, name: `Pessoa Número ${i + 1}`, score: 100 - (i % 90), addedAt: i, notes: i % 7 === 0 ? 'nota '.repeat(120) : '' }));
    const pdf = await readPdf(make(specs, 'all', true).bytes);
    assert.ok(pdf.pages.length > 5);
    pdf.pages.forEach((page, index) => {
      assert.ok(page.text.includes(`Página ${index + 1} de ${pdf.pages.length}`));
      assert.ok(page.text.includes(FOOTER_PHRASE));
      for (const item of page.items) {
        assert.ok(item.x >= 40 && item.x + item.width <= page.width - 40 + 0.5, `fora das margens: ${item.str} x=${item.x} w=${item.width}`);
        assert.ok(item.y > 20 && item.y < page.height - 20, `fora da página: ${item.str} y=${item.y}`);
      }
      const body = page.items.filter((item) => item.y > 50);
      assert.ok(body.every((item) => item.y > 62), 'texto do corpo invadiu o rodapé');
    });
    assert.equal([...pdf.text.matchAll(/^\d+\. Pessoa Número \d+$/gm)].length, 80);
    assert.ok(flatten(pdf.pages.at(-1)?.text ?? '').includes(PERSONAL_DATA_NOTICE));
    assert.ok(!pdf.pages.slice(0, -1).some((p) => p.text.includes('Gerado em')));
  });

  test('bloco de um candidato não é partido entre páginas quando cabe numa só', async () => {
    const specs: Spec[] = Array.from({ length: 30 }, (_, i) => ({ id: `q${String(i).padStart(2, '0')}`, name: `Pessoa ${i + 1}`, score: 100 - i }));
    const pdf = await readPdf(make(specs).bytes);
    for (const page of pdf.pages) {
      const heads = (page.text.match(/^\d+\. Pessoa \d+$/gm) ?? []).length;
      const etapas = (page.text.match(/^Etapa$/gm) ?? []).length;
      assert.equal(heads, etapas, 'cabeçalho e etapa do mesmo bloco na mesma página');
    }
  });

  test('textos longos e links longos quebram dentro da margem', async () => {
    const longLink = `https://www.linkedin.com/in/${'a'.repeat(200)}/`;
    const spec: Spec = { id: 'a', name: 'Nome Muito Comprido '.repeat(12), currentTitle: 'Cargo '.repeat(80), profileUrl: longLink, notes: 'x'.repeat(300) };
    const pdf = await readPdf(make([spec], 'all', true).bytes);
    const page = pdf.pages[0];
    assert.ok(page);
    for (const item of page.items) assert.ok(item.x + item.width <= page.width - 48 + 1, `estourou: ${item.str.slice(0, 20)}`);
    assert.ok(pdf.links.length >= 2, 'link longo quebrado em vários pedaços clicáveis');
    assert.ok(pdf.links.every((url) => url === longLink));
    assert.ok((pdf.text.match(/a/g) ?? []).length >= 200);
    assert.ok(flatten(pdf.text).replace(/ /g, '').includes('x'.repeat(300)));
  });
});

describe('desempenho', () => {
  test('500 candidatos em menos de 1 segundo', () => {
    const specs: Spec[] = Array.from({ length: 500 }, (_, i) => ({ id: `z${String(i).padStart(3, '0')}`, name: `Pessoa Fictícia Número ${i}`, score: i % 101, addedAt: i, currentTitle: 'Engenheira de Software Sênior de Plataforma' }));
    const model = buildReport({ job: JOB, candidates: specs.map(candidate), scope: 'all', includeNotes: false, now: NOW });
    const start = performance.now();
    const { bytes } = renderPdf(model);
    const elapsed = performance.now() - start;
    assert.ok(bytes.length > 100_000);
    assert.ok(elapsed < 1000, `levou ${elapsed.toFixed(0)} ms`);
  });
});

describe('lista filtrada (RF-71)', () => {
  test('o PDF diz N de M candidatos e quais filtros valem', async () => {
    const model = buildReport({ job: JOB, candidates: [candidate({ id: 'a', name: 'Ana Souza' })], scope: 'all', includeNotes: false, now: NOW, allCount: 3, filterTexts: ['termo "Java"', 'só favoritos'] });
    const pdf = await readPdf(renderPdf(model).bytes);
    const flat = flatten(pdf.text);
    assert.ok(flat.includes('1 de 3 candidatos, com filtro: termo "Java"; só favoritos'));
  });
});
