// Privacidade (RF-91 a RF-94, FL-9): achar uma pessoa em todas as vagas, ver tudo o que está guardado sobre ela, corrigir
// nome e link, e as mensagens da tela. Só dados e ids: o texto da tela mora em src/panel/strings.ts.
// Nada daqui escreve nome, link ou texto de candidato em registro ou em mensagem de erro (RNF-11).
import type { Band, Candidate, Job, ProfileSection, Stage } from '../model.ts';
import { isScored } from '../match/score.ts';
import { canonicalProfileUrl, profileKeyOf } from '../profile/merge.ts';
import { expiresAt } from '../store/retention.ts';
import { storageState, STORAGE_LIMIT_BYTES } from '../store/retention.ts';
import type { StorageState } from '../store/retention.ts';
import type { Store } from '../store/store.ts';
import { safeHttpsLink, startsWithHttps } from './links.ts';
import type { Action, ActionId, ConversationInput, ConversationRule } from './build.ts';

interface Base {
  readonly id: string;
  readonly actions: readonly Action[];
}

/** O que a tela de Privacidade sabe e a conversa não guarda (RF-69): vem do painel a cada desenho. */
export interface PrivacyInput {
  /** Espaço em uso, em bytes. Nulo enquanto não foi lido. */
  readonly bytes: number | null;
  /** O que foi digitado na busca. */
  readonly query: string;
  /** Registros achados, já com todos os registros das mesmas pessoas. Nulo: ainda não buscou. */
  readonly found: readonly Candidate[] | null;
  /** Quem está sendo corrigido agora (id de um dos registros). */
  readonly editing: string | null;
}

export const NO_PRIVACY: PrivacyInput = { bytes: null, query: '', found: null, editing: null };

// ---------- o que a tela mostra sobre uma pessoa ----------

/** Um registro guardado: uma pessoa em uma vaga. Tudo o que existe no armazenamento, sem texto de perfil (RF-45). */
export interface StoredRecord {
  readonly id: string;
  readonly jobTitle: string | null;
  readonly stage: Stage;
  readonly scored: boolean;
  readonly score: number;
  readonly band: Band;
  readonly currentTitle: string | null;
  readonly totalMonths: number | null;
  readonly terms: readonly string[];
  readonly sectionsRead: readonly ProfileSection[];
  readonly favorite: boolean;
  readonly notes: string;
  readonly informedAt: number | null;
  readonly source: 'pasted' | 'clicked' | 'results';
  readonly addedAt: number;
  readonly updatedAt: number;
  readonly expiresAt: number;
}

export interface PersonGroup {
  /** Id de um dos registros: serve para pedir exportar, corrigir e apagar a pessoa toda. */
  readonly id: string;
  readonly name: string;
  readonly link: string | null;
  readonly linkText: string;
  readonly records: readonly StoredRecord[];
}

/** Agrupa os registros por pessoa: mesmo trecho /in/<nome>/ é a mesma pessoa; sem ele, cada registro é uma pessoa. */
export function groupPeople(found: readonly Candidate[], jobs: readonly Job[], retentionDays: number): PersonGroup[] {
  const titles = new Map(jobs.map((job) => [job.id, job.title]));
  const groups = new Map<string, Candidate[]>();
  for (const candidate of found) {
    const key = candidate.profileKey ?? `id:${candidate.id}`;
    groups.set(key, [...(groups.get(key) ?? []), candidate]);
  }
  return [...groups.values()].map((list) => {
    const ordered = [...list].sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id));
    const first = ordered[0] as Candidate;
    return {
      id: first.id,
      name: first.name,
      link: safeHttpsLink(first.profileUrl),
      linkText: first.profileUrl,
      records: ordered.map((candidate) => ({
        id: candidate.id,
        jobTitle: titles.get(candidate.jobId) ?? null,
        stage: candidate.stage,
        scored: isScored(candidate.match),
        score: candidate.match.score,
        band: candidate.match.band,
        currentTitle: candidate.card.currentTitle,
        totalMonths: candidate.card.totalMonths,
        terms: candidate.card.terms.map((term) => term.key),
        sectionsRead: candidate.card.sectionsRead,
        favorite: candidate.favorite,
        notes: candidate.notes,
        informedAt: candidate.informedAt,
        source: candidate.source,
        addedAt: candidate.addedAt,
        updatedAt: candidate.updatedAt,
        expiresAt: expiresAt(candidate, retentionDays),
      })),
    };
  });
}

// ---------- mensagens ----------

export interface PrivacyInfoMessage extends Base {
  readonly kind: 'privacy_info';
  readonly retentionDays: number;
  /** Nulo: o espaço ainda não foi lido. */
  readonly bytes: number | null;
  readonly limitBytes: number;
  readonly storage: StorageState;
}

export interface PrivacyPeopleMessage extends Base {
  readonly kind: 'privacy_people';
  readonly query: string;
  /** Nulo: ainda não buscou. */
  readonly groups: readonly PersonGroup[] | null;
  /** Id do registro que está sendo corrigido, ou nulo. */
  readonly editing: string | null;
}

export interface PrivacyDataMessage extends Base {
  readonly kind: 'privacy_data';
  /** O aviso de arquivo (RF-73) já foi aceito. */
  readonly exportAccepted: boolean;
}

export interface ConfirmPersonMessage extends Base {
  readonly kind: 'confirm_person';
  readonly name: string;
  /** Quantas vagas guardam esta pessoa. */
  readonly recordCount: number;
}

export type PrivacyMessage = PrivacyInfoMessage | PrivacyPeopleMessage | PrivacyDataMessage | ConfirmPersonMessage;

const act = (id: ActionId, extra: Omit<Action, 'id'> = {}): Action => ({ id, ...extra });

function privacyOf(input: ConversationInput): PrivacyInput {
  return input.privacy ?? NO_PRIVACY;
}

const privacyRule: ConversationRule = (input, step) => {
  if (step.name === 'privacy_delete') {
    const target = privacyOf(input).found?.find((item) => item.id === step.candidateId);
    if (target === undefined) return [];
    const same = (privacyOf(input).found ?? []).filter((item) => (target.profileKey === null ? item.id === target.id : item.profileKey === target.profileKey));
    return [
      {
        id: 'confirm_person',
        kind: 'confirm_person',
        name: target.name,
        recordCount: same.length,
        actions: [act('confirm_delete_person', { candidateId: target.id, danger: true }), act('back_privacy', { primary: true })],
      },
    ];
  }
  if (step.name !== 'privacy') return [];
  const state = privacyOf(input);
  const groups = state.found === null ? null : groupPeople(state.found, input.jobs, input.settings.retentionDays);
  return [
    {
      id: 'privacy_info',
      kind: 'privacy_info',
      retentionDays: input.settings.retentionDays,
      bytes: state.bytes,
      limitBytes: STORAGE_LIMIT_BYTES,
      storage: state.bytes === null ? 'ok' : storageState(state.bytes),
      actions: [],
    },
    { id: 'privacy_people', kind: 'privacy_people', query: state.query, groups, editing: state.editing, actions: [] },
    { id: 'privacy_data', kind: 'privacy_data', exportAccepted: input.settings.acceptances.fileExport !== undefined, actions: [act('go_home')] },
  ];
};

export const PRIVACY_RULES: readonly ConversationRule[] = [privacyRule];

// ---------- achar e corrigir ----------

/** Registros que combinam com a busca, mais todos os registros das mesmas pessoas em outras vagas. Vazio se não digitou nada. */
export async function findAllRecords(store: Store, query: string): Promise<Candidate[]> {
  const matches = await store.findPeople(query);
  if (matches.length === 0) return [];
  const keys = new Set(matches.flatMap((item) => (item.profileKey === null ? [] : [item.profileKey])));
  const ids = new Set(matches.map((item) => item.id));
  const { items } = await store.listAllCandidates();
  return items.filter((item) => ids.has(item.id) || (item.profileKey !== null && keys.has(item.profileKey)));
}

export type CorrectionFailure = 'no_name' | 'bad_url' | 'lost_link' | 'taken' | 'not_found' | 'save_failed';

export type CorrectionOutcome = { readonly ok: true } | { readonly ok: false; readonly reason: CorrectionFailure };

const MAX_NAME_CHARS = 120;
const MAX_LINK_CHARS = 2048;

/**
 * Corrige nome e link de uma pessoa em todas as vagas em que ela está. O trecho /in/<nome>/ é refeito pelo link novo, para
 * ela continuar reconhecida (RF-34). Se o link novo não for de perfil e a pessoa estiver em mais de uma vaga, recusa:
 * ela deixaria de ser reconhecida nas outras. Se o link novo já é de outra pessoa na mesma vaga, recusa também.
 */
export async function correctPerson(store: Store, candidateId: string, input: { readonly name: string; readonly link: string }): Promise<CorrectionOutcome> {
  const name = input.name.replace(/\p{Cs}/gu, '').replace(/\s+/gu, ' ').trim().slice(0, MAX_NAME_CHARS);
  const link = input.link.replace(/\p{Cs}/gu, '').trim();
  if (name === '') return { ok: false, reason: 'no_name' };
  if (link === '' || link.length > MAX_LINK_CHARS || !startsWithHttps(link)) return { ok: false, reason: 'bad_url' };
  try {
    const target = await store.getCandidate(candidateId);
    if (target === null) return { ok: false, reason: 'not_found' };
    const { items } = await store.listAllCandidates();
    const records = items.filter((item) => (target.profileKey === null ? item.id === target.id : item.profileKey === target.profileKey));
    const key = profileKeyOf(link);
    if (key === null && records.length > 1) return { ok: false, reason: 'lost_link' };
    const ids = new Set(records.map((item) => item.id));
    const jobs = new Set(records.map((item) => item.jobId));
    if (key !== null && items.some((item) => !ids.has(item.id) && item.profileKey === key && jobs.has(item.jobId))) return { ok: false, reason: 'taken' };
    for (const record of records) await store.saveCandidate({ ...record, name, profileUrl: canonicalProfileUrl(link) ?? link, profileKey: key });
    return { ok: true };
  } catch {
    return { ok: false, reason: 'save_failed' };
  }
}
