// Jornada do painel no Chromium (F07): avisos e aceite (CA-01), vagas, requisitos com a trava, busca, copiar e abrir.
// Nenhum teste acessa o LinkedIn: o pedido é abortado por context.route e só o endereço é conferido.
import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import type { Page } from 'playwright';
import { TOPIC_REASONS } from '../../src/core/guard/index.ts';
import { peopleSearchUrl } from '../../src/core/search/build.ts';
import { ROOT, launch, openPanel, readStorage, resetStorage, trapLinkedIn } from './harness.ts';
import type { Harness } from './harness.ts';

const DIST = path.join(ROOT, 'dist');

const VAGA_PT = [
  'Pessoa Desenvolvedora Back-end Sênior',
  '',
  'Requisitos:',
  '- Java 11 ou superior',
  '- Experiência com Spring Boot e Kafka',
  '- Mínimo de 5 anos de experiência',
  '- Inglês avançado',
  '',
  'Diferenciais:',
  '- Docker e Kubernetes',
  '',
  'Benefícios: plano de saúde e vale-refeição.',
].join('\n');

async function acceptTerms(page: Page, name = 'Marina Souza', contact = 'marina@exemplo.test'): Promise<void> {
  await page.getByLabel('Seu nome').fill(name);
  await page.getByLabel('Seu contato').fill(contact);
  await page.getByRole('button', { name: 'Li os avisos e aceito' }).click();
  await page.getByRole('heading', { name: 'Vamos começar pela vaga' }).waitFor();
}

async function createJob(page: Page, title: string, text: string): Promise<void> {
  await page.getByRole('button', { name: 'Nova vaga' }).click();
  await page.getByLabel('Título da vaga').fill(title);
  await page.getByLabel('Texto da vaga').fill(text);
  await page.getByRole('button', { name: 'Salvar e ver requisitos' }).click();
}

/** Espera o topo mostrar exatamente esta vaga ativa (RF-37). */
async function activeJobIs(page: Page, title: string): Promise<void> {
  await page.getByTestId('active-job').and(page.getByText(title, { exact: true })).waitFor();
}

async function useAllSuggestions(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Usar os marcados' }).click();
  await page.getByRole('list', { name: 'Requisitos cadastrados' }).waitFor();
}

describe('painel: avisos, vagas, requisitos e busca', { timeout: 180_000 }, () => {
  let h: Harness;
  let linkedinHits: string[];
  before(async () => {
    h = await launch(DIST);
    linkedinHits = await trapLinkedIn(h);
  });
  after(async () => {
    await (h as Harness | undefined)?.close();
  });
  beforeEach(async () => {
    await resetStorage(h);
    linkedinHits.length = 0;
  });

  test('CA-01: sem aceite só aparecem os avisos e o aceite; nenhuma tela de trabalho abre', async () => {
    const { page, errors } = await openPanel(h);
    await page.getByRole('heading', { name: 'Antes de começar' }).waitFor();
    // Os cinco avisos de RF-01, em blocos curtos.
    for (const title of ['Você responde pelos dados', 'Risco para a sua conta do LinkedIn', 'Sem relação com o LinkedIn', 'A nota é só apoio', 'Isto não é orientação jurídica']) {
      await page.getByRole('heading', { name: title }).waitFor();
    }
    await page.getByText('não trazem exceção para leitura feita por clique').waitFor();
    assert.equal(await page.getByRole('button', { name: 'Nova vaga' }).count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Criar vaga' }).count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Ajustes' }).count(), 0);
    assert.equal(await page.getByRole('region', { name: 'Vaga ativa' }).count(), 0);
    assert.equal(await page.locator('[data-kind="job_summary"], [data-kind="job_list"], [data-kind="no_job"]').count(), 0);
    // Sem aceite, tentar seguir só mostra o que falta e nada é guardado.
    await page.getByRole('button', { name: 'Li os avisos e aceito' }).click();
    await page.getByText('Escreva o seu nome.').waitFor();
    await page.getByText('Escreva um contato, como e-mail ou telefone.').waitFor();
    assert.equal(await page.getByRole('heading', { name: 'Vamos começar pela vaga' }).count(), 0);
    const stored = await readStorage(h);
    assert.equal(stored['settings'], undefined);
    assert.deepEqual(errors, []);
    await page.close();
  });

  test('o aceite grava responsável, prazo, versão e data, e libera o trabalho', async () => {
    const { page, errors } = await openPanel(h);
    assert.equal(await page.getByLabel('Guardar candidatos por quantos dias').inputValue(), '180');
    // Prazo fora da faixa é recusado com explicação.
    await page.getByLabel('Seu nome').fill('Marina Souza');
    await page.getByLabel('Seu contato').fill('marina@exemplo.test');
    await page.getByLabel('Guardar candidatos por quantos dias').fill('10');
    await page.getByRole('button', { name: 'Li os avisos e aceito' }).click();
    await page.getByText('O prazo precisa ser um número inteiro de 30 a 365 dias.').waitFor();
    assert.equal(await page.getByLabel('Seu nome').inputValue(), 'Marina Souza', 'o que foi digitado não se perde');
    await page.getByLabel('Guardar candidatos por quantos dias').fill('120');
    const before = Date.now();
    await page.getByRole('button', { name: 'Li os avisos e aceito' }).click();
    await page.getByRole('heading', { name: 'Vamos começar pela vaga' }).waitFor();
    const settings = (await readStorage(h))['settings'] as { responsibleName: string; responsibleContact: string; retentionDays: number; acceptances: { terms: { version: number; at: number } } };
    assert.equal(settings.responsibleName, 'Marina Souza');
    assert.equal(settings.responsibleContact, 'marina@exemplo.test');
    assert.equal(settings.retentionDays, 120);
    assert.equal(settings.acceptances.terms.version, 1);
    assert.ok(settings.acceptances.terms.at >= before && settings.acceptances.terms.at <= Date.now());
    await page.getByRole('button', { name: 'Ajustes' }).waitFor();
    await activeJobIs(page, 'Nenhuma vaga ativa');
    // Ao abrir de novo o painel, o aceite continua valendo.
    const again = await openPanel(h);
    await again.page.getByRole('heading', { name: 'Vamos começar pela vaga' }).waitFor();
    assert.equal(await again.page.getByRole('heading', { name: 'Antes de começar' }).count(), 0);
    assert.deepEqual([...errors, ...again.errors], []);
    await again.page.close();
    await page.close();
  });

  test('criar vaga colando texto em português: sugestões, correção, obrigatório e desejável, anos mínimos', async () => {
    const { page, errors } = await openPanel(h);
    await acceptTerms(page);
    await createJob(page, 'Back-end sênior', VAGA_PT);
    await page.getByRole('heading', { name: 'Requisitos', exact: true }).waitFor();
    // O topo mostra a vaga ativa durante todo o trabalho (RF-37).
    await activeJobIs(page, 'Back-end sênior');
    await page.getByRole('heading', { name: 'Sugestões a partir do texto da vaga' }).waitFor();
    const names = await page.locator('input[name^="label-"]').evaluateAll((els) => els.map((el) => (el as HTMLInputElement).value));
    for (const expected of ['Java', 'Spring Boot', 'Apache Kafka']) assert.ok(names.some((n) => n.toLowerCase() === expected.toLowerCase()), `faltou a sugestão ${expected}: ${names.join(' | ')}`);
    await page.getByText('5 anos de experiência', { exact: true }).waitFor();
    // Corrige um nome, marca um como desejável e muda os anos mínimos antes de usar.
    const javaIndex = names.findIndex((n) => n.toLowerCase() === 'java');
    await page.locator(`#imp-${javaIndex}`).selectOption('preferred');
    await page.locator(`#years-${javaIndex}`).fill('3');
    await useAllSuggestions(page);
    const row = page.locator('[data-requirement="Java"]');
    await row.getByText('Desejável', { exact: true }).first().waitFor();
    await row.getByText('mínimo 3 anos').waitFor();
    const job = Object.entries(await readStorage(h)).find(([key]) => key.startsWith('job:'))?.[1] as { title: string; requirements: { label: string; importance: string; minYears?: number }[] };
    assert.equal(job.title, 'Back-end sênior');
    const java = job.requirements.find((r) => r.label === 'Java');
    assert.deepEqual([java?.importance, java?.minYears], ['preferred', 3]);
    assert.ok(job.requirements.some((r) => r.label === 'Apache Kafka' && r.importance === 'required'));
    assert.ok(job.requirements.some((r) => r.label === 'Docker' && r.importance === 'preferred'), 'diferenciais viram desejáveis');
    // Muda na lista salva: Java volta a obrigatório pelo seletor.
    await page.getByLabel('Importância de Java').selectOption('required');
    await row.getByText('Obrigatório', { exact: true }).first().waitFor();
    // Adiciona à mão por tipo.
    await page.getByLabel('Tipo').selectOption('language');
    await page.getByLabel('Requisito', { exact: true }).fill('Espanhol');
    await page.getByRole('button', { name: 'Adicionar requisito' }).click();
    await page.locator('[data-requirement="Espanhol"]').waitFor();
    await page.getByLabel('Tipo').selectOption('title_word');
    await page.getByLabel('Requisito', { exact: true }).fill('Sênior');
    await page.getByRole('button', { name: 'Adicionar requisito' }).click();
    await page.locator('[data-requirement="Sênior"]').waitFor();
    // Não existe campo de teto de experiência.
    assert.equal(await page.getByLabel(/máximo|teto|até/i).count(), 0);
    await page.getByText('A trava é uma lista de palavras e não pega tudo. O critério continua sendo sua responsabilidade.').waitFor();
    assert.deepEqual(errors, []);
    await page.close();
  });

  test('termo proibido é recusado com o motivo na tela, em requisito, excluído e frase da vaga', async () => {
    const { page, errors } = await openPanel(h);
    await acceptTerms(page);
    await createJob(page, 'Vaga com frase barrada', ['Requisitos:', '- Java', '- Aceitamos candidatos de até 35 anos', '- Docker'].join('\n'));
    await page.getByText('Frases que ficaram de fora', { exact: true }).waitFor();
    const ignored = page.getByTestId('ignored-lines');
    await ignored.getByText('até 35 anos').waitFor();
    await ignored.getByText(TOPIC_REASONS.age).waitFor();
    await useAllSuggestions(page);
    // Requisito à mão.
    await page.getByLabel('Requisito', { exact: true }).fill('mulheres');
    await page.getByRole('button', { name: 'Adicionar requisito' }).click();
    await page.getByText(TOPIC_REASONS.gender).waitFor();
    assert.equal(await page.locator('[data-requirement="mulheres"]').count(), 0);
    // Teto de experiência.
    await page.getByLabel('Requisito', { exact: true }).fill('no máximo 5 anos');
    await page.getByRole('button', { name: 'Adicionar requisito' }).click();
    await page.getByText(TOPIC_REASONS.max_experience).waitFor();
    // Termo excluído passa pela mesma trava.
    await page.getByLabel('Termo a excluir').fill('solteiro');
    await page.getByRole('button', { name: 'Excluir este termo' }).click();
    await page.getByText(TOPIC_REASONS.marital_family).waitFor();
    await page.getByLabel('Termo a excluir').fill('estágio');
    await page.getByRole('button', { name: 'Excluir este termo' }).click();
    await page.getByRole('list', { name: 'Termos excluídos' }).getByText('estágio').waitFor();
    const job = Object.entries(await readStorage(h)).find(([key]) => key.startsWith('job:'))?.[1] as { requirements: { label: string }[]; excludedTerms: string[] };
    assert.deepEqual(job.excludedTerms, ['estágio']);
    assert.ok(!job.requirements.some((r) => /mulheres|35|máximo/i.test(r.label)));
    assert.deepEqual(errors, []);
    await page.close();
  });

  test('busca: versão completa e curta, operadores, limites, aviso mensal e Copiar com o texto certo', async () => {
    const { page } = await openPanel(h);
    await acceptTerms(page);
    await createJob(page, 'Busca', ['Requisitos:', '- Java', '- Kafka', '- Docker', '- Kubernetes', '- Inglês avançado'].join('\n'));
    await useAllSuggestions(page);
    await page.getByRole('button', { name: 'Montar a busca' }).click();
    await page.getByRole('heading', { name: 'Busca para o LinkedIn' }).waitFor();
    await page.getByLabel('Completa').check();
    const full = await page.getByLabel('Texto da busca').inputValue();
    assert.match(full, /"Java" AND /);
    assert.match(await page.getByTestId('operators').innerText(), /operadores/);
    await page.getByText('Conta gratuita: o LinkedIn limita os operadores, mas não publica o número.').waitFor();
    await page.getByText('Sales Navigator: até 15 operadores por busca.').waitFor();
    await page.getByText('Recruiter e Recruiter Lite: sem limite de operadores.').waitFor();
    await page.getByText('limite mensal de buscas').waitFor();
    // Copiar é o botão principal e vem antes de Abrir no LinkedIn.
    const buttons = await page.locator('.tr-msg--search .tr-msg__actions a, .tr-msg--search .tr-msg__actions button').allInnerTexts();
    assert.deepEqual(buttons.slice(0, 2), ['Copiar', 'Abrir no LinkedIn']);
    await page.getByRole('button', { name: 'Copiar', exact: true }).click();
    await page.getByText('Busca copiada.').waitFor();
    assert.equal(await readClipboard(), full);
    // Versão curta.
    await page.getByLabel(/^Curta/).check();
    const short = await page.getByLabel('Texto da busca').inputValue();
    assert.notEqual(short, full);
    assert.ok(short.split(' AND ').length <= 3);
    await page.getByRole('button', { name: 'Copiar', exact: true }).click();
    await page.getByText('Busca copiada.').waitFor();
    assert.equal(await readClipboard(), short);
    assert.deepEqual(linkedinHits, [], 'copiar não abre nada');
    await page.close();
  });

  test('DP-26: a tela começa na curta, explica, respeita a escolha e leva a colar um perfil', async () => {
    const { page } = await openPanel(h);
    await acceptTerms(page);
    await createJob(page, 'Teste real', ['Requisitos:', '- C#', '- .NET', '- ASP.NET Core', '- Git'].join('\n'));
    await useAllSuggestions(page);
    await page.getByRole('button', { name: 'Montar a busca' }).click();
    await page.getByRole('heading', { name: 'Busca para o LinkedIn' }).waitFor();
    assert.equal(await page.getByLabel(/^Curta/).isChecked(), true);
    assert.equal(await page.getByLabel('Texto da busca').inputValue(), '"C#" AND ".NET" AND "ASP.NET"');
    await page.getByText('Começamos pela versão curta, que acha mais gente').waitFor();
    // A escolha da pessoa vale, e a tela diz o que fazer se vier zero.
    await page.getByLabel('Completa').check();
    assert.equal(await page.getByLabel('Texto da busca').inputValue(), '"C#" AND ".NET" AND "ASP.NET" AND "Git"');
    assert.match(await page.getByTestId('operators').innerText(), /3 operadores/);
    await page.getByText('Se o LinkedIn disser “Nenhum resultado”').waitFor();
    assert.equal(await page.getByText('Começamos pela versão curta').count(), 0);
    await page.getByRole('button', { name: 'Colar um perfil' }).click();
    await page.getByRole('heading', { name: 'Colar o perfil' }).waitFor();
    await page.close();
  });

  test('com sugestões na tela não dá para seguir para a busca, e voltar a uma vaga sem requisitos traz as sugestões de novo', async () => {
    const { page } = await openPanel(h);
    await acceptTerms(page);
    await createJob(page, 'Sem aplicar', ['Requisitos:', '- C#', '- .NET'].join('\n'));
    await page.getByRole('button', { name: 'Usar os marcados' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Montar a busca' }).count(), 0, 'seguir agora perderia as sugestões');
    // Sair por outro caminho e voltar não perde o trabalho.
    await page.getByRole('button', { name: 'Voltar ao início' }).click();
    await page.getByRole('button', { name: 'Requisitos' }).click();
    await page.getByRole('button', { name: 'Usar os marcados' }).click();
    await page.getByRole('list', { name: 'Requisitos cadastrados' }).waitFor();
    await page.getByRole('button', { name: 'Montar a busca' }).click();
    assert.equal(await page.getByLabel('Texto da busca').inputValue(), '"C#" AND ".NET"');
    await page.close();
  });

  test('busca sem texto diz o motivo: sem requisitos, só desejáveis ou só tempo de experiência', async () => {
    const { page } = await openPanel(h);
    await acceptTerms(page);
    const openSearch = async (text: string): Promise<void> => {
      await createJob(page, 'Motivo', text);
      await useAllSuggestions(page);
      await page.getByRole('button', { name: 'Montar a busca' }).click();
      await page.getByRole('heading', { name: 'Busca para o LinkedIn' }).waitFor();
    };
    await openSearch('Desejável\n- C#\n- Git');
    await page.getByText('Todos os requisitos desta vaga estão como Desejável').waitFor();
    assert.equal(await page.getByLabel('Texto da busca').count(), 0);
    await page.getByRole('button', { name: 'Voltar ao início' }).click();
    await page.getByRole('button', { name: 'Trocar' }).click();
    await openSearch('Requisitos:\n- 5 anos de experiência');
    await page.getByText('são só de tempo de experiência').waitFor();
    await page.close();
  });

  test('Copiar cai na alternativa quando navigator.clipboard falha, e mostra o texto para copiar à mão se nada funcionar', async () => {
    const { page } = await openPanel(h);
    await acceptTerms(page);
    await createJob(page, 'Cópia', 'Requisitos:\n- Java\n- Kafka');
    await useAllSuggestions(page);
    await page.getByRole('button', { name: 'Montar a busca' }).click();
    const text = await page.getByLabel('Texto da busca').inputValue();
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.reject(new Error('negado')) } });
    });
    await page.getByRole('button', { name: 'Copiar', exact: true }).click();
    await page.getByTestId('copy-status').filter({ hasText: /\S/ }).waitFor();
    const status = (await page.getByTestId('copy-status').textContent()) ?? '';
    if (status === 'Busca copiada.') {
      // A alternativa copiou de verdade: confere pelo teclado do navegador, com a área de transferência real.
      assert.equal(await readClipboard(), text);
    } else {
      assert.match(status, /Não foi possível copiar sozinho/);
      assert.equal(await page.evaluate(() => window.getSelection()?.toString() || (document.activeElement as HTMLTextAreaElement).value.slice((document.activeElement as HTMLTextAreaElement).selectionStart ?? 0, (document.activeElement as HTMLTextAreaElement).selectionEnd ?? 0)), text);
    }
    await page.close();
  });

  test('Abrir no LinkedIn abre uma aba nova, por clique, só com o texto da busca, sem acesso real', async () => {
    const { page } = await openPanel(h);
    await acceptTerms(page);
    await createJob(page, 'Abrir', 'Requisitos:\n- Java\n- Kafka');
    await useAllSuggestions(page);
    await page.getByRole('button', { name: 'Montar a busca' }).click();
    const text = await page.getByLabel('Texto da busca').inputValue();
    const link = page.getByRole('link', { name: 'Abrir no LinkedIn' });
    assert.equal(await link.getAttribute('target'), '_blank');
    assert.match((await link.getAttribute('rel')) ?? '', /noopener/);
    // Antes do clique nada foi pedido.
    assert.deepEqual(linkedinHits, []);
    const popup = page.waitForEvent('popup');
    await link.click();
    await (await popup).close().catch(() => undefined);
    await page.waitForTimeout(300);
    const expected = peopleSearchUrl(text);
    assert.deepEqual(linkedinHits, [expected]);
    const url = new URL(linkedinHits[0] ?? '');
    assert.equal(url.origin + url.pathname, 'https://www.linkedin.com/search/results/people/');
    assert.equal([...url.searchParams.keys()].join(','), 'keywords', 'só o texto da busca vai no endereço');
    assert.equal(url.searchParams.get('keywords'), text);
    // O painel continua onde estava.
    await page.getByRole('heading', { name: 'Busca para o LinkedIn' }).waitFor();
    await page.close();
  });

  test('texto malicioso em nome de vaga, de requisito e de termo excluído aparece como texto e nada executa', async () => {
    const { page, errors } = await openPanel(h);
    page.on('dialog', (d) => void d.dismiss());
    await acceptTerms(page);
    const evil = '<img src=x onerror="window.__pwned=1">';
    await createJob(page, evil, '<script>window.__pwned=2</script>\nRequisitos:\n- Java');
    await page.getByRole('heading', { name: 'Requisitos', exact: true }).waitFor();
    await activeJobIs(page, evil);
    await page.getByText(`Vaga: ${evil}`).waitFor();
    await useAllSuggestions(page);
    await page.getByLabel('Requisito', { exact: true }).fill('<b onmouseover="window.__pwned=3">forte</b>');
    await page.getByRole('button', { name: 'Adicionar requisito' }).click();
    await page.locator('[data-requirement="<b onmouseover=\\"window.__pwned=3\\">forte</b>"]').waitFor();
    await page.getByLabel('Termo a excluir').fill('<svg onload="window.__pwned=4">');
    await page.getByRole('button', { name: 'Excluir este termo' }).click();
    await page.getByRole('list', { name: 'Termos excluídos' }).getByText('<svg onload="window.__pwned=4">').waitFor();
    await page.getByRole('button', { name: 'Trocar' }).click();
    await page.getByRole('list', { name: 'Lista de vagas' }).getByText(evil).waitFor();
    // Nenhum elemento vindo do texto: nem imagem, nem script, nem svg, nem negrito dentro do painel.
    assert.equal(await page.locator('#messages img, #messages script, #messages svg, #messages b, .tr-shell img').count(), 0);
    assert.equal(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned), undefined);
    assert.deepEqual(errors, []);
    await page.close();
  });

  test('vagas: criar, editar, escolher a ativa, arquivar, tirar do arquivo e apagar com confirmação', async () => {
    const { page } = await openPanel(h);
    await acceptTerms(page);
    await createJob(page, 'Vaga Um', '');
    await page.getByRole('heading', { name: 'Vaga ativa' }).waitFor();
    await activeJobIs(page, 'Vaga Um');
    // Sem texto, não há sugestão: cai direto no início da vaga.
    await page.getByRole('button', { name: 'Nova vaga' }).click();
    await page.getByLabel('Título da vaga').fill('Vaga Dois');
    await page.getByRole('button', { name: 'Salvar e ver requisitos' }).click();
    await activeJobIs(page, 'Vaga Dois');
    // Editar.
    await page.getByRole('button', { name: 'Editar vaga' }).click();
    await page.getByLabel('Título da vaga').fill('Vaga Dois (editada)');
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    await page.getByRole('heading', { name: 'Vaga ativa' }).waitFor();
    await activeJobIs(page, 'Vaga Dois (editada)');
    // Escolher a ativa pela lista.
    await page.getByRole('button', { name: 'Trocar' }).click();
    const list = page.getByRole('list', { name: 'Lista de vagas' });
    assert.equal(await list.getByRole('listitem').count(), 2);
    await page.getByRole('button', { name: 'Usar esta vaga: Vaga Um' }).click();
    await page.getByRole('heading', { name: 'Vaga ativa' }).waitFor();
    await activeJobIs(page, 'Vaga Um');
    const active = (await readStorage(h))['settings'] as { activeJobId: string };
    // Arquivar pede confirmação e depois não há vaga ativa.
    await page.getByRole('button', { name: 'Arquivar', exact: true }).click();
    await page.getByRole('heading', { name: 'Arquivar a vaga?' }).waitFor();
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await page.getByRole('heading', { name: 'Vaga ativa' }).waitFor();
    await page.getByRole('button', { name: 'Arquivar', exact: true }).click();
    await page.getByRole('button', { name: 'Arquivar a vaga', exact: true }).click();
    await page.getByRole('heading', { name: 'Suas vagas' }).waitFor();
    await activeJobIs(page, 'Nenhuma vaga ativa');
    const archivedJob = Object.entries(await readStorage(h)).find(([key, value]) => key.startsWith('job:') && (value as { id: string }).id === active.activeJobId)?.[1] as { archived: boolean };
    assert.equal(archivedJob.archived, true);
    await page.getByRole('button', { name: 'Tirar do arquivo: Vaga Um' }).click();
    await page.getByRole('button', { name: 'Usar esta vaga: Vaga Um' }).waitFor();
    // Apagar avisa que leva os candidatos e só apaga depois de confirmar.
    await page.getByRole('button', { name: 'Apagar: Vaga Um' }).click();
    await page.getByText('leva junto todos os candidatos dela').waitFor();
    await page.getByRole('button', { name: 'Cancelar' }).click();
    assert.equal(Object.keys(await readStorage(h)).filter((key) => key.startsWith('job:')).length, 2);
    await page.getByRole('button', { name: 'Apagar: Vaga Um' }).click();
    await page.getByRole('button', { name: 'Apagar a vaga e os candidatos' }).click();
    await page.getByRole('heading', { name: /Vamos começar|Suas vagas|Vaga ativa/ }).waitFor();
    assert.equal(Object.keys(await readStorage(h)).filter((key) => key.startsWith('job:')).length, 1);
    await page.close();
  });

  test('ajustes: muda responsável e prazo, e a ajuda de vaga afirmativa explica que o tratamento fica fora', async () => {
    const { page } = await openPanel(h);
    await acceptTerms(page);
    await page.getByRole('button', { name: 'Ajustes' }).click();
    await page.getByRole('heading', { name: 'Ajustes', level: 2 }).waitFor();
    await page.getByLabel('Seu nome').fill('Rui Lima');
    await page.getByLabel('Guardar candidatos por quantos dias').fill('90');
    await page.getByRole('button', { name: 'Salvar ajustes' }).click();
    await page.getByText('Ajustes salvos.').waitFor();
    const settings = (await readStorage(h))['settings'] as { responsibleName: string; retentionDays: number; acceptances: { terms?: unknown } };
    assert.equal(settings.responsibleName, 'Rui Lima');
    assert.equal(settings.retentionDays, 90);
    assert.ok(settings.acceptances.terms, 'o aceite continua guardado');
    await page.getByRole('button', { name: 'Voltar ao início' }).click();
    await createJob(page, 'Afirmativa', 'Requisitos:\n- Java');
    await useAllSuggestions(page);
    await page.getByRole('button', { name: 'Vaga afirmativa?' }).click();
    await page.getByText(/fica fora da Triagem\+/).waitFor();
    await page.close();
  });

  test('teclado: o foco vai para o título de cada tela e o fluxo inteiro anda com Tab, Espaço e Enter', async () => {
    const { page } = await openPanel(h);
    await page.getByLabel('Seu nome').focus();
    await page.keyboard.type('Marina Souza');
    await page.keyboard.press('Tab');
    await page.keyboard.type('marina@exemplo.test');
    await page.keyboard.press('Enter');
    await page.getByRole('heading', { name: 'Vamos começar pela vaga' }).waitFor();
    await page.getByRole('button', { name: 'Nova vaga' }).focus();
    await page.keyboard.press('Enter');
    const titleId = await page.evaluate(() => document.activeElement?.id);
    assert.equal(titleId, 'msg-job_form-title', 'o foco vai para o título da tela nova');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'title');
    await page.keyboard.type('Vaga pelo teclado');
    await page.keyboard.press('Enter');
    await page.getByRole('heading', { name: 'Vaga ativa' }).waitFor();
    await activeJobIs(page, 'Vaga pelo teclado');
    // O foco visível existe nos botões.
    await page.keyboard.press('Tab');
    const outline = await page.evaluate(() => getComputedStyle(document.activeElement as Element).outlineStyle);
    assert.notEqual(outline, 'none');
    await page.close();
  });

  test('largura de 320 a 500 px: nada passa da borda nas telas principais', async () => {
    const { page } = await openPanel(h);
    await acceptTerms(page);
    await createJob(page, 'Titulo muito longo '.repeat(8), 'Requisitos:\n- Java\n- Kafka\n- Docker');
    await useAllSuggestions(page);
    for (const width of [320, 500]) {
      await page.setViewportSize({ width, height: 800 });
      for (const step of ['requirements', 'search', 'home'] as const) {
        if (step === 'search') await page.getByRole('button', { name: 'Montar a busca' }).click();
        if (step === 'home') await page.getByRole('button', { name: 'Voltar ao início' }).click();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        assert.ok(overflow <= 0, `rolagem horizontal de ${overflow}px em ${width}px na tela ${step}`);
      }
      await page.getByRole('button', { name: 'Requisitos', exact: true }).click();
    }
    await page.close();
  });

  /** Lê a área de transferência por uma página local de controle, a única que recebe a permissão de leitura. */
  async function readClipboard(): Promise<string> {
    const origin = new URL(h.controlUrl).origin;
    await h.context.grantPermissions(['clipboard-read'], { origin });
    const reader = await h.context.newPage();
    try {
      await reader.goto(h.controlUrl);
      await reader.bringToFront();
      return await reader.evaluate(() => navigator.clipboard.readText());
    } finally {
      await reader.close();
      await h.context.clearPermissions();
    }
  }
});
