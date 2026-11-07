// Atalhos dos testes do relatório. Tudo inventado. O leitor de PDF é o pdfjs-dist, só em teste.
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { Band, Candidate, Job, MatchResult, RequirementResult, RequirementStatus, Stage } from '../../../src/core/model.ts';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

/** Meio-dia do dia 6/11/2026 em UTC: o mesmo dia no calendário em qualquer fuso do Brasil. */
export const NOW = Date.UTC(2026, 10, 6, 15, 0, 0);

export const JOB: Job = {
  id: 'vaga-1',
  title: 'Pessoa Desenvolvedora Java Sênior',
  text: '',
  requirements: [
    { id: 'r1', kind: 'term', importance: 'required', label: 'Java', canonical: 'Java', minYears: 5 },
    { id: 'r2', kind: 'term', importance: 'required', label: 'Spring Boot' },
    { id: 'r3', kind: 'term', importance: 'preferred', label: 'AWS', canonical: 'AWS' },
    { id: 'r4', kind: 'language', importance: 'preferred', label: 'Inglês', canonical: 'Inglês' },
  ],
  excludedTerms: [],
  archived: false,
  createdAt: 1,
  updatedAt: 1,
};

function result(requirementId: string, status: RequirementStatus): RequirementResult {
  return { requirementId, status, credit: status === 'met' ? 1 : status === 'partial' ? 0.5 : 0, evidence: [] };
}

export interface Spec {
  readonly id: string;
  readonly name?: string;
  readonly score?: number;
  readonly band?: Band;
  readonly statuses?: readonly RequirementStatus[];
  readonly profileUrl?: string;
  readonly stage?: Stage;
  readonly notes?: string;
  readonly totalMonths?: number | null;
  readonly currentTitle?: string | null;
  readonly addedAt?: number;
}

export function candidate(spec: Spec): Candidate {
  const statuses = spec.statuses ?? ['met', 'met', 'not_found', 'met'];
  const results = statuses.map((status, index) => result(`r${index + 1}`, status));
  const match: MatchResult = {
    score: spec.score ?? 80,
    band: spec.band ?? 'partial',
    results,
    requiredMet: results.filter((r) => r.status === 'met' && (r.requirementId === 'r1' || r.requirementId === 'r2')).length,
    requiredTotal: 2,
  };
  return {
    id: spec.id,
    jobId: JOB.id,
    name: spec.name ?? `Pessoa Fictícia ${spec.id}`,
    profileUrl: spec.profileUrl ?? `https://www.linkedin.com/in/pessoa-${spec.id}/`,
    profileKey: `pessoa-${spec.id}`,
    card: { totalMonths: spec.totalMonths === undefined ? 75 : spec.totalMonths, currentTitle: spec.currentTitle === undefined ? 'Engenheira de Software' : spec.currentTitle, terms: [], searchedFreeTerms: [], sectionsRead: [], truncated: false },
    match,
    stage: spec.stage ?? 'reviewing',
    favorite: false,
    notes: spec.notes ?? '',
    informedAt: null,
    source: 'pasted',
    addedAt: spec.addedAt ?? 1000,
    updatedAt: 1000,
  };
}

const standardFontDataUrl = pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.resolve('pdfjs-dist/package.json'))), 'standard_fonts') + path.sep).href;

export interface ReadPage {
  readonly width: number;
  readonly height: number;
  readonly text: string;
  /** Cada pedaço de texto com a posição (x, y a partir da base da página) e o tamanho. */
  readonly items: readonly { str: string; x: number; y: number; width: number }[];
  readonly links: readonly string[];
}

export interface ReadPdf {
  readonly pages: readonly ReadPage[];
  readonly text: string;
  readonly links: readonly string[];
}

export async function readPdf(bytes: Uint8Array): Promise<ReadPdf> {
  const task = pdfjs.getDocument({ data: bytes.slice(), standardFontDataUrl, verbosity: 0 });
  const doc = await task.promise;
  const pages: ReadPage[] = [];
  for (let n = 1; n <= doc.numPages; n += 1) {
    const page = await doc.getPage(n);
    const view = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items = content.items.flatMap((item) => ('str' in item && item.str !== '' ? [{ str: item.str, x: item.transform[4] as number, y: item.transform[5] as number, width: item.width }] : []));
    const annotations = await page.getAnnotations();
    const links = annotations.flatMap((a: { subtype?: string; url?: string }) => (a.subtype === 'Link' && a.url !== undefined ? [a.url] : []));
    pages.push({ width: view.width, height: view.height, text: items.map((i) => i.str).join('\n'), items, links });
  }
  await task.destroy();
  return { pages, text: pages.map((p) => p.text).join('\n'), links: pages.flatMap((p) => p.links) };
}

export function latin1(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) out += String.fromCharCode(byte);
  return out;
}
