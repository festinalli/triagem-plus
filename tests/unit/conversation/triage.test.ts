// As regras novas da conversa (RF-60 a RF-69, RF-90): colar, resultado, Top 10, lista com filtros, detalhe e relatório.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { buildConversation, HOME } from '../../../src/core/conversation/build.ts';
import type { ConversationMessage, Step } from '../../../src/core/conversation/build.ts';
import { applyFilters, NO_FILTERS } from '../../../src/core/conversation/filters.ts';
import { safeHttpsLink, startsWithHttps } from '../../../src/core/conversation/links.ts';
import { sortCandidates } from '../../../src/core/match/rank.ts';
import { DAY, NOW, inputWith, job, person, req } from './helpers.ts';

const kinds = (messages: readonly ConversationMessage[]): string[] => messages.map((m) => m.kind);
const at = (step: Step, candidates = [person({ id: 'a' })], over = {}) => buildConversation(inputWith(candidates, { step, ...over }));

function fifteen() {
  return Array.from({ length: 15 }, (_, i) => person({ id: `c${String(i).padStart(2, '0')}`, score: 100 - i * 3, requiredMet: 2, addedAt: i }));
}

describe('Top 10 (RF-61, RF-67, RF-68, CA-11, CA-25)', () => {
  test('ao abrir a vaga ativa, o Top 10 vem antes do resumo, com os 10 de maior nota em ordem', () => {
    const embaralhado = [...fifteen()].reverse();
    const messages = buildConversation(inputWith(embaralhado));
    assert.deepEqual(kinds(messages), ['top_ten', 'job_summary']);
    const top = messages[0];
    assert.ok(top && top.kind === 'top_ten');
    assert.equal(top.rows.length, 10);
    assert.equal(top.total, 15);
    assert.deepEqual(top.rows.map((row) => row.position), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    assert.deepEqual(top.rows.map((row) => row.score), Array.from({ length: 10 }, (_, i) => 100 - i * 3));
    assert.deepEqual(top.actions.map((a) => a.id), ['open_report', 'show_all', 'open_paste']);
  });

  test('empate: mesma nota vence quem atendeu mais obrigatórios, e depois quem entrou primeiro', () => {
    const list = [
      person({ id: 'tarde', score: 70, requiredMet: 2, addedAt: 30 }),
      person({ id: 'cedo', score: 70, requiredMet: 2, addedAt: 10 }),
      person({ id: 'mais', score: 70, requiredMet: 2, addedAt: 20 }),
      person({ id: 'menos', score: 70, requiredMet: 1, addedAt: 5 }),
      person({ id: 'maior', score: 71, requiredMet: 0, addedAt: 99 }),
    ];
    const top = buildConversation(inputWith(list))[0];
    assert.ok(top && top.kind === 'top_ten');
    assert.deepEqual(top.rows.map((row) => row.id), ['maior', 'cedo', 'mais', 'tarde', 'menos']);
  });

  test('o nome nunca decide a ordem', () => {
    const list = [person({ id: 'z', name: 'Zélia', score: 60, addedAt: 1 }), person({ id: 'a', name: 'Abel', score: 60, addedAt: 2 })];
    const top = buildConversation(inputWith(list))[0];
    assert.ok(top && top.kind === 'top_ten');
    assert.deepEqual(top.rows.map((row) => row.id), ['z', 'a']);
  });

  test('menos de 10 na lista: mostra os que houver. Lista vazia: sem Top 10', () => {
    const few = buildConversation(inputWith([person({ id: 'a' }), person({ id: 'b', score: 10 })]))[0];
    assert.ok(few && few.kind === 'top_ten');
    assert.deepEqual([few.rows.length, few.total], [2, 2]);
    assert.deepEqual(kinds(buildConversation(inputWith([]))), ['job_summary']);
  });

  test('depois de uma análise diz "entrou em 3º"', () => {
    const list = [person({ id: 'p1', score: 90 }), person({ id: 'p2', score: 80 }), person({ id: 'novo', score: 70 }), person({ id: 'p4', score: 60 })];
    const messages = buildConversation(inputWith(list, { analysis: { candidateId: 'novo', updated: false, addedNothing: false, notProfileLink: false } }));
    assert.deepEqual(kinds(messages), ['analysis_result', 'top_ten']);
    const top = messages[1];
    assert.ok(top && top.kind === 'top_ten' && top.entered !== null);
    assert.deepEqual([top.entered.position, top.entered.inTop, top.entered.total, top.entered.updated], [3, true, 4, false]);
    assert.ok(top.actions.some((a) => a.id === 'go_home'));
  });

  test('quem ficou fora dos 10 é dito, com a posição real', () => {
    const list = fifteen();
    const messages = buildConversation(inputWith(list, { analysis: { candidateId: 'c14', updated: false, addedNothing: false, notProfileLink: false } }));
    const top = messages[1];
    assert.ok(top && top.kind === 'top_ten' && top.entered !== null);
    assert.deepEqual([top.entered.position, top.entered.inTop], [15, false]);
    assert.equal(top.rows.some((row) => row.id === 'c14'), false);
  });

  test('selo "não informado" só até existir "informado em" (RF-82)', () => {
    const top = buildConversation(inputWith([person({ id: 'a' }), person({ id: 'b', score: 10, informedAt: NOW })]))[0];
    assert.ok(top && top.kind === 'top_ten');
    assert.deepEqual(top.rows.map((row) => [row.id, row.notInformed]), [['a', true], ['b', false]]);
  });

  test('link só é clicável quando é https seguro; o resto aparece como texto', () => {
    const list = [person({ id: 'a', profileUrl: 'https://www.linkedin.com/in/a/' }), person({ id: 'b', score: 70, profileUrl: 'javascript:alert(1)' }), person({ id: 'c', score: 60, profileUrl: 'http://exemplo.test/x' }), person({ id: 'd', score: 50, profileUrl: 'https://exemplo.test/ a' })];
    const top = buildConversation(inputWith(list))[0];
    assert.ok(top && top.kind === 'top_ten');
    assert.deepEqual(top.rows.map((row) => row.link), ['https://www.linkedin.com/in/a/', null, null, null]);
    assert.equal(top.rows[1]?.linkText, 'javascript:alert(1)');
  });

  test('a conversa não guarda nada: apagar a pessoa a tira de todas as mensagens (RF-69, CA-26)', () => {
    const list = [person({ id: 'a' }), person({ id: 'b', score: 10 })];
    const before = buildConversation(inputWith(list, { analysis: { candidateId: 'b', updated: false, addedNothing: false, notProfileLink: false } }));
    assert.deepEqual(kinds(before), ['analysis_result', 'top_ten']);
    const after = buildConversation(inputWith([list[0]!], { analysis: { candidateId: 'b', updated: false, addedNothing: false, notProfileLink: false } }));
    assert.deepEqual(kinds(after), ['top_ten', 'job_summary'], 'sem a pessoa, não há resultado nem posição dela');
    const top = after[0];
    assert.ok(top && top.kind === 'top_ten');
    assert.equal(top.entered, null);
    assert.deepEqual(top.rows.map((row) => row.id), ['a']);
  });

  test('aviso de prazo: marca quem está nos 7 dias finais', () => {
    const list = [person({ id: 'a', updatedAt: NOW - 175 * DAY }), person({ id: 'b', score: 10, updatedAt: NOW - 10 * DAY })];
    const top = buildConversation(inputWith(list))[0];
    assert.ok(top && top.kind === 'top_ten');
    assert.deepEqual(top.rows.map((row) => row.expiring), [true, false]);
  });
});

describe('resultado da análise (RF-50 a RF-56, RF-35, RF-64)', () => {
  const requirements = [req('term', 'Java'), req('term', 'Spring Boot'), req('term', 'Kafka', 'preferred'), req('term', 'Docker', 'preferred')];
  const the = job(requirements);

  test('um resultado por requisito, obrigatórios primeiro, com os quatro estados e sem "não tem"', () => {
    const candidate = person({ id: 'x', statuses: ['partial', 'met', 'needs_reanalysis', 'not_found'] }, requirements);
    const messages = buildConversation({ ...inputWith([candidate], { analysis: { candidateId: 'x', updated: false, addedNothing: false, notProfileLink: false } }), jobs: [the], activeJob: the });
    const result = messages[0];
    assert.ok(result && result.kind === 'analysis_result');
    assert.deepEqual(result.lines.map((line) => [line.label, line.importance, line.status]), [
      ['Java', 'required', 'partial'],
      ['Spring Boot', 'required', 'met'],
      ['Kafka', 'preferred', 'needs_reanalysis'],
      ['Docker', 'preferred', 'not_found'],
    ]);
    assert.deepEqual(result.actions.map((a) => a.id), ['remove_from_list', 'add_more_text', 'show_detail']);
    assert.ok(result.actions.every((a) => a.candidateId === 'x'));
  });

  test('sem requisito avaliado não há nota', () => {
    const candidate = person({ id: 'x', score: 0, band: 'weak', statuses: ['needs_reanalysis', 'needs_reanalysis', 'needs_reanalysis', 'needs_reanalysis'] }, requirements);
    const result = buildConversation({ ...inputWith([candidate], { analysis: { candidateId: 'x', updated: false, addedNothing: false, notProfileLink: false } }), jobs: [the], activeJob: the })[0];
    assert.ok(result && result.kind === 'analysis_result');
    assert.equal(result.scored, false);
    const top = buildConversation({ ...inputWith([candidate]), jobs: [the], activeJob: the })[0];
    assert.ok(top && top.kind === 'top_ten');
    assert.equal(top.rows[0]?.scored, false);
  });

  test('leitura incompleta: diz o que faltou ler e se a lista veio cortada (RF-35)', () => {
    const cut = person({ id: 'x', sectionsRead: ['about'], truncated: true }, requirements);
    const result = buildConversation({ ...inputWith([cut], { analysis: { candidateId: 'x', updated: false, addedNothing: false, notProfileLink: false } }), jobs: [the], activeJob: the })[0];
    assert.ok(result && result.kind === 'analysis_result');
    assert.deepEqual(result.readNotice, { level: 'few_sections', truncated: true, missing: ['experience', 'skills'] });
    const full = person({ id: 'y' }, requirements);
    const ok = buildConversation({ ...inputWith([full], { analysis: { candidateId: 'y', updated: false, addedNothing: false, notProfileLink: false } }), jobs: [the], activeJob: the })[0];
    assert.ok(ok && ok.kind === 'analysis_result');
    assert.deepEqual(ok.readNotice, { level: 'ok', truncated: false, missing: [] });
    const nothing = person({ id: 'z', sectionsRead: [] }, requirements);
    const empty = buildConversation({ ...inputWith([nothing], { analysis: { candidateId: 'z', updated: false, addedNothing: false, notProfileLink: false } }), jobs: [the], activeJob: the })[0];
    assert.ok(empty && empty.kind === 'analysis_result');
    assert.equal(empty.readNotice.level, 'empty');
  });

  test('pessoa que já estava na lista traz o aviso de ficha atualizada (RF-64)', () => {
    const result = buildConversation(inputWith([person({ id: 'x' })], { analysis: { candidateId: 'x', updated: true, addedNothing: true, notProfileLink: true } }))[0];
    assert.ok(result && result.kind === 'analysis_result');
    assert.deepEqual([result.updated, result.addedNothing, result.notProfileLink], [true, true, true]);
  });
});

describe('colar o perfil (RF-30, RF-37)', () => {
  test('sem vaga ativa pede para criar ou escolher', () => {
    const [message] = buildConversation({ settings: inputWith([]).settings, jobs: [], activeJob: null, step: { name: 'paste' } });
    assert.ok(message);
    // Sem vaga ativa e sem vagas, o início convida a criar; com vagas, mostra a lista para escolher.
    assert.ok(message.kind === 'no_job' || message.kind === 'paste_form');
    const active = job();
    const blocked = buildConversation({ settings: inputWith([]).settings, jobs: [active], activeJob: null, step: { name: 'paste' } });
    assert.equal(blocked[0]?.kind, 'paste_form');
    assert.ok(blocked[0]?.kind === 'paste_form' && blocked[0].blocked === 'no_job');
    assert.deepEqual(blocked[0]?.actions.map((a) => a.id), ['create_job', 'show_jobs']);
  });

  test('vaga sem requisito: pede os requisitos, porque não há nota', () => {
    const empty = job([]);
    const [message] = buildConversation({ settings: inputWith([]).settings, jobs: [empty], activeJob: empty, step: { name: 'paste' } });
    assert.ok(message && message.kind === 'paste_form');
    assert.equal(message.blocked, 'no_requirements');
    assert.deepEqual(message.actions.map((a) => a.id), ['open_requirements', 'go_home']);
  });

  test('com vaga e requisitos, o formulário abre. Somar texto traz o nome e o link de quem já está na lista', () => {
    const [form] = at({ name: 'paste' });
    assert.ok(form && form.kind === 'paste_form');
    assert.deepEqual([form.blocked, form.adding], [null, null]);
    const [adding] = at({ name: 'paste', candidateId: 'a' });
    assert.ok(adding && adding.kind === 'paste_form' && adding.adding !== null);
    assert.equal(adding.adding.name, 'Pessoa Fictícia a');
    assert.equal(adding.adding.link, 'https://www.linkedin.com/in/pessoa-a/');
  });

  test('sem aceite dos avisos nada disso abre (CA-01)', () => {
    const messages = buildConversation({ ...inputWith([person({ id: 'a' })]), settings: { ...inputWith([]).settings, acceptances: {} }, step: { name: 'paste' } });
    assert.deepEqual(kinds(messages), ['notices', 'accept_form']);
  });
});

describe('Ver todos e filtros (RF-60, CA-12)', () => {
  const people = [
    person({ id: 'a', score: 90, band: 'strong', terms: ['Java', 'Spring Boot'], totalMonths: 120, stage: 'interview', favorite: true }),
    person({ id: 'b', score: 70, band: 'partial', terms: ['Java'], totalMonths: 48, stage: 'new', requiredMet: 1, statuses: ['met', 'not_found', 'met'] }),
    person({ id: 'c', score: 30, band: 'weak', terms: ['Python'], totalMonths: null, stage: 'new', statuses: ['not_found', 'not_found', 'not_found'], requiredMet: 0 }),
    person({ id: 'd', score: 0, band: 'weak', terms: [], totalMonths: 24, statuses: ['needs_reanalysis', 'needs_reanalysis', 'needs_reanalysis'], requiredMet: 0 }),
  ];
  const the = job();
  const ids = (list: readonly { id: string }[]): string[] => list.map((p) => p.id);

  test('sem filtro, todos aparecem e nada fica de fora', () => {
    const list = at({ name: 'list' }, people)[0];
    assert.ok(list && list.kind === 'candidate_list');
    assert.deepEqual([list.total, list.shown, list.hidden, list.filtersActive], [4, 4, 0, false]);
  });

  test('cada filtro conta quantos ficaram de fora e não apaga ninguém', () => {
    const cases: Array<[string, Partial<typeof NO_FILTERS>, string[]]> = [
      ['termo', { term: 'java' }, ['a', 'b']],
      ['termo com acento e caixa', { term: 'SPRING boot' }, ['a']],
      ['experiência mínima', { minYears: 4 }, ['a', 'b']],
      ['faixa', { band: 'strong' }, ['a']],
      ['etapa', { stage: 'new' }, ['b', 'c', 'd']],
      ['favoritos', { favoriteOnly: true }, ['a']],
      ['todos os obrigatórios', { allRequired: true }, ['a']],
      ['combinados', { term: 'java', minYears: 5, stage: 'interview' }, ['a']],
      ['ninguém passa', { term: 'cobol' }, []],
    ];
    for (const [name, patch, expected] of cases) {
      const filters = { ...NO_FILTERS, ...patch };
      const list = at({ name: 'list' }, people, { filters })[0];
      assert.ok(list && list.kind === 'candidate_list', name);
      assert.deepEqual(ids(list.rows), expected, name);
      assert.deepEqual([list.total, list.shown, list.hidden], [4, expected.length, 4 - expected.length], name);
      assert.equal(list.filtersActive, true, name);
    }
  });

  test('filtro de termo compara a chave inteira: Java não traz JavaScript, C# não traz React (RF-60)', () => {
    const mixed = [
      person({ id: 'js', terms: ['JavaScript'] }),
      person({ id: 'java', terms: ['Java'] }),
      person({ id: 'cs', terms: ['C#'] }),
      person({ id: 'react', terms: ['React'] }),
      person({ id: 'go', terms: ['Go'] }),
      person({ id: 'free', terms: ['zephyrix quartz'] }),
    ];
    const by = (term: string): string[] => ids(applyFilters(mixed, the, { ...NO_FILTERS, term }));
    assert.deepEqual(by('Java'), ['java']);
    assert.deepEqual(by('C#'), ['cs']);
    assert.deepEqual(by('React.js'), ['react']);
    assert.deepEqual(by('Golang'), ['go']);
    assert.deepEqual(by('Zephyrix  Quartz'), ['free']);
    assert.deepEqual(by('zephyrix'), []);
  });

  test('a posição mostrada é a da lista inteira, mesmo com filtro', () => {
    const list = at({ name: 'list' }, people, { filters: { ...NO_FILTERS, stage: 'new' } })[0];
    assert.ok(list && list.kind === 'candidate_list');
    assert.deepEqual(list.rows.map((row) => [row.id, row.position]), [['b', 2], ['c', 3], ['d', 4]]);
  });

  test('faixa só vale para quem tem nota; "atende a todos" não aceita requisito pendente', () => {
    assert.deepEqual(ids(applyFilters(people, the, { ...NO_FILTERS, band: 'weak' })), ['c']);
    assert.deepEqual(ids(applyFilters(people, the, { ...NO_FILTERS, allRequired: true })), ['a']);
  });

  test('o filtro não muda a lista de entrada nem a ordem das notas', () => {
    const copy = [...people];
    applyFilters(people, the, { ...NO_FILTERS, term: 'java' });
    assert.deepEqual(ids(people), ids(copy));
    assert.deepEqual(ids(sortCandidates(people)), ['a', 'b', 'c', 'd']);
  });
});

describe('detalhe, prazo e apagar (RF-62 a RF-65, RF-90)', () => {
  test('traz posição, etapa, favorito, notas e a explicação', () => {
    const [detail] = at({ name: 'detail', candidateId: 'a' }, [person({ id: 'a', stage: 'offer', favorite: true, notes: 'ligar na terça' })]);
    assert.ok(detail && detail.kind === 'candidate_detail');
    assert.deepEqual([detail.stage, detail.favorite, detail.notes, detail.position, detail.total], ['offer', true, 'ligar na terça', 1, 1]);
    assert.equal(detail.lines.length, 3);
    assert.equal(detail.retention, 'ok');
    assert.ok(!detail.actions.some((a) => a.id === 'renew_candidate'));
    assert.ok(detail.actions.some((a) => a.id === 'delete_candidate' && a.danger === true));
  });

  test('nos 7 dias finais avisa e oferece renovar; fora disso não', () => {
    const near = at({ name: 'detail', candidateId: 'a' }, [person({ id: 'a', updatedAt: NOW - 176 * DAY })])[0];
    assert.ok(near && near.kind === 'candidate_detail');
    assert.equal(near.retention, 'expiring');
    assert.deepEqual(near.actions.filter((a) => a.primary).map((a) => a.id), ['renew_candidate']);
    const far = at({ name: 'detail', candidateId: 'a' }, [person({ id: 'a', updatedAt: NOW - 100 * DAY })])[0];
    assert.ok(far && far.kind === 'candidate_detail');
    assert.equal(far.retention, 'ok');
  });

  test('notas com assunto da trava geram alerta e não bloqueiam (RF-65)', () => {
    const [detail] = at({ name: 'detail', candidateId: 'a' }, [person({ id: 'a', notes: 'candidata muito jovem, tem 24 anos' })]);
    assert.ok(detail && detail.kind === 'candidate_detail');
    assert.ok(detail.noteAlerts.length > 0, 'devia alertar');
    assert.equal(detail.notes, 'candidata muito jovem, tem 24 anos', 'a nota continua como foi escrita');
    const clean = at({ name: 'detail', candidateId: 'a' }, [person({ id: 'a', notes: 'ligar na terça, boa conversa sobre Kafka' })])[0];
    assert.ok(clean && clean.kind === 'candidate_detail');
    assert.deepEqual(clean.noteAlerts, []);
  });

  test('apagar pede confirmação; pessoa que não existe volta ao início', () => {
    const confirm = at({ name: 'confirm_delete_candidate', candidateId: 'a' })[0];
    assert.ok(confirm && confirm.kind === 'confirm_candidate');
    assert.deepEqual(confirm.actions.map((a) => a.id), ['confirm_delete_candidate', 'show_detail']);
    assert.deepEqual(kinds(at({ name: 'detail', candidateId: 'sumiu' })), ['top_ten', 'job_summary']);
    assert.deepEqual(kinds(at({ name: 'confirm_delete_candidate', candidateId: 'sumiu' })), ['top_ten', 'job_summary']);
  });
});

describe('opções do relatório (RF-70, RF-73)', () => {
  test('padrão: 10 melhores, sem notas; o aceite do aviso aparece quando falta', () => {
    const [report] = at({ name: 'report' });
    assert.ok(report && report.kind === 'report_options');
    assert.deepEqual([report.scope, report.includeNotes, report.exportAccepted, report.replacedCount], ['top10', false, false, null]);
    const accepted = buildConversation(inputWith([person({ id: 'a' })], { step: { name: 'report' }, settings: { ...inputWith([]).settings, acceptances: { terms: { version: 1, at: 1 }, fileExport: { version: 1, at: 5 } } } }))[0];
    assert.ok(accepted && accepted.kind === 'report_options');
    assert.equal(accepted.exportAccepted, true);
  });

  test('conta quantos passam pelo filtro para "todos os filtrados"', () => {
    const people = [person({ id: 'a', stage: 'new' }), person({ id: 'b', stage: 'offer', score: 10 })];
    const report = at({ name: 'report' }, people, { filters: { ...NO_FILTERS, stage: 'offer' } })[0];
    assert.ok(report && report.kind === 'report_options');
    assert.deepEqual([report.total, report.filteredCount, report.filtersActive], [2, 1, true]);
  });
});

describe('links (RNF-04)', () => {
  test('só https com site simples é clicável', () => {
    assert.equal(safeHttpsLink('https://www.linkedin.com/in/ana-silva/'), 'https://www.linkedin.com/in/ana-silva/');
    for (const bad of ['http://exemplo.test/', 'javascript:alert(1)', 'data:text/html,x', '//exemplo.test', 'https://', 'https://exemplo', 'https://usuario@exemplo.test/', 'https://exemplo.test/a b', 'https://exemplo.test/é', '']) {
      assert.equal(safeHttpsLink(bad), null, bad);
    }
  });

  test('o campo de link pede https', () => {
    assert.equal(startsWithHttps('https://exemplo.test/x'), true);
    assert.equal(startsWithHttps(' HTTPS://exemplo.test/x '), true);
    for (const bad of ['http://exemplo.test', 'exemplo.test', 'ftp://x.test', 'https://', 'https:// x']) assert.equal(startsWithHttps(bad), false, bad);
  });

  test('o passo inicial continua sendo o início', () => {
    assert.equal(HOME.name, 'home');
  });
});
