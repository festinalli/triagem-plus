// Tokens sobre o texto já normalizado (RF-071). Perguntas que diferem só em acento, caixa ou pontuação têm os
// mesmos tokens. A comparação entre conjuntos de tokens fica em similarity.ts.
import { normalize } from './normalize.ts';

// Tokens únicos, na ordem da primeira aparição. Texto sem nada além de pontuação dá lista vazia.
export function tokenize(text: unknown): string[] {
  const normalized = normalize(text);
  if (normalized === '') return [];
  return [...new Set(normalized.split(' '))];
}
