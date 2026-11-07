// Confere o pacote gerado.
// Uso: node scripts/verify-dist.mjs [--proof] [--dir <pasta>]
//   sem opção: confere dist/ (produção). Com --proof: confere dist-prova/.
//
// Falha (código 1) se: o manifesto falta ou não é JSON; as permissões não são exatamente as da especificação; há
// host_permissions, content_scripts ou web_accessible_resources; a CSP perdeu connect-src 'none'; algum caminho
// citado no manifesto não existe; o .html cita script ou estilo ausente, externo, ou traz script embutido; há
// chave de API; o pacote passa de 1 MB; e, conforme a construção, o caminho de prova está presente (prova) ou
// ausente (produção).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { scanDistFolder } from './check-secrets.mjs';

export const EXPECTED_PERMISSIONS = ['activeTab', 'contextMenus', 'scripting', 'sidePanel', 'storage'];
const MAX_BYTES = 1024 * 1024;
// Marcas do caminho de prova (item de menu em qualquer página e tela de prova da leitura): nenhuma pode aparecer no JavaScript da produção.
const PROOF_MARKERS = ['Analisar esta página', 'proof-preview', 'proof-origin'];
// Marcas do gesto (F09): existem nos dois pacotes. Na produção, o item de menu é só para perfil do LinkedIn.
const GESTURE_MARKERS = ['contextMenus.onClicked', 'commands.onCommand', 'executeScript', 'pendingRead'];
const PRODUCTION_MARKERS = ['Analisar este perfil com a Triagem+', 'https://www.linkedin.com/in/*'];

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

/** Devolve a lista de problemas do pacote em `dir`. */
export function verifyDist(dir, { proof = false } = {}) {
  const errors = [];
  const manifestFile = path.join(dir, 'manifest.json');
  if (!fs.existsSync(manifestFile)) return [`manifesto ausente: ${manifestFile}`];
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  } catch {
    return ['manifest.json não é JSON válido'];
  }

  const perms = [...(manifest.permissions ?? [])].sort();
  if (JSON.stringify(perms) !== JSON.stringify(EXPECTED_PERMISSIONS)) errors.push(`permissões fora do esperado: ${perms.join(', ')}`);
  for (const key of ['host_permissions', 'optional_host_permissions', 'content_scripts', 'web_accessible_resources', 'optional_permissions']) {
    if (manifest[key] !== undefined) errors.push(`manifesto não pode ter ${key}`);
  }
  if (!String(manifest.content_security_policy?.extension_pages ?? '').includes("connect-src 'none'")) errors.push("CSP sem connect-src 'none'");

  const paths = [manifest.background?.service_worker, manifest.side_panel?.default_path, ...Object.values(manifest.icons ?? {}), ...Object.values(manifest.action?.default_icon ?? {})];
  for (const p of paths) if (typeof p === 'string' && !fs.existsSync(path.join(dir, p))) errors.push(`arquivo citado no manifesto não existe: ${p}`);

  const files = walk(dir);
  for (const f of files.filter((x) => x.endsWith('.html'))) {
    const html = fs.readFileSync(f, 'utf8');
    for (const m of html.matchAll(/<script\b([^>]*)>/gi)) {
      const src = /\bsrc="([^"]*)"/.exec(m[1] ?? '')?.[1];
      if (src === undefined) errors.push(`${path.relative(dir, f)}: script embutido`);
      else if (/^[a-z]+:|^\/\//i.test(src) || !fs.existsSync(path.join(path.dirname(f), src))) errors.push(`${path.relative(dir, f)}: script ausente ou externo: ${src}`);
    }
    for (const m of html.matchAll(/<link\b[^>]*\bhref="([^"]*)"/gi)) {
      const href = m[1] ?? '';
      if (/^[a-z]+:|^\/\//i.test(href) || !fs.existsSync(path.join(path.dirname(f), href))) errors.push(`${path.relative(dir, f)}: estilo ausente ou externo: ${href}`);
    }
  }

  const total = files.reduce((n, f) => n + fs.statSync(f).size, 0);
  if (total > MAX_BYTES) errors.push(`pacote com ${total} bytes (limite ${MAX_BYTES})`);

  for (const f of scanDistFolder(dir)) errors.push(`padrão de chave (${f.id}) em ${f.file}:${f.line}`);

  const js = files.filter((f) => f.endsWith('.js')).map((f) => ({ f, text: fs.readFileSync(f, 'utf8') }));
  for (const marker of PROOF_MARKERS) {
    const found = js.some((x) => x.text.includes(marker));
    if (!proof && found) errors.push(`o pacote de produção traz o caminho de prova: "${marker}"`);
    if (proof && !found) errors.push(`o pacote de prova não traz "${marker}"`);
  }
  for (const marker of proof ? GESTURE_MARKERS : [...GESTURE_MARKERS, ...PRODUCTION_MARKERS]) {
    if (!js.some((x) => x.text.includes(marker))) errors.push(`o pacote não traz o gesto de leitura: "${marker}"`);
  }
  return errors;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const argv = process.argv.slice(2);
  const proof = argv.includes('--proof');
  const flag = argv.indexOf('--dir');
  const dir = flag >= 0 && argv[flag + 1] ? path.resolve(argv[flag + 1]) : path.join(root, proof ? 'dist-prova' : 'dist');
  if (!fs.existsSync(dir)) {
    console.error(`verify-dist: ${dir} não existe; rode o build antes`);
    process.exit(1);
  }
  const errors = verifyDist(dir, { proof });
  if (errors.length > 0) {
    for (const e of errors) console.error(`ERRO: ${e}`);
    process.exit(1);
  }
  console.log(`verify-dist: ${path.relative(process.cwd(), dir) || '.'} ok${proof ? ' (prova)' : ''}`);
}
