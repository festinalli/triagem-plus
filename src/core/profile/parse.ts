// O leitor de perfil (RF-40 a RF-45, DP-01): texto puro entra, dados saem. Clique e colagem passam por aqui.
//
// O desenho é uma lista do que entra, não uma lista do que sai. O cabeçalho e toda seção fora da lista fechada são
// descartados sem serem examinados, então pronome, idade, cidade, formação e o resto não têm caminho até um campo. Não
// existe aqui nenhuma tentativa de reconhecer ou deduzir idade, gênero, raça, foto, religião, estado civil, deficiência
// ou endereço (RD-8, RF-44). Ano de formatura nunca é lido, porque a seção de formação é pulada por inteiro (DP-05).
//
// Exceção assumida: `about` é texto livre e guarda o que a pessoa escreveu, inclusive dado pessoal. Procurar e apagar
// dado sensível em texto livre protege menos do que nunca usá-lo (DP-03): `about` fica só em memória, nunca vai para a
// ficha (DP-10), e a ficha só procura nele os termos da lista (DP-25).
//
// Função pura, sem console e sem relógio: "agora" é `asOf`. Não lança erro com nenhum texto de entrada.
import type { ProfileSection } from '../model.ts';
import { normalize } from '../text/normalize.ts';
import type { MonthSpan, YearMonth } from '../time/types.ts';
import { unionMonths } from '../time/union.ts';
import { monthIndex } from '../time/year-month.ts';
import { readExperiences } from './experience.ts';
import type { ExperienceLine } from './experience.ts';
import { MAX_INPUT_CHARS, MAX_PROFILE_CHARS, toLines } from './lines.ts';
import { readNameFromLines } from './name.ts';
import { readPeriodLine } from './period.ts';
import { canLabelJob, isHiddenTextLine, isListCutLine, isPageNoiseLine, titleRole } from './sections.ts';
import type { SectionRole } from './sections.ts';
import type { ParsedExperience, ParsedProfile } from './types.ts';

type TextSection = Exclude<ProfileSection, 'experience'>;
/** Onde a leitura está. `null` é o cabeçalho, ou qualquer texto antes do primeiro título. */
type Place = SectionRole | null;

function experienceKey(experience: ParsedExperience): string {
  const title = normalize(experience.title);
  const { span } = experience;
  if (span === null) return `${title}|sem-periodo|${normalize(experience.text)}`;
  return `${title}|${monthIndex(span.start)}|${span.end === null ? 'atual' : monthIndex(span.end)}`;
}

/**
 * A mesma experiência pode vir duas vezes: página repetida na colagem, ou o perfil somado à página de "ver todas"
 * (RF-34). Fica a versão de texto mais longo, porque o perfil pode ter cortado a descrição. Mesmo cargo e mesmo período com texto
 * diferente são duas entradas, como duas empresas ao mesmo tempo: as duas ficam, para nenhum termo se perder, e o tempo é unido
 * depois. Só sai a entrada que não traz nenhuma linha nova.
 */
function uniqueExperiences(experiences: readonly ParsedExperience[]): ParsedExperience[] {
  const byKey = new Map<string, ParsedExperience[]>();
  for (const experience of experiences) {
    const key = experienceKey(experience);
    const known = byKey.get(key);
    if (known === undefined) byKey.set(key, [experience]);
    else known.push(experience);
  }
  return [...byKey.values()].flatMap((group) => {
    const seen = new Set<string>();
    return [...group].sort((a, b) => b.text.length - a.text.length).filter((experience, position) => {
      const lines = experience.text.split('\n');
      const brings = position === 0 || lines.some((line) => !seen.has(line));
      for (const line of lines) seen.add(line);
      return brings;
    });
  });
}

/**
 * Para cada linha, se há um período antes do próximo título que não seja também rótulo de cargo. Uma passada só, de trás para a
 * frente, para o custo não crescer com a quantidade de rótulos.
 */
function periodsAhead(lines: readonly string[]): boolean[] {
  const ahead = new Array<boolean>(lines.length).fill(false);
  let found = false;
  for (let index = lines.length - 1; index >= 0; index--) {
    ahead[index] = found;
    const line = lines[index] ?? '';
    if (line === '') continue;
    if (readPeriodLine(line) !== null) found = true;
    else if (titleRole(line) !== null && !canLabelJob(line)) found = false;
  }
  return ahead;
}

/**
 * Lê o texto de um perfil.
 *
 * `truncated` olha só para o que pode fazer falta: "Exibir todas as 5 recomendações" dentro de uma seção ignorada não
 * conta, porque abrir essa lista não mudaria nada. E quando a mesma seção aparece de novo, como na página de "ver todas"
 * somada por RF-34, o sinal anterior dela é desfeito, porque a lista veio inteira.
 */
export function parseProfileText(text: string, asOf: YearMonth): ParsedProfile {
  const lines = toLines(text);
  const texts: Record<TextSection, string[]> = { about: [], skills: [], certifications: [], languages: [], projects: [] };
  const experienceRuns: ExperienceLine[][] = [];
  const seenInOrder = new Set<ProfileSection>();
  const cutSections = new Set<ProfileSection | 'header'>();

  let place: Place = null;
  let previous = '';
  let blank = false;
  let room = MAX_PROFILE_CHARS;
  let cutForSize = typeof text === 'string' && text.length > MAX_INPUT_CHARS;
  let ahead: boolean[] | null = null;

  /** Só o que conta gasta o limite. Devolve o que cabe da linha, ou nulo se não cabe mais nada. */
  const fit = (line: string): string | null => {
    if (line.length > room) cutForSize = true;
    if (room <= 0) return null;
    const kept = line.length > room ? line.slice(0, room) : line;
    room -= kept.length + 1;
    return kept;
  };

  for (const [index, line] of lines.entries()) {
    if (line === '') {
      blank = true;
      continue;
    }
    // Dentro de seção ignorada, só um título interessa. É o que mantém a leitura rápida com um texto enorme.
    if (place === 'ignored' && titleRole(line) === null) {
      previous = line;
      blank = false;
      continue;
    }
    if (isListCutLine(line) || isHiddenTextLine(line)) {
      if (place !== 'ignored') cutSections.add(place ?? 'header');
      continue;
    }
    if (isPageNoiseLine(line)) continue;
    // Repetição em seguida some, mesmo com linha em branco no meio. Vem antes de tudo o mais: é assim que "Experiência"
    // duas vezes não abre a seção duas vezes.
    if (line === previous) {
      blank = false;
      continue;
    }
    previous = line;

    // "Tecnologias:" no meio de um cargo, com outro período depois, é o rótulo da lista daquele cargo, e não outra seção.
    const isJobLabel: boolean = place === 'experience' && canLabelJob(line) && (ahead ??= periodsAhead(lines))[index] === true;
    const role: SectionRole | null = isJobLabel ? null : titleRole(line);
    if (role !== null) {
      place = role;
      blank = false;
      if (role === 'ignored') continue;
      seenInOrder.add(role);
      cutSections.delete(role);
      if (role === 'experience') experienceRuns.push([]);
      continue;
    }

    if (place !== null && place !== 'ignored') {
      const kept = fit(line);
      if (kept !== null && place === 'experience') experienceRuns.at(-1)?.push({ text: kept, afterBlank: blank });
      else if (kept !== null && place !== 'experience') texts[place].push(kept);
    }
    blank = false;
  }

  const experiences = uniqueExperiences(experienceRuns.flatMap((run) => readExperiences(run, asOf)));
  const spans: MonthSpan[] = experiences.flatMap((experience) => (experience.span === null ? [] : [experience.span]));
  const hasContent = (section: ProfileSection): boolean =>
    section === 'experience' ? experiences.length > 0 : texts[section].length > 0;

  return {
    name: readNameFromLines(lines),
    about: texts.about.join('\n'),
    experiences,
    skillsText: texts.skills.join('\n'),
    certificationsText: texts.certifications.join('\n'),
    languagesText: texts.languages.join('\n'),
    projectsText: texts.projects.join('\n'),
    sectionsRead: [...seenInOrder].filter(hasContent),
    truncated: cutSections.size > 0 || cutForSize,
    totalMonths: spans.length === 0 ? null : unionMonths(spans, asOf),
  };
}
