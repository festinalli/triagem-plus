// Atalhos dos testes da triagem. Tudo inventado: nomes, links e perfis não existem.
import { makeRequirement } from '../../../src/core/job/requirements.ts';
import type { ConversationInput } from '../../../src/core/conversation/build.ts';
import type { Band, Candidate, Importance, Job, MatchResult, Requirement, RequirementKind, RequirementStatus, Settings, Stage } from '../../../src/core/model.ts';
import { defaultSettings } from '../../../src/core/store/store.ts';

export const NOW = Date.UTC(2026, 10, 6, 15, 0, 0);
export const DAY = 86_400_000;

export const ACCEPTED: Settings = { ...defaultSettings(), responsibleName: 'Ana', responsibleContact: 'ana@exemplo.test', retentionDays: 180, acceptances: { terms: { version: 1, at: 1 } } };

export function req(kind: RequirementKind, label: string, importance: Importance = 'required', minYears?: number): Requirement {
  const made = makeRequirement({ kind, label, importance, ...(minYears === undefined ? {} : { minYears }) });
  if (!made.ok) throw new Error(`requisito de teste inválido: ${label}`);
  return made.requirement;
}

export function job(requirements: readonly Requirement[] = [req('term', 'Java'), req('term', 'Spring Boot'), req('term', 'Docker', 'preferred')]): Job {
  return { id: 'vaga-1', title: 'Pessoa Desenvolvedora Java', text: '', requirements, excludedTerms: [], archived: false, createdAt: 1, updatedAt: 1 };
}

export interface Spec {
  readonly id: string;
  readonly name?: string;
  readonly score?: number;
  readonly band?: Band;
  readonly requiredMet?: number;
  readonly addedAt?: number;
  readonly stage?: Stage;
  readonly favorite?: boolean;
  readonly informedAt?: number | null;
  readonly updatedAt?: number;
  readonly totalMonths?: number | null;
  readonly terms?: readonly string[];
  readonly notes?: string;
  readonly profileUrl?: string;
  readonly statuses?: readonly RequirementStatus[];
  readonly sectionsRead?: Candidate['card']['sectionsRead'];
  readonly truncated?: boolean;
}

export function person(spec: Spec, requirements: readonly Requirement[] = job().requirements): Candidate {
  const statuses = spec.statuses ?? requirements.map((): RequirementStatus => 'met');
  const results = requirements.map((requirement, index) => {
    const status = statuses[index] ?? 'not_found';
    return { requirementId: requirement.id, status, credit: status === 'met' ? 1 : status === 'partial' ? 0.5 : 0, evidence: [] };
  });
  const match: MatchResult = { score: spec.score ?? 80, band: spec.band ?? 'partial', results, requiredMet: spec.requiredMet ?? 2, requiredTotal: 2 };
  return {
    id: spec.id,
    jobId: 'vaga-1',
    name: spec.name ?? `Pessoa Fictícia ${spec.id}`,
    profileUrl: spec.profileUrl ?? `https://www.linkedin.com/in/pessoa-${spec.id}/`,
    profileKey: `/in/pessoa-${spec.id}/`,
    card: {
      totalMonths: spec.totalMonths === undefined ? 60 : spec.totalMonths,
      currentTitle: 'Engenheira de Software',
      terms: (spec.terms ?? ['Java']).map((key) => ({ key, sections: ['skills'], months: 24, jobTitles: [] })),
      searchedFreeTerms: [],
      sectionsRead: spec.sectionsRead ?? ['experience', 'skills'],
      truncated: spec.truncated ?? false,
    },
    match,
    stage: spec.stage ?? 'new',
    favorite: spec.favorite ?? false,
    notes: spec.notes ?? '',
    informedAt: spec.informedAt === undefined ? null : spec.informedAt,
    source: 'pasted',
    addedAt: spec.addedAt ?? 1000,
    updatedAt: spec.updatedAt ?? NOW,
  };
}

export function inputWith(candidates: readonly Candidate[], over: Partial<ConversationInput> = {}): ConversationInput {
  const active = job();
  return { settings: ACCEPTED, jobs: [active], activeJob: active, candidates, now: NOW, ...over };
}
