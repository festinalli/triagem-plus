// A ficha (seção 9, RF-42, RF-43, RF-45, DP-10, DP-23): o único resumo do perfil que fica guardado. Só entram chaves, nomes de
// seção, meses e cargos da lista fechada. Nenhum campo recebe texto livre do perfil, e cada chave vem da lista de termos ou da
// própria vaga.
//
// A ficha não depende da ordem do texto: seções vão na ordem do modelo, termos pela chave e experiências pela data. Assim,
// dois perfis com o mesmo conteúdo têm a mesma ficha, byte a byte (RF-57).
//
// Função pura. Não recebe `asOf`: cada experiência já traz os meses medidos pelo leitor, e o fim efetivo sai deles.
import { impliedTerms, synonymsOf } from '../dictionary/index.ts';
import type { CardTerm, ProfileCard, ProfileSection, Requirement } from '../model.ts';
import { termsInExperience, termsInList, termsInProse } from '../profile/terms.ts';
import type { Memo } from '../profile/terms.ts';
import type { ParsedExperience, ParsedProfile } from '../profile/types.ts';
import { workTitleOf } from '../profile/work-titles.ts';
import { normalize } from '../text/normalize.ts';
import type { MonthSpan, YearMonth } from '../time/types.ts';
import { unionMonths } from '../time/union.ts';
import { monthIndex } from '../time/year-month.ts';
import { hasPhrase, haystacksOf, lookupOf, phraseKey, searchTextOf, titleHaystacksOf, titlePhraseKey } from './lookup.ts';

const SECTION_ORDER: readonly ProfileSection[] = ['about', 'experience', 'skills', 'certifications', 'languages', 'projects', 'listing'];
const MAX_JOB_TITLES = 3;
const MONTHS_PER_YEAR = 12;

interface Found {
  readonly sections: Set<ProfileSection>;
  readonly experiences: Set<ParsedExperience>;
}

function mark(found: Map<string, Found>, key: string, section: ProfileSection, experience?: ParsedExperience): void {
  let entry = found.get(key);
  if (entry === undefined) {
    entry = { sections: new Set(), experiences: new Set() };
    found.set(key, entry);
  }
  entry.sections.add(section);
  if (experience !== undefined) entry.experiences.add(experience);
}

/** Quem usa o primeiro usa o segundo: a vaga que pede Spring não pode deixar de fora quem escreveu Spring Boot. */
function markListed(found: Map<string, Found>, canonical: string, section: ProfileSection, experience?: ParsedExperience): void {
  mark(found, canonical, section, experience);
  for (const implied of impliedTerms(canonical)) mark(found, implied, section, experience);
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Da mais recente para a mais antiga, pelo início. Sem período legível vem depois, na ordem do texto. */
function byRecency(experiences: readonly ParsedExperience[]): ParsedExperience[] {
  const startOf = (experience: ParsedExperience): number =>
    experience.span === null ? Number.NEGATIVE_INFINITY : monthIndex(experience.span.start);
  const endOf = (experience: ParsedExperience): number => {
    if (experience.span === null) return Number.NEGATIVE_INFINITY;
    return experience.span.end === null ? Number.POSITIVE_INFINITY : monthIndex(experience.span.end);
  };
  const order = (a: number, b: number): number => (a === b ? 0 : a > b ? -1 : 1);
  return [...experiences].sort((a, b) => {
    if (a.span === null && b.span === null) return 0;
    return order(startOf(a), startOf(b)) || order(endOf(a), endOf(b)) || compareText(a.title, b.title);
  });
}

function fromMonthIndex(index: number): YearMonth {
  return { year: Math.floor(index / MONTHS_PER_YEAR), month: (index % MONTHS_PER_YEAR) + 1 };
}

/** O trecho que o leitor mediu: do início até o fim ou até `asOf`, o que vier antes. */
function measuredSpan(experience: ParsedExperience): MonthSpan | null {
  if (experience.span === null || experience.months === null || experience.months <= 0) return null;
  const start = experience.span.start;
  return { start, end: fromMonthIndex(monthIndex(start) + experience.months - 1) };
}

/** Meses da união dos períodos. Nulo se nenhuma das experiências tem período legível (RF-43). */
function monthsOf(experiences: Iterable<ParsedExperience>): number | null {
  const list = [...experiences];
  if (!list.some((experience) => experience.span !== null)) return null;
  const spans = list.flatMap((experience) => measuredSpan(experience) ?? []);
  const latest = spans.reduce((last, span) => Math.max(last, span.end === null ? 0 : monthIndex(span.end)), 0);
  return unionMonths(spans, fromMonthIndex(latest));
}

/** Até 3 cargos, sem vazios nem repetição, respeitando a ordem recebida. */
export function uniqueTitles(titles: Iterable<string>): string[] {
  const byKey = new Map<string, string>();
  for (const raw of titles) {
    const title = raw.trim();
    const key = normalize(title);
    if (title !== '' && !byKey.has(key)) byKey.set(key, title);
    if (byKey.size === MAX_JOB_TITLES) break;
  }
  return [...byKey.values()];
}

export function inSectionOrder(sections: Iterable<ProfileSection>): ProfileSection[] {
  const present = new Set(sections);
  return SECTION_ORDER.filter((section) => present.has(section));
}

/** O cargo vem da lista fechada (DP-23). O texto da linha nunca entra na ficha. */
function currentTitleOf(recentFirst: readonly ParsedExperience[], labels: ReadonlyMap<ParsedExperience, string>): string | null {
  const current = recentFirst.find((experience) => experience.span !== null && experience.span.end === null) ?? recentFirst[0];
  const title = current === undefined ? '' : (labels.get(current) ?? '');
  return title === '' ? null : title;
}

interface SearchPlaces {
  readonly sections: ReadonlyArray<readonly [ProfileSection, string]>;
  readonly experiences: ReadonlyArray<readonly [ParsedExperience, string]>;
  readonly titles: ReadonlyArray<readonly [ParsedExperience, string]>;
}

function paired<T>(owners: readonly T[], haystacks: readonly string[]): Array<readonly [T, string]> {
  return owners.map((owner, index) => [owner, haystacks[index] ?? ''] as const);
}

function searchPlacesOf(parsed: ParsedProfile, experiences: readonly ParsedExperience[]): SearchPlaces {
  // Sobre fica de fora: é o texto mais pessoal do perfil, e só os termos da lista são procurados nele (DP-25).
  const sections: readonly ProfileSection[] = ['skills', 'certifications', 'languages', 'projects'];
  const sectionTexts = [parsed.skillsText, parsed.certificationsText, parsed.languagesText, parsed.projectsText];
  return {
    sections: paired(sections, haystacksOf(sectionTexts)),
    experiences: paired(experiences, haystacksOf(experiences.map((experience) => experience.text))),
    titles: paired(experiences, titleHaystacksOf(experiences.map((experience) => experience.title))),
  };
}

/**
 * A ficha de quem só foi visto na página de resultados (RF-39). Só entram termos da lista, e palavra de cargo só no título.
 * Termo livre não é procurado: o título e o trecho são tão pessoais quanto Sobre (DP-25). Sem tempo de experiência, porque a
 * lista não mostra períodos. `truncated` é verdadeiro porque a lista é sempre um recorte, e assim somar com uma leitura
 * completa mantém o que ela disser (RF-35).
 */
export function buildListingCard(entry: { readonly headline: string; readonly details: string }, requirements: readonly Requirement[]): ProfileCard {
  const found = new Map<string, Found>();
  const memo: Memo = new Map();
  for (const canonical of termsInList(entry.headline, memo)) markListed(found, canonical, 'listing');
  for (const canonical of termsInExperience(entry.details, memo)) markListed(found, canonical, 'listing');

  const searched = new Set<string>();
  const headline = titleHaystacksOf([entry.headline])[0] ?? '';
  for (const requirement of requirements) {
    const lookup = lookupOf(requirement);
    if (lookup.kind !== 'title' || lookup.key === '' || searched.has(lookup.key)) continue;
    searched.add(lookup.key);
    const text = searchTextOf(requirement);
    const phrases = [...new Set([text, ...synonymsOf(text)].map(titlePhraseKey))];
    if (phrases.some((phrase) => hasPhrase(headline, phrase))) mark(found, lookup.key, 'listing');
  }

  const title = workTitleOf(entry.headline);
  return {
    totalMonths: null,
    currentTitle: title === '' ? null : title,
    terms: [...found.keys()].sort(compareText).map((key): CardTerm => ({ key, sections: ['listing'], months: null, jobTitles: [] })),
    searchedFreeTerms: [...searched].sort(compareText),
    sectionsRead: ['listing'],
    truncated: true,
  };
}

/** Monta a ficha. Todo termo da lista reconhecido entra, e os requisitos só decidem que termos livres procurar. */
export function buildCard(parsed: ParsedProfile, requirements: readonly Requirement[]): ProfileCard {
  const found = new Map<string, Found>();
  const experiences = byRecency(parsed.experiences);
  const labels = new Map(experiences.map((experience) => [experience, workTitleOf(experience.title)]));
  const memo: Memo = new Map();

  for (const canonical of termsInProse(parsed.about)) markListed(found, canonical, 'about');
  for (const canonical of termsInProse(parsed.projectsText)) markListed(found, canonical, 'projects');
  for (const canonical of termsInList(parsed.skillsText, memo)) markListed(found, canonical, 'skills');
  for (const canonical of termsInList(parsed.certificationsText, memo)) markListed(found, canonical, 'certifications');
  for (const canonical of termsInList(parsed.languagesText, memo)) markListed(found, canonical, 'languages');
  for (const experience of experiences) {
    for (const canonical of termsInExperience(experience.text, memo)) markListed(found, canonical, 'experience', experience);
  }

  const searched = new Set<string>();
  let places: SearchPlaces | null = null;
  for (const requirement of requirements) {
    const lookup = lookupOf(requirement);
    if ((lookup.kind !== 'free' && lookup.kind !== 'title') || lookup.key === '' || searched.has(lookup.key)) continue;
    searched.add(lookup.key);
    places ??= searchPlacesOf(parsed, experiences);
    const text = searchTextOf(requirement);

    if (lookup.kind === 'title') {
      const phrases = [...new Set([text, ...synonymsOf(text)].map(titlePhraseKey))];
      for (const [experience, title] of places.titles) {
        if (phrases.some((phrase) => hasPhrase(title, phrase))) mark(found, lookup.key, 'experience', experience);
      }
      continue;
    }

    const phrase = phraseKey(text);
    for (const [section, haystack] of places.sections) if (hasPhrase(haystack, phrase)) mark(found, lookup.key, section);
    for (const [experience, haystack] of places.experiences) {
      if (hasPhrase(haystack, phrase)) mark(found, lookup.key, 'experience', experience);
    }
  }

  const terms = [...found.entries()]
    .sort(([a], [b]) => compareText(a, b))
    .map(([key, entry]): CardTerm => ({
      key,
      sections: inSectionOrder(entry.sections),
      months: monthsOf(entry.experiences),
      jobTitles: uniqueTitles(experiences.filter((experience) => entry.experiences.has(experience)).map((experience) => labels.get(experience) ?? '')),
    }));

  return {
    totalMonths: parsed.totalMonths,
    currentTitle: currentTitleOf(experiences, labels),
    terms,
    searchedFreeTerms: [...searched].sort(compareText),
    sectionsRead: inSectionOrder(parsed.sectionsRead),
    truncated: parsed.truncated,
  };
}
