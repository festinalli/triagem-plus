import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultBody, defaultTemplates, fillTemplate, missingMarkers, resolveTemplates, withTemplate, withoutTemplate } from '../../../src/core/messages/templates.ts';

const VALUES = { nome: 'Ana Fictícia', vaga: 'Dev Java', responsavel: 'Marina Souza', contato: 'marina@exemplo.test' };

describe('fillTemplate', () => {
  test('troca os quatro marcadores, inclusive repetidos', () => {
    assert.equal(fillTemplate('Oi {nome}, vaga {vaga}. {responsavel} ({contato}). {nome}!', VALUES), 'Oi Ana Fictícia, vaga Dev Java. Marina Souza (marina@exemplo.test). Ana Fictícia!');
  });

  test('marcador sem valor continua visível', () => {
    assert.equal(fillTemplate('Fale em {contato} com {responsavel}', { responsavel: 'Marina', contato: '   ' }), 'Fale em {contato} com Marina');
    assert.equal(fillTemplate('{nome}', {}), '{nome}');
    assert.deepEqual(missingMarkers('{nome} {contato} {contato}', { nome: 'Ana' }), ['{contato}']);
  });

  test('o valor entra como texto: marcador dentro do valor não é trocado de novo', () => {
    assert.equal(fillTemplate('Oi {nome}', { nome: '{vaga}', vaga: 'X' }), 'Oi {vaga}');
    assert.equal(fillTemplate('Oi {nome}', { nome: '<b>x</b> $& $1' }), 'Oi <b>x</b> $& $1');
  });

  test('marcador desconhecido fica como está', () => {
    assert.equal(fillTemplate('{idade} {nome}', VALUES), '{idade} Ana Fictícia');
  });
});

describe('modelos padrão', () => {
  test('são três, com título, e o primeiro contato diz o essencial e cita o prazo atual', () => {
    const list = defaultTemplates(90);
    assert.deepEqual(list.map((item) => item.id), ['first_contact', 'follow_up', 'closing']);
    const first = fillTemplate(defaultBody('first_contact', 90), VALUES);
    assert.match(first, /90 dias/);
    assert.match(first, /Marina Souza/);
    assert.match(first, /Dev Java/);
    assert.match(first, /públicos/);
    assert.match(first, /no navegador de quem recruta/);
    assert.match(first, /relatório que eu gerar/, 'o PDF e a planilha também levam os dados');
    assert.match(first, /renovado enquanto o processo durar/);
    assert.ok(!/apenas no navegador|por até|no máximo/.test(first), 'sem promessa que o PDF ou a renovação desmentem');
    assert.match(first, /ver, corrigir ou apagar/);
    assert.match(first, /marina@exemplo\.test/);
    assert.ok(!/\{[a-z]+\}/.test(first), 'nenhum marcador sobra com todos os dados');
  });

  test('o prazo muda com o ajuste e encerramento diz que os dados serão apagados', () => {
    assert.match(defaultBody('first_contact', 365), /365 dias/);
    assert.match(defaultBody('closing', 30), /30 dias/);
    assert.match(defaultBody('closing', 30), /serão apagados/);
    assert.ok(!/no máximo/.test(defaultBody('closing', 30)));
    assert.ok(defaultBody('follow_up', 180).length < defaultBody('first_contact', 180).length);
  });

  test('sem nome de terceiros nem promessa jurídica', () => {
    for (const item of defaultTemplates(180)) assert.ok(!/LinkedIn|LGPD|lei |garant/i.test(item.body), item.id);
  });
});

describe('editar e restaurar', () => {
  test('resolveTemplates usa o editado e cai no padrão quando falta ou está vazio', () => {
    const stored = [
      { id: 'follow_up', title: 'x', body: 'Meu texto {nome}' },
      { id: 'closing', title: 'x', body: '  ' },
    ];
    const out = resolveTemplates(stored, 180);
    assert.equal(out[1]?.body, 'Meu texto {nome}');
    assert.equal(out[1]?.isDefault, false);
    assert.equal(out[2]?.isDefault, true);
    assert.equal(out[0]?.isDefault, true);
  });

  test('texto igual ao padrão não é guardado; restaurar tira a edição', () => {
    assert.deepEqual(withTemplate([], 'closing', defaultBody('closing', 180), 180), []);
    const saved = withTemplate([], 'closing', 'Outro', 180);
    assert.equal(saved.length, 1);
    assert.deepEqual(withoutTemplate(saved, 'closing'), []);
    assert.deepEqual(withTemplate(saved, 'closing', 'Novo', 180).map((item) => item.body), ['Novo']);
  });
});
