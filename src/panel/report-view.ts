// Gerar PDF (RF-70 a RF-75): escolha simples, aviso de dados pessoais sempre visível junto do botão e clique que baixa direto.
// Na primeira vez o botão diz que a pessoa entendeu o aviso, e o aceite é gravado (acceptances.fileExport).
import { h } from './ui/h.ts';
import { Button, Checkbox, Notice, RadioGroup } from './ui/components.ts';
import { Message } from './frame.ts';
import type { MessageView } from './messages.ts';
import { REPORT } from './strings.ts';

export const ReportOptionsView: MessageView<'report_options'> = (message, ctl) => {
  const empty = message.total === 0;
  const first = !message.exportAccepted;
  return Message({
    message,
    ctl,
    title: REPORT.title,
    children: [
      h('p', { class: 'tr-text' }, REPORT.intro),
      empty
        ? h('p', { class: 'tr-text' }, REPORT.scopeEmpty)
        : [
            RadioGroup({
              name: 'report-scope',
              legend: REPORT.scopeLegend,
              value: message.scope,
              options: [
                { value: 'top10', label: REPORT.scopeTop },
                { value: 'filtered', label: message.filtersActive ? REPORT.scopeFiltered(message.filteredCount) : REPORT.scopeFilteredPlain(message.total) },
              ],
              onChange: (value) => ctl.setReport({ scope: value === 'filtered' ? 'filtered' : 'top10' }),
            }),
            Checkbox({ id: 'report-notes', label: REPORT.includeNotes, checked: message.includeNotes, describedBy: 'report-notes-help', onChange: (checked) => ctl.setReport({ includeNotes: checked }) }),
            h('p', { class: 'tr-field__help', id: 'report-notes-help' }, REPORT.includeNotesHelp),
          ],
      Notice({
        tone: 'attention',
        title: REPORT.noticeTitle,
        children: [h('p', { class: 'tr-notice__text', id: 'report-notice' }, REPORT.notice), first ? h('p', { class: 'tr-notice__text' }, REPORT.firstTimeNotice) : null],
        class: 'tr-report-notice',
      }),
      h(
        'div',
        { class: 'tr-msg__actions' },
        Button({ label: first ? REPORT.pdfFirst : REPORT.pdf, variant: 'primary', disabled: empty, describedBy: 'report-notice', focusKey: 'report-pdf', onClick: () => void ctl.download('pdf') }),
        Button({ label: first ? REPORT.csvFirst : REPORT.csv, disabled: empty, describedBy: 'report-notice', focusKey: 'report-csv', onClick: () => void ctl.download('csv') }),
      ),
      h('p', { class: 'tr-text tr-text--muted tr-text--small' }, REPORT.csvHelp),
      message.replacedCount !== null && message.replacedCount > 0 ? Notice({ tone: 'attention', title: REPORT.replacedTitle, text: REPORT.replaced(message.replacedCount), live: true }) : null,
      h('p', { class: 'tr-text tr-text--muted tr-text--small' }, REPORT.support),
    ],
  });
};
