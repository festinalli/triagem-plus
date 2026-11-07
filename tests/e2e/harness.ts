// Harness mínimo: abre um Chromium com a extensão carregada, registra todo pedido de rede da sessão (páginas e
// service worker, via eventos do Playwright, e o navegador inteiro via net-log) e serve uma página local de controle.
import { chromium } from 'playwright';
import type { BrowserContext, Page, Request, Worker } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export interface Recorded {
  url: string;
  /** Quem pediu: 'service-worker', o endereço do quadro que pediu, ou 'desconhecido'. */
  origin: string;
}

export interface Harness {
  context: BrowserContext;
  worker: Worker;
  extensionId: string;
  requests: Recorded[];
  /** Caminhos pedidos ao servidor local de controle, em ordem. */
  serverHits: string[];
  controlUrl: string;
  /** Fecha o navegador e devolve o texto do net-log. */
  close: () => Promise<string>;
}

function originOfRequest(request: Request): string {
  try {
    if (request.serviceWorker() !== null) return 'service-worker';
  } catch {
    // sem serviceWorker()
  }
  try {
    return request.frame().url();
  } catch {
    return 'desconhecido';
  }
}

/** Chromiums instalados pelo Playwright em %LOCALAPPDATA%\ms-playwright (ou ~/.cache/ms-playwright), do mais novo ao mais antigo. */
function installedChromiums(): string[] {
  const roots = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'ms-playwright') : undefined,
    path.join(os.homedir(), '.cache', 'ms-playwright'),
  ].filter((r): r is string => !!r && fs.existsSync(r));
  const found: { rev: number; exe: string }[] = [];
  for (const root of roots) {
    for (const name of fs.readdirSync(root)) {
      const m = /^chromium-(\d+)$/.exec(name);
      if (!m) continue;
      for (const rel of ['chrome-win64/chrome.exe', 'chrome-win/chrome.exe', 'chrome-linux64/chrome', 'chrome-linux/chrome']) {
        const exe = path.join(root, name, rel);
        if (fs.existsSync(exe)) found.push({ rev: Number(m[1]), exe });
      }
    }
  }
  return found.sort((a, b) => b.rev - a.rev).map((f) => f.exe);
}

export async function launch(dist: string): Promise<Harness> {
  if (!fs.existsSync(path.join(dist, 'manifest.json'))) throw new Error(`${dist} não existe: rode o build antes`);

  const serverHits: string[] = [];
  const server = http.createServer((req, res) => {
    serverHits.push(req.url ?? '');
    if (req.url === '/') {
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.end('<!doctype html><title>controle</title><main>página local de controle</main>');
    } else {
      res.setHeader('content-type', 'text/plain');
      res.end('ok');
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as { port: number }).port;

  // O Playwright só entrega os pedidos do service worker com esta variável, definida antes do lançamento.
  process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = '1';
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'triagem-e2e-'));
  const netLogPath = path.join(tmp, 'net-log.json');
  const launchWith = (executablePath: string | undefined): Promise<BrowserContext> =>
    chromium.launchPersistentContext(path.join(tmp, `profile-${Math.random().toString(36).slice(2)}`), {
      channel: 'chromium',
      ...(executablePath ? { executablePath } : {}),
      headless: process.env.TRIAGEM_HEADED !== '1',
      args: [
        `--disable-extensions-except=${dist}`,
        `--load-extension=${dist}`,
        `--log-net-log=${netLogPath}`,
        '--net-log-capture-mode=Everything',
        // Nada resolve fora da máquina: um pedido externo falharia e ainda ficaria registrado.
        '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost',
        '--no-proxy-server',
      ],
    });
  let context: BrowserContext;
  try {
    // Se o Chromium baixado pelo Playwright for bloqueado pelo sistema, aponte TRIAGEM_CHROMIUM_PATH para outro que aceite --load-extension.
    // Sem a variável, tenta o padrão e, se o sistema o recusar, os outros instalados, do mais novo ao mais antigo.
    if (process.env.TRIAGEM_CHROMIUM_PATH) {
      context = await launchWith(process.env.TRIAGEM_CHROMIUM_PATH);
    } else {
      try {
        context = await launchWith(undefined);
      } catch (first) {
        if (!/spawn|UNKNOWN|EPERM|EACCES/i.test(String(first))) throw first;
        let found: BrowserContext | undefined;
        for (const candidate of installedChromiums()) {
          try {
            found = await launchWith(candidate);
            break;
          } catch {
            // este também não abre; tenta o próximo
          }
        }
        if (!found) throw first;
        context = found;
      }
    }
  } catch (e) {
    server.close();
    fs.rmSync(tmp, { recursive: true, force: true });
    throw e;
  }

  const requests: Recorded[] = [];
  context.on('request', (request) => {
    requests.push({ url: request.url(), origin: originOfRequest(request) });
  });

  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker', { timeout: 30_000 }));
  const extensionId = new URL(worker.url()).host;

  return {
    context,
    worker,
    extensionId,
    requests,
    serverHits,
    controlUrl: `http://127.0.0.1:${port}/`,
    close: async () => {
      await context.close().catch(() => undefined);
      server.close();
      const log = fs.existsSync(netLogPath) ? fs.readFileSync(netLogPath, 'utf8') : '';
      fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
      return log;
    },
  };
}

/** Abre o painel numa aba comum e junta os erros de console e de página. */
export async function openPanel(h: Harness): Promise<{ page: Page; errors: string[] }> {
  const page = await h.context.newPage();
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`chrome-extension://${h.extensionId}/panel/panel.html`);
  return { page, errors };
}

/** Esvazia o armazenamento local da extensão, para cada teste começar do zero. */
export async function resetStorage(h: Harness): Promise<void> {
  await h.worker.evaluate(() => chrome.storage.local.clear());
}

/** Lê tudo o que está no armazenamento local da extensão. */
export async function readStorage(h: Harness): Promise<Record<string, unknown>> {
  return h.worker.evaluate(() => chrome.storage.local.get(null) as Promise<Record<string, unknown>>);
}

/**
 * Impede qualquer acesso ao LinkedIn nos testes: o pedido é abortado antes de sair e só o endereço fica registrado.
 * Devolve a lista de endereços que a página tentou abrir, em ordem.
 */
export async function trapLinkedIn(h: Harness): Promise<string[]> {
  const hits: string[] = [];
  await h.context.route(/^https?:\/\/([^/]*\.)?linkedin\.com(\/|$)/i, (route) => {
    hits.push(route.request().url());
    return route.abort();
  });
  return hits;
}

interface NetLogEvent {
  type: number;
  params?: Record<string, unknown>;
}

/** Pedidos que não são de rede: recursos da própria extensão e esquemas locais. */
const isLocalScheme = (url: string): boolean => /^(chrome-extension|data|blob|about|chrome|devtools):/i.test(url);

/** Pedidos de páginas da extensão ou do service worker para qualquer coisa que não seja recurso local. */
export function extensionRequests(h: Harness): Recorded[] {
  return h.requests.filter((r) => (r.origin === 'service-worker' || r.origin.startsWith('chrome-extension://')) && !isLocalScheme(r.url));
}

/** Pedidos de rede do net-log que têm a extensão como iniciadora. Os do próprio navegador não entram. */
export function netLogExtensionJobs(rawLog: string): { jobs: { url: string; initiator: string }[]; fromExtension: { url: string; initiator: string }[] } {
  const log = JSON.parse(rawLog) as { constants: { logEventTypes: Record<string, number> }; events: NetLogEvent[] };
  const startJob = log.constants.logEventTypes['URL_REQUEST_START_JOB'];
  const jobs = log.events
    .filter((e) => e.type === startJob && typeof e.params?.['url'] === 'string')
    .map((e) => ({ url: String(e.params?.['url']), initiator: String(e.params?.['initiator'] ?? ''), key: String(e.params?.['network_isolation_key'] ?? '') }));
  const fromExtension = jobs.filter((j) => /^(https?|wss?|ftp):/i.test(j.url) && (j.initiator.includes('chrome-extension://') || j.key.includes('chrome-extension://')));
  return { jobs, fromExtension };
}

/** Esvazia a memória da sessão da extensão (o texto da última análise vive ali). */
export async function resetSession(h: Harness): Promise<void> {
  await h.worker.evaluate(() => chrome.storage.session.clear());
}

/** Lê tudo o que está na memória da sessão da extensão. */
export async function readSession(h: Harness): Promise<Record<string, unknown>> {
  return h.worker.evaluate(() => chrome.storage.session.get(null) as Promise<Record<string, unknown>>);
}

/** Grava registros direto no armazenamento local, como se o painel já os tivesse guardado. */
export async function seedStorage(h: Harness, items: Record<string, unknown>): Promise<void> {
  await h.worker.evaluate((data) => chrome.storage.local.set(data), items);
}
