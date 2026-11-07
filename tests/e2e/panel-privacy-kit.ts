// Ajudantes dos testes de privacidade e de mensagens no Chromium. Nomes, links e perfis são inventados. Nenhum endereço é
// aberto: o painel só guarda o link como texto, e o Playwright aborta qualquer pedido ao LinkedIn (trapLinkedIn).
import type { Page } from 'playwright';
import { analyzeAndStore } from '../../src/core/conversation/analyze-store.ts';
import type { TextMemory } from '../../src/core/conversation/analyze-store.ts';
import type { Job } from '../../src/core/model.ts';
import { createMemoryArea } from '../../src/core/store/area.ts';
import { createStore } from '../../src/core/store/store.ts';
import { seedStorage } from './harness.ts';
import type { Harness } from './harness.ts';
import { profile, profileUrl, REQUIREMENTS } from './panel-triage-kit.ts';

export const RESPONSIBLE = { name: 'Marina Souza', contact: 'marina@exemplo.test' };

export interface TwoJobsSeed {
  readonly jobA: Job;
  readonly jobB: Job;
}

function memoryPort(): TextMemory {
  let value: Awaited<ReturnType<TextMemory['read']>> = null;
  return { read: async () => value, write: async (next) => void (value = next), clear: async () => void (value = null) };
}

export interface PersonSeed {
  readonly name: string;
  readonly slug: string;
  readonly skills: readonly string[];
  readonly extra?: string;
  readonly notes?: string;
  /** Em quais vagas a pessoa entra: 'a', 'b' ou as duas. */
  readonly jobs: readonly ('a' | 'b')[];
}

/** Duas vagas e as pessoas indicadas em cada uma, gravadas com o mesmo código do painel. A vaga A fica ativa. */
export async function seedTwoJobs(h: Harness, people: readonly PersonSeed[], options: { acceptTerms?: boolean } = {}): Promise<TwoJobsSeed> {
  const area = createMemoryArea();
  const store = createStore(area);
  const base = Date.now();
  const mkJob = (id: string, title: string): Job => ({ id, title, text: '', requirements: REQUIREMENTS, excludedTerms: [], archived: false, createdAt: base, updatedAt: base });
  const jobA = mkJob('vaga-a', 'Pessoa desenvolvedora Java');
  const jobB = mkJob('vaga-b', 'Pessoa desenvolvedora Spring');
  await store.saveJob(jobA);
  await store.saveJob(jobB);
  await store.updateSettings({
    activeJobId: jobA.id,
    responsibleName: RESPONSIBLE.name,
    responsibleContact: RESPONSIBLE.contact,
    acceptances: options.acceptTerms === false ? {} : { terms: { version: 1, at: base } },
  });
  let step = 0;
  for (const person of people) {
    for (const which of person.jobs) {
      step += 1;
      const job = which === 'a' ? jobA : jobB;
      await store.updateSettings({ activeJobId: job.id });
      const out = await analyzeAndStore(
        { store, memory: memoryPort(), now: () => base + step, newId: () => `cand-${person.slug}-${which}` },
        { text: profile(person.name, person.skills, person.extra ?? ''), url: profileUrl(person.slug), name: person.name, source: 'pasted' },
      );
      if (!out.ok) throw new Error(`perfil de teste recusado: ${out.reason}`);
      if (person.notes !== undefined) {
        const found = await store.getCandidate(`cand-${person.slug}-${which}`);
        if (found !== null) await store.saveCandidate({ ...found, notes: person.notes });
      }
    }
  }
  await store.updateSettings({ activeJobId: jobA.id });
  await seedStorage(h, await area.getAll());
  return { jobA, jobB };
}

export const ANA = { name: 'Ana Fictícia Müller', slug: 'ana-ficticia-muller', skills: ['Java', 'Spring', 'Kubernetes'], extra: 'Texto único do perfil da Ana.' } as const;
export const BIA = { name: 'Beatriz Inventada Lopes', slug: 'bia-inventada-lopes', skills: ['Java'], extra: 'Outro texto único do perfil.' } as const;
export const CAIO = { name: 'Caio Exemplo Nunes', slug: 'caio-exemplo-nunes', skills: ['Spring'], extra: 'Mais um texto único.' } as const;

/** Contraste (WCAG) de todo texto visível contra o fundo efetivo: 4,5:1 no mínimo. Devolve as falhas. */
export async function contrastFailures(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const parse = (value: string): [number, number, number, number] => {
      const m = /rgba?\(([^)]+)\)/.exec(value);
      if (!m) return [0, 0, 0, 0];
      const p = (m[1] as string).split(/[,\s/]+/).filter(Boolean).map(Number);
      return [p[0] ?? 0, p[1] ?? 0, p[2] ?? 0, p[3] ?? 1];
    };
    const lum = (c: number[]): number => {
      const f = (v: number): number => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(c[0] ?? 0) + 0.7152 * f(c[1] ?? 0) + 0.0722 * f(c[2] ?? 0);
    };
    const backdrop = (el: Element | null): number[] => {
      for (let node = el; node; node = node.parentElement) {
        const bg = parse(getComputedStyle(node).backgroundColor);
        if (bg[3] === 1) return bg;
      }
      return parse(getComputedStyle(document.body).backgroundColor);
    };
    const out: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = (node.textContent ?? '').trim();
      const el = node.parentElement;
      if (!text || !el || el.closest('[hidden]') || el.closest('.tr-visually-hidden') || el.closest('option')) continue;
      const style = getComputedStyle(el);
      if (style.visibility === 'hidden' || style.display === 'none') continue;
      const fg = parse(style.color);
      const bg = backdrop(el);
      const [a, b] = [lum(fg), lum(bg)];
      const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      const large = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.66 && Number(style.fontWeight) >= 700);
      if (ratio < (large ? 3 : 4.5)) out.push(`${ratio.toFixed(2)} ${style.color} sobre ${style.backgroundColor || 'fundo'}: ${text.slice(0, 40)}`);
    }
    return out;
  });
}
