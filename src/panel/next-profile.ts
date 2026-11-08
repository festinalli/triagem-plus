// O botão Próximo perfil (D-11, RF-26). Cada clique abre um perfil da lista que só tem pré-nota, espera a página carregar e
// lê o perfil, como o botão Ler esta página. A pré-nota vira nota completa. É um perfil por clique: nada é aberto, rolado ou
// lido sozinho, e a extensão nunca passa de um perfil para o outro sem o clique. Se o LinkedIn mostrar o login ou uma
// verificação, a leitura para e o painel diz. Nada de nome, endereço ou texto vai para console ou mensagem (RNF-11).
import { clickReadActive, decideGesture, MESSAGES } from '../background/gesture.ts';
import { readPage } from '../background/read-page.ts';
import { waitForMain } from '../background/wait-main.ts';
import type { Candidate } from '../core/model.ts';
import type { PageRead } from '../core/page-read.ts';
import { sortCandidates } from '../core/match/rank.ts';
import { isListingOnly } from '../core/match/score.ts';
import { canonicalProfileUrl } from '../core/profile/merge.ts';
import { globalChrome } from '../platform/chrome/api.ts';
import { requestLinkedInAccess } from '../platform/chrome/permissions.ts';
import { openInProfileTab } from '../platform/chrome/profile-tab.ts';
import type { OpenedTab } from '../platform/chrome/profile-tab.ts';
import { runInTab } from '../platform/chrome/scripting.ts';
import type { Controller } from './app.ts';
import { analyzeRead, say } from './click-consume.ts';
import { CLICK_MESSAGES, NEXT_PROFILE } from './click-strings.ts';

/** Prazo para o Chrome terminar de carregar a página. */
const LOAD_TIMEOUT_MS = 30_000;
/** Prazo para o texto do perfil aparecer, e quanto tempo ele precisa ficar parado. */
const CONTENT_MAX_MS = 15_000;
const CONTENT_STABLE_MS = 1_500;

export interface NextTarget {
  readonly id: string;
  /** O link limpo do perfil: só https://www.linkedin.com/in/<nome>/ chega a ser aberto. */
  readonly url: string;
}

function targetOf(candidate: Candidate): NextTarget | null {
  if (!isListingOnly(candidate.card)) return null;
  const url = canonicalProfileUrl(candidate.profileUrl);
  return url === null ? null : { id: candidate.id, url };
}

/** Quem ainda só tem pré-nota e tem link de perfil, na ordem da lista. */
export function pendingTargets(candidates: readonly Candidate[]): NextTarget[] {
  return sortCandidates(candidates).flatMap((candidate) => targetOf(candidate) ?? []);
}

/** O próximo a abrir: o primeiro da lista que ainda não falhou nesta sessão do painel. */
export function nextTarget(candidates: readonly Candidate[], failed: ReadonlySet<string>): NextTarget | null {
  return pendingTargets(candidates).find((target) => !failed.has(target.id)) ?? null;
}

export interface NextProfileDeps {
  /** O pedido de permissão, já feito no clique. */
  readonly access: Promise<boolean>;
  readonly open: (url: string) => Promise<OpenedTab | undefined>;
  readonly waitContent: (tabId: number) => Promise<unknown>;
  readonly readProfile: (tabId: number) => Promise<PageRead | undefined>;
}

/** `opened`: o perfil chegou a abrir, então a falha é dele, e o próximo clique passa para outra pessoa. */
export type NextOutcome = { readonly ok: true; readonly read: PageRead } | { readonly ok: false; readonly error: string; readonly opened: boolean };

export async function openAndRead(target: NextTarget, deps: NextProfileDeps): Promise<NextOutcome> {
  if (!(await deps.access.catch(() => false))) return { ok: false, error: NEXT_PROFILE.noAccess, opened: false };
  const tab = await deps.open(target.url).catch(() => undefined);
  if (tab === undefined) return { ok: false, error: NEXT_PROFILE.notOpened, opened: false };
  // O login, uma verificação ou outra página no lugar do perfil: nada é lido, e a pessoa resolve na aba.
  if (decideGesture({ enabled: true, tabUrl: tab.url }) !== 'read') return { ok: false, error: NEXT_PROFILE.notProfile, opened: false };
  try {
    await deps.waitContent(tab.tabId).catch(() => undefined);
    const read = await deps.readProfile(tab.tabId);
    if (read === undefined || read.text.trim() === '') return { ok: false, error: NEXT_PROFILE.nothingRead, opened: true };
    return { ok: true, read };
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.message.includes('Cannot access') ? MESSAGES.blocked : NEXT_PROFILE.nothingRead, opened: true };
  }
}

let busy = false;
/** Quem abriu e não deu para ler: o próximo clique passa para outra pessoa. Vive só enquanto o painel está aberto. */
const failed = new Set<string>();

/** O clique no botão. Repetir o clique enquanto abre não faz nada. */
export function readNextProfile(ctl: Controller): void {
  if (busy) return;
  const snapshot = ctl.snapshot();
  if (!clickReadActive(snapshot.settings)) return say(ctl, MESSAGES.off);
  if (pendingTargets(snapshot.candidates).length === 0) return say(ctl, NEXT_PROFILE.none);
  const target = nextTarget(snapshot.candidates, failed);
  if (target === null) {
    failed.clear();
    return say(ctl, NEXT_PROFILE.allTried);
  }
  const chrome = globalChrome();
  // O Chrome só mostra o pedido de permissão durante o clique: ele vem antes de qualquer espera.
  const access = requestLinkedInAccess(chrome);
  busy = true;
  // Mostra que algo está acontecendo. A próxima tela, de resultado ou de erro, tira o aviso.
  ctl.ui.flash = NEXT_PROFILE.opening;
  ctl.redraw();
  void openAndRead(target, {
    access,
    open: (url) => openInProfileTab(chrome, url, LOAD_TIMEOUT_MS),
    waitContent: (tabId) => runInTab<[number, number], Promise<boolean>>(chrome, tabId, waitForMain, [CONTENT_MAX_MS, CONTENT_STABLE_MS]),
    readProfile: (tabId) => runInTab<[boolean], PageRead>(chrome, tabId, readPage, [false]),
  })
    .then(async (outcome) => {
      if (!outcome.ok) {
        if (outcome.opened) failed.add(target.id);
        return say(ctl, outcome.error);
      }
      if (!(await analyzeRead(ctl, outcome.read, target.id))) failed.add(target.id);
    })
    .catch(() => say(ctl, CLICK_MESSAGES.readError))
    .finally(() => {
      busy = false;
    });
}
