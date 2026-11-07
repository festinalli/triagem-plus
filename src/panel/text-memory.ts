// O registro do texto da última análise na memória da sessão. A chave é própria: não tem relação com a leitura por clique.
import type { StoredText } from '../core/conversation/analyze-store.ts';

export const MEMORY_KEY = 'lastAnalysisText';

/** Confere a forma do que veio da memória da sessão. Qualquer coisa fora do formato é ignorada. */
export function parseStoredText(value: unknown): StoredText | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  const { profileKey, candidateId, jobId, text } = record;
  if (typeof candidateId !== 'string' || typeof jobId !== 'string' || typeof text !== 'string') return null;
  if (profileKey !== null && typeof profileKey !== 'string') return null;
  return { profileKey, candidateId, jobId, text };
}
