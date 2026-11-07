// A ordem da lista (RF-54, RF-67). Nota, depois obrigatórios atendidos, depois quem entrou primeiro. O id só existe para a
// ordem ser sempre a mesma quando tudo empata, e compara por código de caractere, sem depender do idioma da máquina.
// O nome da pessoa não é lido aqui: o tipo nem pede esse campo.
import type { Candidate, MatchResult } from '../model.ts';

export const TOP_SIZE = 10;

export interface Rankable {
  readonly id: Candidate['id'];
  readonly addedAt: Candidate['addedAt'];
  readonly match: Pick<MatchResult, 'score' | 'requiredMet'>;
}

function compareCandidates(a: Rankable, b: Rankable): number {
  if (a.match.score !== b.match.score) return b.match.score - a.match.score;
  if (a.match.requiredMet !== b.match.requiredMet) return b.match.requiredMet - a.match.requiredMet;
  if (a.addedAt !== b.addedAt) return a.addedAt - b.addedAt;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Uma cópia em ordem. A lista recebida não muda. */
export function sortCandidates<T extends Rankable>(list: readonly T[]): T[] {
  return [...list].sort(compareCandidates);
}

export function topTen<T extends Rankable>(list: readonly T[]): T[] {
  return sortCandidates(list).slice(0, TOP_SIZE);
}

/** A posição, a partir de 1, para "entrou em 3º". Nulo se a pessoa não está na lista. Aceita a lista em qualquer ordem. */
export function positionOf(list: readonly Rankable[], id: string): number | null {
  const index = sortCandidates(list).findIndex((candidate) => candidate.id === id);
  return index < 0 ? null : index + 1;
}
