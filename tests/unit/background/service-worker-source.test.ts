// Regras do gesto conferidas no texto do código: o painel abre antes de qualquer await (depende do gesto), e o service
// worker não navega, não rola, não clica, não usa temporizador nem rede (RF-33).
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'src');
const read = (rel: string): string => fs.readFileSync(path.join(SRC, rel), 'utf8');
const worker = read('background/service-worker.ts');

describe('service worker', () => {
  test('handleGesture chama sidePanel.open antes de qualquer await', () => {
    const start = worker.indexOf('function handleGesture');
    assert.ok(start > 0);
    const body = worker.slice(start, worker.indexOf('chrome.contextMenus.onClicked', start));
    const open = body.indexOf('openSidePanel(chrome, tabId)');
    assert.ok(open > 0, 'não abre o painel');
    const firstAwait = body.indexOf('await');
    assert.ok(firstAwait > open, 'há await antes de abrir o painel');
    assert.ok(!body.slice(0, open).includes('.then('));
  });

  test('o invólucro do painel não espera nada antes de chamar sidePanel.open', () => {
    const wrapper = read('platform/chrome/side-panel.ts');
    assert.match(wrapper, /export function openSidePanel\(chrome: ChromeApi, tabId: number\): Promise<void> \{\s*return chrome\.sidePanel\.open\(\{ tabId \}\);/u);
  });

  test('lê uma vez, sem repetir, e só a aba do gesto', () => {
    // Uma leitura por tipo de página: perfil e resultados (RF-38).
    assert.equal((worker.match(/runInTab[<(]/gu) ?? []).length, 2);
    for (const word of ['setTimeout', 'setInterval', 'fetch(', 'XMLHttpRequest', 'tabs.query', 'tabs.update', 'tabs.create', 'alarms', 'allFrames', 'webNavigation']) {
      assert.ok(!worker.includes(word), word);
    }
    assert.ok(!read('platform/chrome/scripting.ts').includes('allFrames'));
  });

  test('os itens do menu de produção são só para perfil e resultados de pessoas, e o gesto confere o endereço', () => {
    assert.ok(worker.includes("patterns: ['https://www.linkedin.com/in/*']"));
    assert.ok(worker.includes("patterns: ['https://www.linkedin.com/search/results/people*']"));
    assert.ok(worker.includes('decideGesture('));
  });
});

describe('leitura de duas janelas e atalho (RF-64, RF-32)', () => {
  test('o gesto leva a janela da aba, para só o painel dela consumir', () => {
    assert.match(worker, /tab\?\.windowId/u);
    assert.match(worker, /\.\.\.pending, windowId/u);
  });

  test('o item do menu aparece sobre página, seleção e link, e continua limitado ao perfil', () => {
    const menu = read('platform/chrome/context-menus.ts');
    assert.match(menu, /contexts: \['page', 'selection', 'link'\]/u);
    assert.match(menu, /documentUrlPatterns: \[\.\.\.item\.patterns\]/u);
  });

  test('o atalho aparece na tela de ligar a leitura e nas mensagens de ajuda', () => {
    assert.ok(read('panel/click-strings.ts').includes('Alt+Shift+T'));
    assert.ok(read('background/gesture.ts').includes('Alt+Shift+T'));
    assert.ok(read('manifest.json').includes('Alt+Shift+T'));
  });
});

describe('nada é inserido na página (RNF-03)', () => {
  test('só a função de leitura vai à página: sem estilo, botão ou elemento novo', () => {
    const page = read('background/read-page.ts');
    for (const word of ['createElement', 'appendChild', 'insertAdjacent', 'innerHTML', 'style', 'classList', 'addEventListener', 'cookie', 'localStorage']) {
      assert.ok(!page.includes(word), word);
    }
    assert.ok(!worker.includes('insertCSS') && !worker.includes('registerContentScripts'));
  });
});
