// F10b no Chromium: modelos de mensagem (RF-80 a RF-82) e Top 10 compacto. Perfis, nomes e links são inventados, e nenhum teste
// acessa o LinkedIn: o pedido seria abortado por context.route e só o endereço ficaria registrado.
import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { defaultBody, fillTemplate } from '../../src/core/messages/templates.ts';
import { ROOT, extensionRequests, launch, netLogExtensionJobs, openPanel, readStorage, resetSession, resetStorage, trapLinkedIn } from './harness.ts';
import type { Harness } from './harness.ts';
import { seeds15, seedWorkspace } from './panel-triage-kit.ts';
import { ANA, BIA, RESPONSIBLE, seedTwoJobs } from './panel-privacy-kit.ts';

const DIST = path.join(ROOT, 'dist');

let h: Harness;
let linkedinHits: string[];

before(async () => {
  h = await launch(DIST);
  linkedinHits = await trapLinkedIn(h);
});

after(async () => {
  if (h === undefined) return;
  const { fromExtension } = netLogExtensionJobs(await h.close());
  assert.deepEqual(fromExtension, [], 'nenhum pedido de rede começou na extensão');
});

beforeEach(async () => {
  await resetStorage(h);
  await resetSession(h);
  linkedinHits.length = 0;
});

const expectedText = (id: 'first_contact' | 'follow_up' | 'closing', name: string, days = 180): string =>
  fillTemplate(defaultBody(id, days), { nome: name, vaga: 'Pessoa desenvolvedora Java', responsavel: RESPONSIBLE.name, contato: RESPONSIBLE.contact });

describe('F10b: modelos de mensagem (RF-80 a RF-82)', { timeout: 300_000 }, () => {
  test('Copiar entrega o texto certo, não abre nada e depois oferece marcar "informado em"', async () => {
    await seedTwoJobs(h, [{ ...ANA, jobs: ['a'] }]);
    const { page, errors } = await openPanel(h);
    // O que o painel entrega à área de transferência é capturado aqui: a leitura do clipboard real não é permitida a páginas de extensão.
    await page.evaluate(() => {
      const spy = window as unknown as { __copied: string[] };
      spy.__copied = [];
      navigator.clipboard.writeText = async (text: string): Promise<void> => void spy.__copied.push(text);
    });
    const popups: string[] = [];
    h.context.on('page', (opened) => popups.push(opened.url()));
    const pagesBefore = h.context.pages().length;

    await page.locator('li.tr-person', { hasText: ANA.name }).getByRole('button', { name: 'Ver detalhe' }).click();
    await page.getByRole('heading', { name: `Detalhe: ${ANA.name}`, level: 2 }).waitFor();
    assert.equal(await page.getByText('Já enviou a mensagem?').count(), 0, 'sem copiar não há oferta');
    assert.equal(await page.getByLabel('Mensagem pronta').inputValue(), expectedText('first_contact', ANA.name));
    assert.equal(await page.getByText('Ainda não informado.').count(), 1);

    await page.getByRole('button', { name: 'Copiar', exact: true }).click();
    await page.getByText('Mensagem copiada.').waitFor();
    assert.deepEqual(await page.evaluate(() => (window as unknown as { __copied: string[] }).__copied), [expectedText('first_contact', ANA.name)]);
    await page.getByText('Já enviou a mensagem?').waitFor();

    // Nenhum gesto além de copiar: nenhuma aba nova, nenhum pedido, nenhum envio.
    assert.equal(h.context.pages().length, pagesBefore);
    assert.deepEqual(popups, []);
    assert.deepEqual(linkedinHits, []);
    assert.deepEqual(extensionRequests(h), []);
    assert.equal(await page.locator('main a[href]:not([href^="https://www.linkedin.com/in/"])').count(), 0);
    // O texto copiado nunca vai para o console.
    assert.deepEqual(errors, []);
    await page.close();
  });

  test('os três modelos preenchem certo, com o prazo atual', async () => {
    await seedTwoJobs(h, [{ ...ANA, jobs: ['a'] }]);
    await h.worker.evaluate(async () => {
      const all = (await chrome.storage.local.get('settings')) as { settings: Record<string, unknown> };
      await chrome.storage.local.set({ settings: { ...all.settings, retentionDays: 90 } });
    });
    const { page } = await openPanel(h);
    await page.getByRole('button', { name: 'Ver detalhe' }).first().click();
    const box = page.getByLabel('Mensagem pronta');
    assert.equal(await box.inputValue(), expectedText('first_contact', ANA.name, 90));
    assert.match(await box.inputValue(), /Eu os guardo por 90 dias/);
    await page.getByLabel('Modelo').selectOption('follow_up');
    assert.equal(await box.inputValue(), expectedText('follow_up', ANA.name));
    await page.getByLabel('Modelo').selectOption('closing');
    assert.equal(await box.inputValue(), expectedText('closing', ANA.name, 90));
    assert.match(await box.inputValue(), /serão apagados/);
    await page.close();
  });

  test('marcar "informado em" tira o selo "Não informado", e dá para desfazer', async () => {
    await seedTwoJobs(h, [
      { ...ANA, jobs: ['a'] },
      { ...BIA, jobs: ['a'] },
    ]);
    const { page, errors } = await openPanel(h);
    const badges = (): Promise<number> => page.locator('[data-kind="top_ten"] .tr-pill', { hasText: 'Não informado' }).count();
    assert.equal(await badges(), 2);
    await page.locator('li.tr-person', { hasText: ANA.name }).getByRole('button', { name: 'Ver detalhe' }).click();
    await page.getByRole('button', { name: 'Copiar', exact: true }).click();
    await page.getByRole('button', { name: 'Marcar como informado hoje' }).click();
    await page.getByText(/^Informado em \d{2}\/\d{2}\/\d{4}\.$/).waitFor();
    const saved = Object.values(await readStorage(h)).filter((v) => (v as { name?: string }).name === ANA.name) as { informedAt: number | null; updatedAt: number }[];
    assert.equal(typeof saved[0]?.informedAt, 'number');

    await page.getByRole('button', { name: 'Voltar ao início' }).click();
    await page.locator('[data-kind="top_ten"]').waitFor();
    assert.equal(await badges(), 1, 'só a Beatriz continua com o selo');
    assert.equal(await page.locator('li.tr-person', { hasText: ANA.name }).locator('.tr-pill', { hasText: 'Não informado' }).count(), 0);

    await page.locator('li.tr-person', { hasText: ANA.name }).getByRole('button', { name: 'Ver detalhe' }).click();
    await page.getByRole('button', { name: /^Desfazer/ }).click();
    await page.getByText('Ainda não informado.').waitFor();
    await page.getByRole('button', { name: 'Voltar ao início' }).click();
    await page.locator('[data-kind="top_ten"]').waitFor();
    assert.equal(await badges(), 2);
    assert.deepEqual(errors, []);
    await page.close();
  });

  test('Ajustes: editar um modelo, ver a mudança no detalhe e restaurar o padrão', async () => {
    await seedTwoJobs(h, [{ ...ANA, jobs: ['a'] }]);
    const { page, errors } = await openPanel(h);
    await page.getByRole('button', { name: 'Ajustes', exact: true }).click();
    await page.getByRole('heading', { name: 'Modelos de mensagem', level: 3 }).waitFor();
    const field = page.getByLabel('Texto do modelo Retorno');
    assert.equal(await field.inputValue(), defaultBody('follow_up', 180));
    assert.equal(await page.getByRole('button', { name: 'Restaurar o padrão: Retorno' }).isDisabled(), true);

    await field.fill('Oi {nome}, tudo bem? Sobre {vaga}, falo de {contato}.\nAbraço');
    await page.getByRole('button', { name: 'Salvar modelo: Retorno' }).click();
    await page.getByText('Modelo salvo.').waitFor();
    await field.fill('');
    await page.getByRole('button', { name: 'Salvar modelo: Retorno' }).click();
    await page.getByText('O modelo não pode ficar vazio.', { exact: false }).waitFor();

    await page.getByRole('button', { name: 'Voltar ao início' }).click();
    await page.getByRole('button', { name: 'Ver detalhe' }).first().click();
    await page.getByLabel('Modelo').selectOption('follow_up');
    assert.equal(await page.getByLabel('Mensagem pronta').inputValue(), `Oi ${ANA.name}, tudo bem? Sobre Pessoa desenvolvedora Java, falo de ${RESPONSIBLE.contact}.\nAbraço`);

    await page.getByRole('button', { name: 'Ajustes', exact: true }).click();
    await page.getByRole('button', { name: 'Restaurar o padrão: Retorno' }).click();
    await page.getByText('Modelo restaurado ao padrão.').waitFor();
    assert.equal(await page.getByLabel('Texto do modelo Retorno').inputValue(), defaultBody('follow_up', 180));
    assert.deepEqual(errors, []);
    await page.close();
  });

  test('marcador sem dado continua visível e a tela avisa', async () => {
    await seedTwoJobs(h, [{ ...ANA, jobs: ['a'] }]);
    await h.worker.evaluate(async () => {
      const all = (await chrome.storage.local.get('settings')) as { settings: Record<string, unknown> };
      await chrome.storage.local.set({ settings: { ...all.settings, responsibleContact: '' } });
    });
    const { page } = await openPanel(h);
    await page.getByRole('button', { name: 'Ver detalhe' }).first().click();
    assert.match(await page.getByLabel('Mensagem pronta').inputValue(), /\{contato\}/);
    await page.getByText('Faltam dados', { exact: false }).waitFor();
    await page.close();
  });

  test('nome malicioso aparece como texto na mensagem pronta', async () => {
    const evil = '<img src=x onerror="window.__invadido=1"> <b>Negrito</b>';
    await seedTwoJobs(h, [{ name: evil, slug: 'ataque', skills: ['Java'], jobs: ['a'] }]);
    const { page, errors } = await openPanel(h);
    await page.getByRole('button', { name: 'Ver detalhe' }).first().click();
    assert.match(await page.getByLabel('Mensagem pronta').inputValue(), /<img src=x onerror="window\.__invadido=1"> <b>Negrito<\/b>/);
    assert.equal(await page.locator('main img, main b').count(), 0);
    assert.equal(await page.evaluate(() => (window as unknown as { __invadido?: number }).__invadido), undefined);
    assert.deepEqual(errors, []);
    await page.close();
  });
});

describe('F10b: Top 10 compacto', { timeout: 300_000 }, () => {
  test('cada pessoa ocupa até cerca de 80 px em 360 px, com Gerar PDF e Ver todos antes da lista', async () => {
    await seedWorkspace(h, seeds15());
    const { page, errors } = await openPanel(h);
    await page.setViewportSize({ width: 360, height: 760 });
    const box = page.locator('[data-kind="top_ten"]');
    await box.waitFor();
    const heights = await box.locator('li.tr-person').evaluateAll((items) => items.map((item) => Math.round(item.getBoundingClientRect().height)));
    assert.equal(heights.length, 10);
    assert.ok(Math.max(...heights) <= 84, `altura por pessoa: ${heights.join(', ')}`);

    // Gerar PDF e Ver todos vêm antes da primeira pessoa e aparecem sem rolar.
    const order = await box.evaluate((el) => {
      const pos = (node: Element | null): number => (node === null ? -1 : node.getBoundingClientRect().top);
      return { pdf: pos(el.querySelector('button.tr-btn--primary')), all: pos([...el.querySelectorAll('button')].find((b) => b.textContent === 'Ver todos') ?? null), list: pos(el.querySelector('ol')) };
    });
    assert.ok(order.pdf > 0 && order.pdf < order.list && order.all < order.list);
    assert.ok(order.pdf < 760, 'Gerar PDF visível sem rolar');

    // Primeira linha: posição, nome como link seguro e nota com faixa. Segunda: cargo, etapa e selo.
    const first = box.locator('li.tr-person').first();
    assert.equal(await first.locator('.tr-person__rank').innerText(), '1º');
    const link = first.locator('a.tr-person__name');
    assert.match((await link.getAttribute('href')) ?? '', /^https:\/\/www\.linkedin\.com\/in\/pessoa-01\/$/);
    assert.equal(await link.getAttribute('target'), '_blank');
    assert.equal(await link.getAttribute('rel'), 'noopener noreferrer');
    assert.equal(await first.locator('.tr-score__band').innerText(), 'Forte');
    assert.match(await first.locator('.tr-person__bottom').innerText(), /Novo/);
    assert.equal(await first.locator('.tr-person__bottom .tr-pill', { hasText: 'Não informado' }).count(), 1);
    assert.equal(await first.locator('img').count(), 0, 'sem foto');

    // O detalhe é um botão com nome acessível próprio, alcançável pelo teclado.
    const detail = first.getByRole('button', { name: /^Ver detalhe: / });
    await link.focus();
    await page.keyboard.press('Tab');
    assert.equal(await detail.evaluate((el) => el === document.activeElement), true);
    await page.keyboard.press('Enter');
    await page.getByRole('heading', { name: /^Detalhe: /, level: 2 }).waitFor();
    assert.deepEqual(linkedinHits, []);
    assert.deepEqual(errors, []);
    await page.close();
  });
});
