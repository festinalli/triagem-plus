#!/usr/bin/env node
// Trava contra chave de API no repositório e no pacote. Varre os arquivos versionados e não ignorados
// (git ls-files --cached --others --exclude-standard) e, se pedido, as pastas de build. Nunca imprime o valor
// achado: só o arquivo, a linha e o tipo.
//
// Uso: node scripts/check-secrets.mjs [--root <repositório>] [--dist <pasta>]... [--no-dist]
// Sem --dist e sem --no-dist, varre dist/ e dist-prova/ quando existirem.
// Os padrões são montados por partes para este arquivo não casar a si mesmo.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const SECRET_PATTERNS = Object.freeze([
  Object.freeze({ id: 'google-api-key', re: new RegExp('AIza' + '[0-9A-Za-z_-]{35}') }),
  Object.freeze({ id: 'provider-key-sk-ant', re: new RegExp('sk-ant-' + '[0-9A-Za-z_-]{20,}') }),
  Object.freeze({ id: 'provider-key-sk', re: new RegExp('sk-' + '[0-9A-Za-z]{32,}') }),
  Object.freeze({ id: 'private-key-block', re: new RegExp('-----BEGIN ' + '[A-Z ]*PRIVATE KEY-----') }),
  Object.freeze({ id: 'github-token', re: new RegExp('gh[pousr]_' + '[0-9A-Za-z]{36,}') }),
  Object.freeze({ id: 'aws-access-key', re: new RegExp('AKIA' + '[0-9A-Z]{16}') }),
]);

const SKIP_ROOT_DIRS = new Set(['node_modules', '.git']);
const SKIP_EXTENSIONS = new Set(['.png', '.ico', '.woff', '.woff2']);

/** Acha os padrões em um texto: `[{ line, id }]`, com a linha a partir de 1 e sem o valor. */
export function scanText(text) {
  const out = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    for (const { id, re } of SECRET_PATTERNS) if (re.test(lines[i] ?? '')) out.push({ line: i + 1, id });
  }
  return out;
}

function walk(dir, base = dir, skipRoot = null) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (skipRoot !== null && dir === base && skipRoot.has(e.name)) return [];
    const abs = path.join(dir, e.name);
    return e.isDirectory() ? walk(abs, base) : [path.relative(base, abs).split(path.sep).join('/')];
  });
}

function listSourceFiles(root) {
  try {
    const raw = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return raw.split('\0').filter((f) => f !== '' && fs.existsSync(path.join(root, f)));
  } catch {
    return walk(root, root, SKIP_ROOT_DIRS);
  }
}

function scanFiles(base, files, prefix = '') {
  const findings = [];
  let scanned = 0;
  for (const file of files) {
    if (SKIP_EXTENSIONS.has(path.extname(file).toLowerCase())) continue;
    const buffer = fs.readFileSync(path.join(base, file));
    scanned += 1;
    // latin1: um byte por caractere, cobre UTF-8 e ASCII sem supor codificação.
    for (const hit of scanText(buffer.toString('latin1'))) findings.push({ file: `${prefix}${file}`, ...hit });
  }
  return { findings, scanned };
}

/** Varre o repositório e as pastas de build existentes. */
export function checkSecrets({ root, dists } = {}) {
  const repo = path.resolve(root ?? '.');
  const source = scanFiles(repo, listSourceFiles(repo));
  const findings = [...source.findings];
  let scanned = source.scanned;
  const folders = dists ?? [path.join(repo, 'dist'), path.join(repo, 'dist-prova')];
  for (const dir of folders) {
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) continue;
    const r = scanFiles(dir, walk(dir), `${path.basename(dir)}/`);
    findings.push(...r.findings);
    scanned += r.scanned;
  }
  return { findings, scanned };
}

/** Só a varredura de uma pasta de build (usada por verify-dist). */
export function scanDistFolder(dir) {
  return scanFiles(dir, walk(dir)).findings;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const opts = { root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), dists: undefined };
    const argv = process.argv.slice(2);
    for (let i = 0; i < argv.length; i += 1) {
      if (argv[i] === '--no-dist') opts.dists = [];
      else if ((argv[i] === '--root' || argv[i] === '--dist') && argv[i + 1] !== undefined) {
        const value = path.resolve(process.cwd(), argv[++i] ?? '');
        if (argv[i - 1] === '--root') opts.root = value;
        else (opts.dists ??= []).push(value);
      } else throw new Error(`opção desconhecida: ${argv[i]}`);
    }
    const { findings, scanned } = checkSecrets(opts);
    if (findings.length > 0) {
      for (const f of findings) console.error(`ERRO: padrão de chave (${f.id}) em ${f.file}:${f.line}`);
      console.error(`check-secrets: ${findings.length} achado(s); o valor não é impresso.`);
      process.exit(1);
    }
    console.log(`check-secrets: ok (${scanned} arquivos)`);
  } catch (e) {
    console.error(`check-secrets: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(2);
  }
}
