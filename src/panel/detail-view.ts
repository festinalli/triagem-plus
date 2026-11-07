// Detalhe da pessoa (RF-62 a RF-65, RF-90): explicação completa, etapa, favorito, notas, link, prazo e apagar.
// Notas são texto livre e nunca entram na nota. Se tocarem num assunto da trava, a tela alerta e não bloqueia (RF-65).
import { STAGES } from '../core/model.ts';
import { h } from './ui/h.ts';
import { Button, Checkbox, Form, formValues, Notice, SelectField, TextAreaField } from './ui/components.ts';
import { draft, formError, Message } from './frame.ts';
import type { MessageView } from './messages.ts';
import { InformedStatus, MessageSection } from './contact-view.ts';
import { ProfileLink, ReadNoticeView, RequirementList, ScoreBadge } from './people-view.ts';
import { DETAIL, RESULT, STAGE_NAMES } from './strings.ts';

const STAGE_OPTIONS = STAGES.map((stage) => ({ value: stage, label: STAGE_NAMES[stage] }));

function dateText(at: number): string {
  return new Date(at).toLocaleDateString('pt-BR');
}

export const CandidateDetailView: MessageView<'candidate_detail'> = (message, ctl) => {
  const expiring = message.retention === 'expiring';
  const expired = message.retention === 'expired';
  return Message({
    message,
    ctl,
    title: DETAIL.title(message.name),
    children: [
      h(
        'div',
        { class: 'tr-result__score' },
        ScoreBadge({ scored: message.scored, score: message.score, band: message.band }),
        h('p', { class: 'tr-text tr-text--muted' }, DETAIL.position(message.position, message.total)),
      ),
      ProfileLink({ link: message.link, text: message.linkText }),
      expired
        ? Notice({ tone: 'attention', title: DETAIL.expiredTitle, text: DETAIL.expiredText, live: true })
        : expiring ? Notice({ tone: 'attention', title: DETAIL.expiresTitle, text: DETAIL.expiresText(dateText(message.expiresAt)), live: true }) : h('p', { class: 'tr-text tr-text--muted tr-text--small' }, DETAIL.keepUntil(dateText(message.expiresAt))),
      InformedStatus(message, ctl),
      ReadNoticeView(message.readNotice),
      MessageSection(message, ctl),
      h(
        'section',
        { class: 'tr-block', 'aria-labelledby': 'detail-form-title' },
        h('h3', { class: 'tr-block__title', id: 'detail-form-title' }, DETAIL.formTitle),
        Form({
          label: DETAIL.formTitle,
          onSubmit: (form) => void ctl.saveCandidateDetails(message.candidateId, formValues(form)),
          children: [
            SelectField({ id: 'detail-stage', name: 'stage', label: DETAIL.stage, options: STAGE_OPTIONS, value: draft(ctl, 'stage', message.stage) }),
            Checkbox({ id: 'detail-favorite', name: 'favorite', label: DETAIL.favorite, checked: message.favorite }),
            TextAreaField({ id: 'detail-notes', name: 'notes', label: DETAIL.notes, help: DETAIL.notesHelp, rows: 4, maxlength: 5000, value: draft(ctl, 'notes', message.notes), error: formError(ctl, 'notes') }),
            message.noteAlerts.length === 0
              ? null
              : Notice({
                  tone: 'attention',
                  title: DETAIL.notesAlertTitle,
                  text: DETAIL.notesAlertText,
                  children: h('ul', { class: 'tr-plain-list', 'data-testid': 'note-alerts' }, message.noteAlerts.map((reason) => h('li', null, reason))),
                }),
            Button({ label: DETAIL.save, variant: 'primary', type: 'submit' }),
          ],
        }),
      ),
      h('section', { class: 'tr-block', 'aria-labelledby': 'detail-expl-title' }, h('h3', { class: 'tr-block__title', id: 'detail-expl-title' }, DETAIL.explanationTitle), RequirementList(message.lines)),
      h('p', { class: 'tr-text tr-text--muted tr-text--small' }, RESULT.support),
    ],
  });
};

export const ConfirmCandidateView: MessageView<'confirm_candidate'> = (message, ctl) =>
  Message({ message, ctl, title: DETAIL.confirmTitle, children: h('p', { class: 'tr-text', role: 'alert' }, DETAIL.confirmText(message.name)) });
