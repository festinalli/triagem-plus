// Criação e lista de requisitos da vaga (RF-12, RF-13, RF-14). Puro. Todo requisito digitado passa pela trava.
import { canonicalOf } from '../dictionary/index.ts';
import { checkTerm, MAX_TERM_CHARS } from '../guard/index.ts';
import type { ForbiddenTopic } from '../guard/index.ts';
import type { Importance, Requirement, RequirementKind } from '../model.ts';
import { normalize } from '../text/normalize.ts';

/** Limite de requisitos por vaga (RF-12). */
export const MAX_REQUIREMENTS = 30;
/** Faixa aceita para o campo de anos mínimos. Valida o número digitado: não é teto de experiência da pessoa (RF-14). */
export const MIN_YEARS_LOWEST = 1;
export const MIN_YEARS_HIGHEST = 40;
/** Só existe um requisito de experiência total por vaga. */
export const TOTAL_EXPERIENCE_ID = 'total_experience';

export interface RequirementInput {
  readonly kind: RequirementKind;
  readonly label: string;
  readonly importance: Importance;
  readonly minYears?: number;
}

export type RequirementRefusalCode = 'empty' | 'too_long' | 'forbidden' | 'max_experience' | 'invalid_years';

export type MakeRequirementResult =
  | { readonly ok: true; readonly requirement: Requirement }
  | { readonly ok: false; readonly code: RequirementRefusalCode; readonly topic?: ForbiddenTopic; readonly reason: string };

export type AddRequirementResult =
  | { readonly ok: true; readonly list: readonly Requirement[] }
  | { readonly ok: false; readonly code: 'duplicate' | 'limit'; readonly reason: string };

const REASON_EMPTY = 'Escreva o requisito antes de salvar.';
const REASON_TOO_LONG = `Um requisito tem no máximo ${MAX_TERM_CHARS} caracteres. Escreva só o termo, sem a frase inteira da vaga.`;
const REASON_YEARS_RANGE = `Os anos mínimos precisam ser um número inteiro de ${MIN_YEARS_LOWEST} a ${MIN_YEARS_HIGHEST}.`;
const REASON_YEARS_NEEDED = `Experiência total precisa dos anos mínimos, um número inteiro de ${MIN_YEARS_LOWEST} a ${MIN_YEARS_HIGHEST}.`;
const REASON_YEARS_KIND = 'Anos mínimos só valem para termo de tecnologia e para experiência total.';
const REASON_DUPLICATE = 'Este requisito já está na lista.';
const REASON_LIMIT = `Uma vaga tem no máximo ${MAX_REQUIREMENTS} requisitos.`;

function acceptsYears(kind: RequirementKind): boolean {
  return kind === 'term' || kind === 'total_experience';
}

function yearsRefusal(kind: RequirementKind, minYears: number | undefined): string | null {
  if (minYears === undefined) return kind === 'total_experience' ? REASON_YEARS_NEEDED : null;
  if (!acceptsYears(kind)) return REASON_YEARS_KIND;
  return Number.isInteger(minYears) && minYears >= MIN_YEARS_LOWEST && minYears <= MIN_YEARS_HIGHEST ? null : REASON_YEARS_RANGE;
}

/** Chave do id. Os símbolos viram palavra para C, C++ e C# não caírem na mesma chave, já que normalize tira + e #. */
function keyOf(name: string): string {
  return normalize(name.replace(/\+/gu, ' plus ').replace(/#/gu, ' sharp '));
}

/** Monta um requisito válido ou explica a recusa. O id é determinístico: kind:chave, e o de experiência total é fixo. */
export function makeRequirement(input: RequirementInput): MakeRequirementResult {
  // Sem caractere substituto solto: ele não é texto e derruba quem codifica o rótulo depois.
  const label = typeof input?.label === 'string' ? input.label.replace(/\p{Cs}/gu, '').trim().replace(/\s+/gu, ' ') : '';
  // Antes de normalizar: o custo de tudo o que vem depois fica limitado pelo tamanho do termo.
  if (label.length > MAX_TERM_CHARS) return { ok: false, code: 'too_long', reason: REASON_TOO_LONG };
  if (normalize(label) === '') return { ok: false, code: 'empty', reason: REASON_EMPTY };

  const check = checkTerm(label);
  if (!check.allowed) {
    const code = check.topic === 'max_experience' ? 'max_experience' : 'forbidden';
    return { ok: false, code, topic: check.topic, reason: check.reason };
  }

  const yearsProblem = yearsRefusal(input.kind, input.minYears);
  if (yearsProblem !== null) return { ok: false, code: 'invalid_years', reason: yearsProblem };

  const canonical = input.kind === 'total_experience' ? null : canonicalOf(label);
  const id = input.kind === 'total_experience' ? TOTAL_EXPERIENCE_ID : `${input.kind}:${keyOf(canonical ?? label)}`;
  return {
    ok: true,
    requirement: {
      id,
      kind: input.kind,
      importance: input.importance,
      label,
      ...(canonical === null ? {} : { canonical }),
      ...(input.minYears === undefined ? {} : { minYears: input.minYears }),
    },
  };
}

/** Devolve uma lista nova com o requisito no fim, ou recusa o repetido (mesmo id) e o que passaria do limite. */
export function addRequirement(list: readonly Requirement[], requirement: Requirement): AddRequirementResult {
  const items = Array.isArray(list) ? list : [];
  if (items.some((item) => item.id === requirement.id)) return { ok: false, code: 'duplicate', reason: REASON_DUPLICATE };
  if (items.length >= MAX_REQUIREMENTS) return { ok: false, code: 'limit', reason: REASON_LIMIT };
  return { ok: true, list: [...items, requirement] };
}
