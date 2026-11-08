// CA-18: permissões exatas, sem acesso fixo a sites, sem script fixo em páginas, CSP sem rede.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'manifest.json'), 'utf8')) as Record<string, any>;

describe('manifesto', () => {
  test('é Manifest V3 e exige Chrome 120 ou mais novo', () => {
    assert.equal(manifest.manifest_version, 3);
    assert.equal(manifest.minimum_chrome_version, '120');
    assert.equal(manifest.name, 'Triagem+');
  });

  test('a lista de permissões é exatamente a da especificação', () => {
    assert.deepEqual([...manifest.permissions].sort(), ['activeTab', 'contextMenus', 'scripting', 'sidePanel', 'storage']);
  });

  test('sem acesso fixo a sites, sem script de conteúdo e sem recursos acessíveis', () => {
    for (const key of ['host_permissions', 'optional_permissions', 'content_scripts', 'web_accessible_resources']) {
      assert.equal(manifest[key], undefined, key);
    }
  });

  test('D-10: a única permissão de site é opcional e só do LinkedIn', () => {
    assert.deepEqual(manifest['optional_host_permissions'], ['https://www.linkedin.com/*']);
  });

  test("a CSP das páginas da extensão bloqueia toda conexão (connect-src 'none')", () => {
    assert.equal(
      manifest.content_security_policy.extension_pages,
      "script-src 'self'; object-src 'self'; connect-src 'none'; base-uri 'none'",
    );
  });

  test('painel lateral, service worker em módulo e comando de teclado próprio', () => {
    assert.equal(manifest.side_panel.default_path, 'panel/panel.html');
    assert.deepEqual(manifest.background, { service_worker: 'background/service-worker.js', type: 'module' });
    assert.equal(manifest.commands['analyze-profile'].suggested_key.default, 'Alt+Shift+T');
    assert.ok(manifest.action.default_title.length > 0);
  });

  test('os ícones existem nos quatro tamanhos', () => {
    for (const size of ['16', '32', '48', '128']) {
      assert.ok(fs.existsSync(path.join(ROOT, 'src', manifest.icons[size])), size);
    }
  });
});
