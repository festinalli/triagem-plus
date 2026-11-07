import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { readPage } from '../../src/background/read-page.ts';

/**
 * O jsdom não implementa innerText (não há layout). Para o teste, o elemento ganha um innerText que devolve o
 * textContent: é um substituto, não o comportamento do navegador (que respeita CSS e quebras de linha).
 */
function withInnerText(el: Element | null): void {
  if (el === null) return;
  Object.defineProperty(el, 'innerText', { get: () => el.textContent ?? '', configurable: true });
}

function run(html: string, fallbackToBody: boolean) {
  const dom = new JSDOM(html, { url: 'https://exemplo.test/pagina' });
  const { document } = dom.window;
  withInnerText(document.querySelector('main'));
  withInnerText(document.body);
  const g = globalThis as Record<string, unknown>;
  g.document = document;
  g.location = dom.window.location;
  try {
    return readPage(fallbackToBody);
  } finally {
    delete g.document;
    delete g.location;
    dom.window.close();
  }
}

describe('readPage', () => {
  test('lê o texto de main, o endereço e o título', () => {
    const r = run('<title>Perfil</title><body><nav>menu</nav><main>texto do main</main></body>', false);
    assert.deepEqual(r, { text: 'texto do main', url: 'https://exemplo.test/pagina', title: 'Perfil' });
  });

  test('com main, ignora o fallback e não traz o resto da página', () => {
    const r = run('<body><nav>menu</nav><main>so main</main></body>', true);
    assert.equal(r.text, 'so main');
  });

  test('sem main e sem fallback devolve texto vazio', () => {
    const r = run('<title>T</title><body>corpo da página</body>', false);
    assert.equal(r.text, '');
    assert.equal(r.title, 'T');
  });

  test('sem main e com fallback lê o body', () => {
    const r = run('<body>corpo da página</body>', true);
    assert.equal(r.text, 'corpo da página');
  });
});

describe('readPage é só leitura', () => {
  const source = readPage.toString();
  const forbidden = ['location.assign', 'location.href =', '.click(', 'scroll', 'setTimeout', 'setInterval', 'fetch', 'XMLHttpRequest'];
  for (const word of forbidden) {
    test(`o texto da função não contém ${word}`, () => {
      assert.ok(!source.includes(word), word);
    });
  }

  test('o texto da função não depende de nada fora dela', () => {
    assert.ok(source.startsWith('function readPage') || source.startsWith('readPage'));
    assert.ok(!/\bimport\b|\brequire\b|\bchrome\b/.test(source));
  });
});
