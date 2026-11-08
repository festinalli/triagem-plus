// Ajudantes dos testes da triagem no Chromium. Perfis, nomes e links são inventados. Nenhum endereço é aberto: o painel só
// guarda o link como texto, e o Playwright aborta qualquer pedido ao LinkedIn (trapLinkedIn).
import type { Page } from 'playwright';
import { analyzeAndStore } from '../../src/core/conversation/analyze-store.ts';
import type { TextMemory } from '../../src/core/conversation/analyze-store.ts';
import { makeRequirement } from '../../src/core/job/requirements.ts';
import type { Importance, Job, Requirement, RequirementKind } from '../../src/core/model.ts';
import { createMemoryArea } from '../../src/core/store/area.ts';
import { createStore } from '../../src/core/store/store.ts';
import { seedStorage } from './harness.ts';
import type { Harness } from './harness.ts';

export function requirement(kind: RequirementKind, label: string, importance: Importance = 'required', minYears?: number): Requirement {
  const made = makeRequirement({ kind, label, importance, ...(minYears === undefined ? {} : { minYears }) });
  if (!made.ok) throw new Error(`requisito de teste inválido: ${label}`);
  return made.requirement;
}

/** A vaga dos testes: Java e Spring obrigatórios, Kubernetes desejável. Pesos 3, 3 e 1. */
export const REQUIREMENTS: readonly Requirement[] = [requirement('term', 'Java'), requirement('term', 'Spring'), requirement('term', 'Kubernetes', 'preferred')];

export const JOB_TITLE = 'Pessoa desenvolvedora Java';

/** Um perfil fictício no formato do texto copiado da página. As habilidades decidem a nota. */
export function profile(name: string, skills: readonly string[], extra = ''): string {
  return [
    name,
    'Engenheira de Software',
    'São Paulo, São Paulo, Brasil',
    '',
    'Sobre',
    `Gosto de código simples. ${extra}`.trim(),
    '',
    'Experiência',
    'Desenvolvedora Sênior',
    'Empresa Fictícia Alfa · Tempo integral',
    'jan de 2020 - o momento · 6 anos 10 meses',
    'São Paulo, Brasil · Híbrida',
    `Competências: ${skills.join(', ')}`,
    '',
    'Competências',
    ...skills,
  ].join('\n');
}

export function profileUrl(slug: string): string {
  return `https://www.linkedin.com/in/${slug}/`;
}

/** A nota esperada, calculada à parte: 100 × (3·Java + 3·Spring + 1·Kubernetes) ÷ 7, com meio para cima. */
export function expectedScore(skills: readonly string[]): number {
  const has = (term: string): number => (skills.includes(term) ? 1 : 0);
  return Math.round((100 * (3 * has('Java') + 3 * has('Spring') + has('Kubernetes'))) / 7);
}

export function expectedRequiredMet(skills: readonly string[]): number {
  return (skills.includes('Java') ? 1 : 0) + (skills.includes('Spring') ? 1 : 0);
}

export interface SeedProfile {
  readonly name: string;
  readonly slug: string;
  readonly skills: readonly string[];
  readonly extra?: string;
  /** Há quantos dias a ficha foi atualizada. */
  readonly ageDays?: number;
}

const DAY = 86_400_000;

function memoryPort(): TextMemory {
  let value: Awaited<ReturnType<TextMemory['read']>> = null;
  return { read: async () => value, write: async (next) => void (value = next), clear: async () => void (value = null) };
}

/** Monta, com o mesmo código do painel, os registros de uma vaga com gente já analisada, e grava no armazenamento local. */
export async function seedWorkspace(h: Harness, profiles: readonly SeedProfile[], options: { requirements?: readonly Requirement[]; fileExportAccepted?: boolean; clickRead?: boolean } = {}): Promise<Job> {
  const area = createMemoryArea();
  const store = createStore(area);
  const base = Date.now();
  const job: Job = { id: 'vaga-e2e', title: JOB_TITLE, text: '', requirements: options.requirements ?? REQUIREMENTS, excludedTerms: [], archived: false, createdAt: base, updatedAt: base };
  await store.saveJob(job);
  await store.updateSettings({
    activeJobId: job.id,
    responsibleName: 'Marina Souza',
    responsibleContact: 'marina@exemplo.test',
    ...(options.clickRead === true ? { clickReadEnabled: true } : {}),
    acceptances: { terms: { version: 1, at: base }, ...(options.fileExportAccepted === true ? { fileExport: { version: 1, at: base } } : {}), ...(options.clickRead === true ? { clickRead: { version: 2, at: base } } : {}) },
  });
  let step = 0;
  for (const person of profiles) {
    step += 1;
    const out = await analyzeAndStore(
      { store, memory: memoryPort(), now: () => base + step, newId: () => `cand-${person.slug}` },
      { text: profile(person.name, person.skills, person.extra ?? ''), url: profileUrl(person.slug), name: person.name, source: 'pasted' },
    );
    if (!out.ok) throw new Error(`perfil de teste recusado: ${out.reason}`);
    if (person.ageDays !== undefined) {
      const found = await store.getCandidate(`cand-${person.slug}`);
      if (found !== null) await store.saveCandidate({ ...found, updatedAt: base - person.ageDays * DAY });
    }
  }
  await seedStorage(h, await area.getAll());
  return job;
}

/** Nomes inventados, sem ligação com ninguém. */
export const NAMES = [
  'Alice Fictícia Prado',
  'Bruno Imaginário Costa',
  'Carla Inventada Nunes',
  'Davi Exemplo Ramos',
  'Elisa Fictícia Duarte',
  'Fábio Imaginário Leal',
  'Gabriela Inventada Melo',
  'Heitor Exemplo Viana',
  'Irene Fictícia Campos',
  'Jorge Imaginário Brito',
  'Karina Inventada Souza',
  'Lauro Exemplo Pinto',
  'Mônica Fictícia Freitas',
  'Nilton Imaginário Rocha',
  'Olga Inventada Teixeira',
] as const;

/** As habilidades de cada um dos 15: há empates de propósito, para provar a regra de desempate. */
export const SKILLS_OF_15: ReadonlyArray<readonly string[]> = [
  ['Java', 'Spring', 'Kubernetes'], // 100
  ['Java', 'Spring'], // 86
  ['Java', 'Spring', 'Kubernetes'], // 100 (empata com o primeiro; entrou depois)
  ['Java', 'Kubernetes'], // 57
  ['Spring'], // 43
  ['Java', 'Spring'], // 86
  [], // 0
  ['Java', 'Spring', 'Kubernetes'], // 100
  ['Spring', 'Kubernetes'], // 57
  ['Java'], // 43
  ['Kubernetes'], // 14
  ['Java', 'Spring'], // 86
  ['Java', 'Spring', 'Kubernetes'], // 100
  ['Java', 'Kubernetes'], // 57
  ['Spring'], // 43
];

export function seeds15(): SeedProfile[] {
  return NAMES.map((name, index) => ({ name, slug: `pessoa-${String(index + 1).padStart(2, '0')}`, skills: SKILLS_OF_15[index] ?? [] }));
}

/** A ordem que a regra pede: nota, depois obrigatórios atendidos, depois quem entrou primeiro. Calculada à parte do código do painel. */
export function expectedOrder(list: readonly SeedProfile[]): SeedProfile[] {
  return list
    .map((person, index) => ({ person, index }))
    .sort((a, b) => expectedScore(b.person.skills) - expectedScore(a.person.skills) || expectedRequiredMet(b.person.skills) - expectedRequiredMet(a.person.skills) || a.index - b.index)
    .map(({ person }) => person);
}

// ---------- gestos na tela ----------

/** Cola um perfil pela tela, como a pessoa faria, e espera o resultado. */
export async function pasteOnScreen(page: Page, person: { name: string; slug: string; skills: readonly string[]; extra?: string; url?: string }, options: { fillName?: boolean } = {}): Promise<void> {
  await page.getByRole('button', { name: 'Colar um perfil' }).first().click();
  await page.getByLabel('Texto do perfil').fill(profile(person.name, person.skills, person.extra ?? ''));
  await page.getByLabel('Link do perfil').fill(person.url ?? profileUrl(person.slug));
  if (options.fillName !== false) await page.getByLabel('Nome', { exact: true }).fill(person.name);
  await page.getByRole('button', { name: 'Analisar', exact: true }).click();
  await page.getByRole('heading', { name: `Análise: ${person.name}`, level: 2 }).waitFor();
}
