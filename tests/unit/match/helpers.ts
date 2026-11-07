// Atalhos dos testes da nota. Tudo inventado.
import type { CardTerm, Importance, ProfileCard, Requirement } from '../../../src/core/model.ts';
import type { YearMonth } from '../../../src/core/time/types.ts';

export const AS_OF: YearMonth = { year: 2024, month: 10 };
export const PROFILE_URL = 'https://www.linkedin.com/in/pessoa-ficticia/';

export function listed(canonical: string, importance: Importance = 'required', minYears?: number): Requirement {
  return { id: canonical, kind: 'term', importance, label: canonical, canonical, ...(minYears === undefined ? {} : { minYears }) };
}

export function free(label: string, importance: Importance = 'required'): Requirement {
  return { id: label, kind: 'term', importance, label };
}

export function titleWord(label: string, importance: Importance = 'required'): Requirement {
  return { id: `cargo-${label}`, kind: 'title_word', importance, label };
}

export function language(canonical: string, importance: Importance = 'required'): Requirement {
  return { id: canonical, kind: 'language', importance, label: canonical, canonical };
}

export function totalYears(minYears: number, importance: Importance = 'required'): Requirement {
  return { id: 'total', kind: 'total_experience', importance, label: 'Experiência total', minYears };
}

export function cardTerm(key: string, sections: CardTerm['sections'], months: number | null = null, jobTitles: readonly string[] = []): CardTerm {
  return { key, sections, months, jobTitles };
}

export function cardOf(terms: readonly CardTerm[], extra: Partial<ProfileCard> = {}): ProfileCard {
  return {
    totalMonths: null,
    currentTitle: null,
    terms,
    searchedFreeTerms: [],
    sectionsRead: [],
    truncated: false,
    ...extra,
  };
}

/** Texto de perfil só com as seções dadas, nesta ordem. */
export function profileText(sections: Readonly<Record<string, readonly string[]>>): string {
  const blocks = Object.entries(sections).map(([title, lines]) => [title, ...lines].join('\n'));
  return ['Pessoa Fictícia Exemplo', ...blocks].join('\n\n');
}
