// Do modelo do relatório ao arquivo que a pessoa baixa (RF-70): PDF de verdade ou planilha CSV, com o mesmo conteúdo.
import type { Candidate, Job } from '../core/model.ts';
import { renderCsv } from '../core/report/csv.ts';
import { reportFileName } from '../core/report/filename.ts';
import { buildReport } from '../core/report/model.ts';
import type { ReportScope } from '../core/report/model.ts';
import { renderPdf } from '../core/report/pdf.ts';

export type ReportFormat = 'pdf' | 'csv';

export interface ReportFile {
  readonly blob: Blob;
  readonly name: string;
  /** Letras que saíram como "?" no PDF (RF-75). Nulo na planilha, que guarda o texto como está. */
  readonly replacedCount: number | null;
}

export function buildReportFiles(input: {
  readonly job: Job;
  readonly candidates: readonly Candidate[];
  readonly scope: ReportScope;
  readonly includeNotes: boolean;
  readonly now: number;
  readonly format: ReportFormat;
  readonly allCount?: number;
  readonly filterTexts?: readonly string[];
}): ReportFile {
  const model = buildReport({
    job: input.job,
    candidates: input.candidates,
    scope: input.scope,
    includeNotes: input.includeNotes,
    now: input.now,
    ...(input.allCount === undefined ? {} : { allCount: input.allCount }),
    ...(input.filterTexts === undefined ? {} : { filterTexts: input.filterTexts }),
  });
  if (input.format === 'csv') {
    return { blob: new Blob([renderCsv(model)], { type: 'text/csv;charset=utf-8' }), name: reportFileName(input.job.title, input.now, 'csv'), replacedCount: null };
  }
  const pdf = renderPdf(model);
  return { blob: new Blob([pdf.bytes.slice().buffer], { type: 'application/pdf' }), name: reportFileName(input.job.title, input.now, 'pdf'), replacedCount: pdf.replacedCount };
}
