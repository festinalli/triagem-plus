// Gera a extensão descompactada.
// Uso: node scripts/build.mjs [--proof] [--outdir <pasta>]
//   sem opção  -> dist/        (produção: o gesto só age com a leitura por clique ligada, e só em perfil do LinkedIn)
//   --proof    -> dist-prova/  (prova: menu e atalho de leitura em qualquer página, __PROOF_BUILD__ verdadeiro)
// Entradas: src/background/service-worker.ts e src/panel/panel.ts (ESM). Arquivos .html, .css, .png e .json
// de src/ são copiados como estão. A pasta de saída é apagada a cada build, então só é aceita se não existir,
// estiver vazia ou for um pacote anterior (tem build-info.json).
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATIC = new Set(['.html', '.css', '.png', '.json']);
const ENTRIES = { 'background/service-worker': 'src/background/service-worker.ts', 'panel/panel': 'src/panel/panel.ts' };
const MARKER = 'build-info.json';

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

function assertSafeOutdir(out) {
  const rel = path.relative(out, ROOT);
  const insideOut = rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
  const srcRel = path.relative(path.join(ROOT, 'src'), out);
  const insideSrc = !srcRel.startsWith('..') && !path.isAbsolute(srcRel);
  if (insideOut || insideSrc) throw new Error(`pasta de saída recusada: ${out}`);
  if (!fs.existsSync(out) || fs.readdirSync(out).length === 0) return;
  if (!fs.existsSync(path.join(out, MARKER))) throw new Error(`pasta de saída recusada (não vazia e sem ${MARKER}): ${out}`);
}

export async function buildPackage({ proof = false, outdir, logLevel = 'silent' } = {}) {
  const out = path.resolve(outdir ?? path.join(ROOT, proof ? 'dist-prova' : 'dist'));
  assertSafeOutdir(out);
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'manifest.json'), 'utf8'));

  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, MARKER), `${JSON.stringify({ version: manifest.version, proof }, null, 2)}\n`);

  const src = path.join(ROOT, 'src');
  for (const f of walk(src)) {
    if (!STATIC.has(path.extname(f))) continue;
    const dest = path.join(out, path.relative(src, f));
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(f, dest);
  }

  await build({
    absWorkingDir: ROOT,
    entryPoints: ENTRIES,
    bundle: true,
    outdir: out,
    format: 'esm',
    target: 'chrome120',
    sourcemap: false,
    legalComments: 'none',
    charset: 'utf8',
    // Elimina o código atrás de __PROOF_BUILD__ quando ele é falso.
    minifySyntax: true,
    logLevel,
    define: { __PROOF_BUILD__: proof ? 'true' : 'false' },
  });
  return { outdir: out, proof };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2);
    const opts = { proof: false, logLevel: 'info' };
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--proof') opts.proof = true;
      else if (args[i] === '--outdir' && args[i + 1]) opts.outdir = path.resolve(process.cwd(), args[++i]);
      else throw new Error(`opção desconhecida: ${args[i]}`);
    }
    const { outdir } = await buildPackage(opts);
    console.log(`${path.relative(process.cwd(), outdir) || '.'}/ pronto${opts.proof ? ' (prova)' : ''}`);
  } catch (e) {
    console.error(`build falhou: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
}
