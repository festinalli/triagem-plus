// Prazo de guarda (RF-90) e aviso de limite (RNF-07). Funções puras: o "agora" vem por parâmetro.
//
// Regra do último dia (decisão desta fatia): o prazo vale por (updatedAt + retentionDays) inclusive.
// Com `restante = expiresAt - now`:
//   restante < 0                -> 'expired' (apagado na limpeza);
//   0 <= restante <= 7 dias     -> 'expiring' (os 7 dias finais, inclusive o dia 180 exato);
//   restante > 7 dias           -> 'ok'.
// Ou seja, no dia 172 está ok, do 173 ao 180 há aviso, e a partir do 181 (um instante depois do dia 180) venceu.
import type { Candidate } from '../model.ts';
import type { Store } from './store.ts';

export const DAY_MS = 86_400_000;
export const EXPIRING_WINDOW_DAYS = 7;
export const STORAGE_LIMIT_BYTES = 10 * 1024 * 1024;
export const STORAGE_WARN_RATIO = 0.8;

export type RetentionState = 'ok' | 'expiring' | 'expired';
export type StorageState = 'ok' | 'near_limit';

export function expiresAt(candidate: Pick<Candidate, 'updatedAt'>, retentionDays: number): number {
  return candidate.updatedAt + retentionDays * DAY_MS;
}

export function retentionState(candidate: Pick<Candidate, 'updatedAt'>, retentionDays: number, now: number): RetentionState {
  const remaining = expiresAt(candidate, retentionDays) - now;
  if (remaining < 0) return 'expired';
  if (remaining <= EXPIRING_WINDOW_DAYS * DAY_MS) return 'expiring';
  return 'ok';
}

/** Apaga os vencidos pelo prazo vigente e devolve só a quantidade (sem nomes, RNF-11). */
export async function purgeExpired(store: Store, now: number): Promise<number> {
  const { retentionDays } = await store.getSettings();
  const { items } = await store.listAllCandidates();
  const ids = items.filter((c) => retentionState(c, retentionDays, now) === 'expired').map((c) => c.id);
  if (ids.length === 0) return 0;
  return store.deleteCandidates(ids);
}

/** Renova o prazo de uma pessoa mudando updatedAt. Devolve false se o candidato não existe. */
export async function renew(store: Store, candidateId: string, now: number): Promise<boolean> {
  return store.touchCandidate(candidateId, now);
}

export function storageState(bytes: number): StorageState {
  return bytes >= STORAGE_LIMIT_BYTES * STORAGE_WARN_RATIO ? 'near_limit' : 'ok';
}
