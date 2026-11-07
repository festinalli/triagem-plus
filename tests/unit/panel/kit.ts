// Monta o controlador do painel sem navegador: armazenamento em memória, relógio fixo e uma "tela" que só conta desenhos.
// Perfis, nomes e links são inventados.
import { createController } from '../../../src/panel/app.ts';
import type { Controller } from '../../../src/panel/app.ts';
import type { StoredText, TextMemory } from '../../../src/core/conversation/analyze-store.ts';
import { makeRequirement } from '../../../src/core/job/requirements.ts';
import type { Importance, Job, Requirement, RequirementKind } from '../../../src/core/model.ts';
import { createMemoryArea } from '../../../src/core/store/area.ts';
import type { KeyValueArea } from '../../../src/core/store/area.ts';
import { createStore } from '../../../src/core/store/store.ts';
import type { Store } from '../../../src/core/store/store.ts';

export const NOW = Date.UTC(2026, 10, 6, 15, 0, 0);
export const DAY = 86_400_000;

export function req(kind: RequirementKind, label: string, importance: Importance = 'required'): Requirement {
  const made = makeRequirement({ kind, label, importance });
  if (!made.ok) throw new Error(`requisito de teste inválido: ${label}`);
  return made.requirement;
}

export function profile(name: string, skills: readonly string[]): string {
  return [name, 'Engenheira de Software', 'São Paulo, Brasil', '', 'Experiência', 'Desenvolvedora Sênior', 'Empresa Alfa · Tempo integral', 'jan de 2020 - o momento · 6 anos 10 meses', `Competências: ${skills.join(', ')}`, '', 'Competências', ...skills].join('\n');
}

export const url = (slug: string): string => `https://www.linkedin.com/in/${slug}/`;

export interface Kit {
  readonly controller: Controller;
  readonly store: Store;
  readonly area: KeyValueArea;
  readonly memory: TextMemory & { value: StoredText | null };
  readonly clock: { now: number };
  readonly paints: { count: number };
  load(): Promise<void>;
}

export interface KitOptions {
  readonly jobs?: readonly Job[];
  readonly activeJobId?: string | null;
  readonly area?: KeyValueArea;
  readonly memory?: TextMemory & { value: StoredText | null };
}

export function memoryPort(): TextMemory & { value: StoredText | null } {
  const port = {
    value: null as StoredText | null,
    read: async () => port.value,
    write: async (value: StoredText) => void (port.value = value),
    clear: async () => void (port.value = null),
  };
  return port;
}

export function jobOf(id: string, title: string, requirements: readonly Requirement[] = []): Job {
  return { id, title, text: '', requirements, excludedTerms: [], archived: false, createdAt: 1, updatedAt: 1 };
}

export async function kit(options: KitOptions = {}): Promise<Kit> {
  const area = options.area ?? createMemoryArea();
  const store = createStore(area);
  const memory = options.memory ?? memoryPort();
  const clock = { now: NOW };
  const paints = { count: 0 };
  let counter = 0;
  if (options.area === undefined) {
    for (const job of options.jobs ?? []) await store.saveJob(job);
    await store.updateSettings({
      activeJobId: options.activeJobId === undefined ? (options.jobs?.[0]?.id ?? null) : options.activeJobId,
      responsibleName: 'Marina Souza',
      responsibleContact: 'marina@exemplo.test',
      acceptances: { terms: { version: 1, at: NOW } },
    });
  }
  const { controller, load } = createController({
    store,
    memory,
    now: () => clock.now,
    newId: () => `id-${(counter += 1)}`,
    paint: () => void (paints.count += 1),
  });
  await load();
  return { controller, store, area, memory, clock, paints, load };
}
