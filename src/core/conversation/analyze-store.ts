// Analisar e guardar sozinho (RF-36, RF-67, D-08). Uma função serve a tela de colar e, depois, a leitura por clique:
// recebe o texto do perfil, o link, o nome e a origem, analisa pela vaga ativa e põe a pessoa na lista, sem outro clique.
//
// O texto completo nunca vai para o armazenamento permanente (RF-45). Só o texto da última análise fica na memória da
// sessão, junto da chave do perfil, e analisar outro perfil o substitui (RF-34, CA-09). Nada daqui escreve em console:
// nenhum nome, link ou texto de candidato sai por registro (RNF-11).
import type { Candidate, Job, ProfileCard } from '../model.ts';
import { analyzeProfile, mergeCards } from '../match/analyze.ts';
import { buildListingCard } from '../match/card.ts';
import { computeMatch, isListingOnly } from '../match/score.ts';
import { clipProfileText } from '../profile/lines.ts';
import { canonicalProfileUrl, mergeProfileText, profileKeyOf } from '../profile/merge.ts';
import { parseResults } from '../results/parse.ts';
import type { RawResult } from '../results/parse.ts';
import type { Store } from '../store/store.ts';
import { needsAcceptance } from './build.ts';
import { startsWithHttps } from './links.ts';

/** O texto da última análise, com a chave do perfil a que pertence (RF-34). */
export interface StoredText {
  readonly profileKey: string | null;
  readonly candidateId: string;
  readonly jobId: string;
  readonly text: string;
}

/** A memória da sessão, como o painel a enxerga. No navegador é chrome.storage.session; nos testes, um objeto simples. */
export interface TextMemory {
  read(): Promise<StoredText | null>;
  write(value: StoredText): Promise<void>;
  clear(): Promise<void>;
}

export interface AnalyzeInput {
  readonly text: string;
  readonly url: string;
  /** Nome escolhido pela pessoa. Vazio ou nulo: vale o que o leitor achou. */
  readonly name: string | null;
  readonly source: 'pasted' | 'clicked';
  /** "Somar mais texto": a pessoa já guardada a que o texto novo se soma, mesmo que o link não seja de perfil (RF-34). */
  readonly candidateId?: string;
}

export type AnalyzeFailure = 'no_acceptance' | 'no_job' | 'no_requirements' | 'empty_text' | 'nothing_read' | 'bad_url' | 'no_name' | 'save_failed';

export type AnalyzeOutcome =
  | {
      readonly ok: true;
      readonly candidateId: string;
      /** A pessoa já estava na lista e a ficha foi atualizada (RF-64). */
      readonly updated: boolean;
      /** Era a mesma pessoa e o texto não trouxe nada novo. */
      readonly addedNothing: boolean;
      /** O link não é de perfil do LinkedIn: a tela avisa e deixa seguir (RF-30). */
      readonly notProfileLink: boolean;
    }
  | { readonly ok: false; readonly reason: AnalyzeFailure };

export interface AnalyzeDeps {
  readonly store: Store;
  readonly memory: TextMemory;
  readonly now: () => number;
  readonly newId: () => string;
}

const MAX_NAME_CHARS = 120;

export function cleanName(raw: string | null | undefined): string {
  return (raw ?? '')
    .replace(/\p{Cs}/gu, '')
    .replace(/[\p{Cc}\p{Cf}]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, MAX_NAME_CHARS);
}

/** O mês atual, do relógio recebido (nunca lido aqui dentro). */
function monthOf(now: number): { year: number; month: number } {
  const date = new Date(now);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

function sameCard(a: ProfileCard, b: ProfileCard): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function activeJobOf(store: Store): Promise<Job | null> {
  const settings = await store.getSettings();
  if (needsAcceptance(settings)) return null;
  if (settings.activeJobId === null) return null;
  const job = await store.getJob(settings.activeJobId);
  return job === null || job.archived ? null : job;
}

/** Grava por id, para quem não tem link de perfil que o reconheça. */
async function saveExisting(store: Store, candidate: Candidate): Promise<Candidate> {
  await store.saveCandidate(candidate);
  return candidate;
}

/** Quem veio da lista sem nome legível. A pessoa continua na lista, com o link, para conferir (RF-39). */
export const NAME_NOT_READ = 'Nome não lido';

function knownName(candidate: Candidate | undefined): string {
  return candidate === undefined || candidate.name === NAME_NOT_READ ? '' : candidate.name;
}

export async function analyzeAndStore(deps: AnalyzeDeps, input: AnalyzeInput): Promise<AnalyzeOutcome> {
  const { store, memory } = deps;
  try {
    const settings = await store.getSettings();
    if (needsAcceptance(settings)) return { ok: false, reason: 'no_acceptance' };
    const job = await activeJobOf(store);
    if (job === null) return { ok: false, reason: 'no_job' };
    if (job.requirements.length === 0) return { ok: false, reason: 'no_requirements' };
    if (input.text.trim() === '') return { ok: false, reason: 'empty_text' };
    const url = input.url.trim();
    if (!startsWithHttps(url)) return { ok: false, reason: 'bad_url' };

    const now = deps.now();
    const key = profileKeyOf(url);
    const everyone = (await store.listAllCandidates()).items;
    const inJob = everyone.filter((item) => item.jobId === job.id);
    const byId = input.candidateId === undefined ? undefined : inJob.find((item) => item.id === input.candidateId);
    const existing = byId ?? (key === null ? undefined : inJob.find((item) => item.profileKey === key));
    // O nome corrigido em outra vaga vale para esta também (RF-91).
    const sibling = key === null ? undefined : everyone.find((item) => item.profileKey === key);

    // Mesmo perfil e texto ainda na memória: soma o texto novo ao anterior (RF-34). Sem o texto, a ficha é que se soma.
    const stored = await memory.read().catch(() => null);
    const base = stored !== null && existing !== undefined && stored.candidateId === existing.id && stored.jobId === job.id ? stored.text : null;
    const combined = base === null ? input.text : mergeProfileText(base, input.text);

    const analysis = analyzeProfile({ text: combined, url, requirements: job.requirements, asOf: monthOf(now) });
    if (analysis.card.sectionsRead.length === 0) return { ok: false, reason: 'nothing_read' };

    // O nome guardado vale mais do que o que veio do texto: corrigir um nome não se desfaz ao analisar de novo (RF-91).
    const name = knownName(existing) || knownName(sibling) || cleanName(input.name) || cleanName(analysis.name);
    if (name === '') return { ok: false, reason: 'no_name' };

    const card = existing === undefined ? analysis.card : mergeCards(existing.card, analysis.card);
    const incoming: Candidate = {
      id: existing?.id ?? deps.newId(),
      jobId: job.id,
      name,
      profileUrl: canonicalProfileUrl(url) ?? url,
      profileKey: key,
      card,
      match: computeMatch(card, job.requirements),
      stage: existing?.stage ?? 'new',
      favorite: existing?.favorite ?? false,
      notes: existing?.notes ?? '',
      informedAt: existing?.informedAt ?? null,
      source: input.source,
      addedAt: existing?.addedAt ?? now,
      updatedAt: now,
    };
    const saved: { outcome: 'created' | 'updated'; candidate: Candidate } =
      byId === undefined ? await store.upsertByProfile(incoming) : { outcome: 'updated', candidate: await saveExisting(store, incoming) };

    // O perfil aberto trouxe o nome que a lista não deu. A gravação por perfil mantém o nome antigo de propósito (RF-91).
    if (existing?.name === NAME_NOT_READ) await store.saveCandidate({ ...saved.candidate, name });

    // Só agora o texto anterior sai da memória: analisar outro perfil o substitui (CA-09). Falha aqui não perde a ficha.
    await memory.write({ profileKey: key, candidateId: saved.candidate.id, jobId: job.id, text: clipProfileText(combined) }).catch(() => undefined);

    return {
      ok: true,
      candidateId: saved.candidate.id,
      updated: saved.outcome === 'updated',
      addedNothing: existing !== undefined && sameCard(existing.card, card),
      notProfileLink: key === null,
    };
  } catch {
    return { ok: false, reason: 'save_failed' };
  }
}

export type ListingFailure = 'no_acceptance' | 'no_job' | 'no_requirements' | 'no_listing_requirement' | 'nothing_read' | 'save_failed';

export type ListingOutcome =
  | {
      readonly ok: true;
      /** Pessoas que a página mostrou. */
      readonly read: number;
      readonly created: number;
      /** Já estavam na lista só com pré-nota, e a ficha somou o que veio. */
      readonly updated: number;
      /** Já têm nota completa: nada muda (RF-39). */
      readonly kept: number;
      /** Não mostraram nada do que a vaga pede: não são guardadas (RF-39). */
      readonly nothingSeen: number;
      /** Entraram sem nome legível: dá para conferir pelo link. */
      readonly noName: number;
      /** Não coube guardar: a leitura parou aí. */
      readonly failed: number;
    }
  | { readonly ok: false; readonly reason: ListingFailure };

/**
 * Analisa as pessoas de uma página de resultados pela vaga ativa (D-09, RF-39). O texto da página não fica guardado: de cada
 * pessoa sai a ficha, o nome e o link. Quem já tem nota completa não muda, e quem não mostrou nada do que a vaga pede não entra.
 */
export async function analyzeListing(deps: AnalyzeDeps, items: readonly RawResult[]): Promise<ListingOutcome> {
  const { store, memory } = deps;
  try {
    const settings = await store.getSettings();
    if (needsAcceptance(settings)) return { ok: false, reason: 'no_acceptance' };
    const job = await activeJobOf(store);
    if (job === null) return { ok: false, reason: 'no_job' };
    if (job.requirements.length === 0) return { ok: false, reason: 'no_requirements' };
    const entries = parseResults(items);
    // A vaga só pede o que a lista nunca mostra: dizer que ninguém "mostrou" seria falso.
    const blank = computeMatch(buildListingCard({ headline: '', details: '' }, job.requirements), job.requirements);
    if (blank.results.every((result) => result.status === 'needs_reanalysis')) return { ok: false, reason: 'no_listing_requirement' };
    if (entries.length === 0) return { ok: false, reason: 'nothing_read' };

    const now = deps.now();
    const everyone = (await store.listAllCandidates()).items;
    const counts = { created: 0, updated: 0, kept: 0, nothingSeen: 0, noName: 0, failed: 0 };
    for (const entry of entries) {
      const existing = everyone.find((item) => item.jobId === job.id && item.profileKey === entry.key);
      if (existing !== undefined && !isListingOnly(existing.card)) {
        counts.kept += 1;
        continue;
      }
      const fresh = buildListingCard(entry, job.requirements);
      const card = existing === undefined ? fresh : mergeCards(existing.card, fresh);
      const match = computeMatch(card, job.requirements);
      if (existing === undefined && match.results.every((result) => result.credit === 0)) {
        counts.nothingSeen += 1;
        continue;
      }
      // O nome corrigido em outra vaga vale para esta também (RF-91).
      const sibling = everyone.find((item) => item.profileKey === entry.key);
      const name = existing?.name || knownName(sibling) || cleanName(entry.name) || NAME_NOT_READ;
      if (name === NAME_NOT_READ) counts.noName += 1;
      try {
        await store.upsertByProfile({
          id: existing?.id ?? deps.newId(),
          jobId: job.id,
          name,
          profileUrl: entry.url,
          profileKey: entry.key,
          card,
          match,
          stage: existing?.stage ?? 'new',
          favorite: existing?.favorite ?? false,
          notes: existing?.notes ?? '',
          informedAt: existing?.informedAt ?? null,
          source: 'results',
          addedAt: existing?.addedAt ?? now,
          updatedAt: now,
        });
      } catch {
        counts.failed = entries.length - counts.created - counts.updated - counts.kept - counts.nothingSeen - counts.noName;
        break;
      }
      if (existing === undefined) counts.created += 1;
      else counts.updated += 1;
    }
    if (counts.failed > 0 && counts.created + counts.updated === 0) return { ok: false, reason: 'save_failed' };
    // Ler outras pessoas substitui o texto da última análise (CA-09).
    await memory.clear().catch(() => undefined);
    return { ok: true, read: entries.length, ...counts };
  } catch {
    return { ok: false, reason: 'save_failed' };
  }
}

/** Tirar da lista (RF-36): apaga a ficha e, se o texto em memória era dela, o texto também. */
export async function removeCandidate(deps: Pick<AnalyzeDeps, 'store' | 'memory'>, candidateId: string): Promise<boolean> {
  try {
    await deps.store.deleteCandidate(candidateId);
    const stored = await deps.memory.read().catch(() => null);
    if (stored !== null && stored.candidateId === candidateId) await deps.memory.clear().catch(() => undefined);
    return true;
  } catch {
    return false;
  }
}

/** Requisitos mudaram (RF-55): refaz a nota de todos da vaga pela ficha. O prazo de guarda não é renovado. */
export async function recomputeMatches(store: Store, job: Job): Promise<number> {
  const { items } = await store.listCandidates(job.id);
  let changed = 0;
  for (const candidate of items) {
    const match = computeMatch(candidate.card, job.requirements);
    if (JSON.stringify(match) === JSON.stringify(candidate.match)) continue;
    await store.saveCandidate({ ...candidate, match });
    changed += 1;
  }
  return changed;
}

/**
 * O texto da memória só vale enquanto o candidato dele existe (RF-36, RF-45, RF-69). Apagar a vaga, a pessoa, vencer o prazo,
 * apagar tudo ou apagar em outra janela: em qualquer caso o texto sai. Verdadeiro quando saiu.
 */
export async function reconcileMemory(store: Store, memory: TextMemory): Promise<boolean> {
  try {
    const stored = await memory.read().catch(() => null);
    if (stored === null) return false;
    if ((await store.getCandidate(stored.candidateId)) !== null) return false;
    await memory.clear();
    return true;
  } catch {
    return false;
  }
}
