// Mensagens do resultado (RF-50 a RF-56, RF-64, RF-67) e do Top 10 (RF-61, RF-68, RF-82).
import type { MessageView } from './messages.ts';
import { h } from './ui/h.ts';
import { Notice } from './ui/components.ts';
import { Message } from './frame.ts';
import { PersonItem, ProfileLink, ReadNoticeView, RequirementList, ScoreBadge } from './people-view.ts';
import { NextProfileBlock, ReadNextButton } from './read-page-block.ts';
import { RESULT, TOP } from './strings.ts';

export const AnalysisResultView: MessageView<'analysis_result'> = (message, ctl) =>
  Message({
    message,
    ctl,
    title: RESULT.title(message.name),
    children: [
      h(
        'div',
        { class: 'tr-result__score' },
        ScoreBadge({ scored: message.scored, score: message.score, band: message.band, preview: message.preview }),
        message.scored ? h('p', { class: 'tr-text tr-text--muted' }, RESULT.requiredCount(message.requiredMet, message.requiredTotal)) : h('p', { class: 'tr-text' }, RESULT.noScoreText),
      ),
      ProfileLink({ link: message.link, text: message.linkText }),
      NextProfileBlock(ctl, 'result'),
      message.updated ? Notice({ tone: 'info', text: RESULT.updated, live: true }) : null,
      message.updated && message.addedNothing ? Notice({ tone: 'info', text: RESULT.addedNothing, live: true }) : null,
      message.notProfileLink ? Notice({ tone: 'attention', text: RESULT.notProfileLink, live: true }) : null,
      ReadNoticeView(message.readNotice),
      h('section', { class: 'tr-block', 'aria-labelledby': 'result-reqs-title' }, h('h3', { class: 'tr-block__title', id: 'result-reqs-title' }, RESULT.requirementsTitle), RequirementList(message.lines)),
      h('p', { class: 'tr-text tr-text--muted tr-text--small' }, RESULT.support),
    ],
  });

export const TopTenView: MessageView<'top_ten'> = (message, ctl) => {
  const entered = message.entered;
  const anyNotInformed = message.rows.some((row) => row.notInformed);
  return Message({
    message,
    ctl,
    title: message.total >= 10 ? TOP.title : TOP.titleFew(message.rows.length),
    topActions: ['open_report', 'show_all'],
    children: [
      entered === null
        ? null
        : Notice({
            tone: entered.inTop ? 'success' : 'attention',
            text: entered.inTop ? TOP.entered(entered.name, entered.position, entered.updated) : TOP.enteredOut(entered.name, entered.position, entered.total),
            live: true,
          }),
      h('p', { class: 'tr-text tr-text--muted', 'data-testid': 'top-total' }, TOP.total(message.rows.length, message.total)),
      ReadNextButton(ctl),
      // Depois de analisar alguém, o botão já aparece no resultado, logo acima.
      ctl.ui.analysis === null ? NextProfileBlock(ctl, 'top') : null,
      h('ol', { class: 'tr-people', 'aria-label': TOP.listLabel }, message.rows.map((row) => PersonItem(row, ctl))),
      message.rows.some((row) => row.preview) ? h('p', { class: 'tr-text tr-text--muted tr-text--small' }, TOP.previewHelp) : null,
      anyNotInformed ? h('p', { class: 'tr-text tr-text--muted tr-text--small' }, TOP.notInformedHelp) : null,
      h('p', { class: 'tr-text tr-text--muted tr-text--small' }, TOP.support),
    ],
  });
};
