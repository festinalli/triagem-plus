// O desenho de cada tipo de mensagem. `MESSAGE_VIEWS` exige um desenho para cada `kind` de `ConversationMessage`: ao
// acrescentar um tipo em src/core/conversation/build.ts, o compilador aponta aqui o que falta (e só aqui).
// Todo texto de terceiros (título da vaga, frases coladas) entra por filho de texto, nunca por HTML (RNF-04).
import type { Action, ConversationMessage, MessageKind } from '../core/conversation/build.ts';
import { h } from './ui/h.ts';
import { Button, Form, Notice, StatusPill, TextAreaField, TextField } from './ui/components.ts';
import { draft, formError, Message } from './frame.ts';
import type { Controller } from './app.ts';
import { ACTIONS, FIELDS, FIRST_RUN, HELP, HOME, JOBS, NOTICES, SETTINGS } from './strings.ts';
import { RequirementsView } from './requirements-view.ts';
import { SearchView } from './search-view.ts';
import { PasteFormView } from './paste-view.ts';
import { AnalysisResultView, TopTenView } from './result-view.ts';
import { CandidateListView } from './list-view.ts';
import { CandidateDetailView, ConfirmCandidateView } from './detail-view.ts';
import { ReportOptionsView } from './report-view.ts';
import { TemplatesSection } from './contact-view.ts';
import { ConfirmPersonView, PrivacyDataView, PrivacyInfoView, PrivacyPeopleView } from './privacy-view.ts';
import { ClickReadSection } from './click-settings-view.ts';

type Of<K extends MessageKind> = Extract<ConversationMessage, { kind: K }>;
export type MessageView<K extends MessageKind> = (message: Of<K>, ctl: Controller) => HTMLElement;
export type ViewMap = { [K in MessageKind]: MessageView<K> };

/** Os três campos do responsável e do prazo, iguais no aceite e nos ajustes. */
function responsibleFields(message: Of<'accept_form'> | Of<'settings_form'>, ctl: Controller): HTMLElement[] {
  const { retention } = message;
  return [
    TextField({ id: 'responsibleName', label: FIELDS.name, required: true, autocomplete: 'name', maxlength: 120, value: draft(ctl, 'responsibleName', message.responsibleName), error: formError(ctl, 'responsibleName') }),
    TextField({ id: 'responsibleContact', label: FIELDS.contact, help: FIELDS.contactHelp, required: true, autocomplete: 'email', maxlength: 160, value: draft(ctl, 'responsibleContact', message.responsibleContact), error: formError(ctl, 'responsibleContact') }),
    TextField({
      id: 'retentionDays',
      label: FIELDS.retention,
      help: FIELDS.retentionHelp(retention.defaultDays, retention.minDays, retention.maxDays),
      required: true,
      type: 'number',
      inputmode: 'numeric',
      min: retention.minDays,
      max: retention.maxDays,
      value: draft(ctl, 'retentionDays', String(message.retentionDays)),
      error: formError(ctl, 'retentionDays'),
    }),
  ];
}

const NoticesView: MessageView<'notices'> = (message, ctl) =>
  Message({
    message,
    ctl,
    title: FIRST_RUN.noticesTitle,
    children: [
      h('p', { class: 'tr-text' }, FIRST_RUN.noticesIntro),
      message.blocks.map((id) => h('section', { class: 'tr-block', 'aria-labelledby': `notice-${id}` }, h('h3', { class: 'tr-block__title', id: `notice-${id}` }, NOTICES[id].title), h('p', { class: 'tr-text' }, NOTICES[id].text))),
    ],
  });

const AcceptFormView: MessageView<'accept_form'> = (message, ctl) =>
  Message({
    message,
    ctl,
    title: FIRST_RUN.acceptTitle,
    children: [
      h('p', { class: 'tr-text' }, FIRST_RUN.acceptIntro),
      Form({
        label: FIRST_RUN.acceptTitle,
        onSubmit: (form) => void ctl.accept(Object.fromEntries(new FormData(form).entries()) as Record<string, string>),
        children: [...responsibleFields(message, ctl), Button({ label: FIRST_RUN.acceptButton, variant: 'primary', type: 'submit', block: true })],
      }),
    ],
  });

const NoJobView: MessageView<'no_job'> = (message, ctl) =>
  Message({ message, ctl, title: HOME.noJobTitle, children: [h('p', { class: 'tr-text' }, HOME.noJobText), message.archivedCount > 0 ? h('p', { class: 'tr-text tr-text--muted' }, HOME.noJobArchived(message.archivedCount)) : null] });

const JobListView: MessageView<'job_list'> = (message, ctl) =>
  Message({
    message,
    ctl,
    title: JOBS.listTitle,
    children:
      message.jobs.length === 0
        ? h('p', { class: 'tr-text' }, JOBS.listEmpty)
        : h(
            'ul',
            { class: 'tr-list', 'aria-label': JOBS.listLabel },
            message.jobs.map((job) => {
              const buttons: Action[] = [
                ...(job.archived ? [{ id: 'unarchive_job' as const, jobId: job.id }] : job.active ? [] : [{ id: 'activate_job' as const, jobId: job.id, primary: true }]),
                { id: 'edit_job', jobId: job.id },
                ...(job.archived ? [] : [{ id: 'archive_job' as const, jobId: job.id }]),
                { id: 'delete_job', jobId: job.id, danger: true },
              ];
              return h(
                'li',
                { class: 'tr-list__item' },
                h('div', { class: 'tr-list__main' }, h('p', { class: 'tr-list__title' }, job.title), h('p', { class: 'tr-list__meta' }, JOBS.requirementCount(job.requirementCount), ' ', job.active ? StatusPill({ status: 'success', label: JOBS.active }) : null, job.archived ? StatusPill({ status: 'neutral', label: JOBS.archived }) : null)),
                h(
                  'div',
                  { class: 'tr-list__actions' },
                  buttons.map((action) =>
                    Button({
                      label: ACTIONS[action.id],
                      ariaLabel: `${ACTIONS[action.id]}: ${job.title}`,
                      variant: action.danger ? 'danger' : action.primary ? 'primary' : 'secondary',
                      focusKey: `${message.id}:${action.id}:${job.id}`,
                      onClick: () => ctl.run(action),
                    }),
                  ),
                ),
              );
            }),
          ),
  });

const JobSummaryView: MessageView<'job_summary'> = (message, ctl) => {
  const empty = message.requiredCount + message.preferredCount === 0;
  return Message({
    message,
    ctl,
    title: HOME.summaryTitle,
    children: [h('p', { class: 'tr-msg__strong' }, message.title), h('p', { class: 'tr-text' }, HOME.summaryCounts(message.requiredCount, message.preferredCount, message.excludedCount)), h('p', { class: 'tr-text tr-text--muted' }, empty ? HOME.nextRequirements : HOME.nextSearch)],
  });
};

const JobFormView: MessageView<'job_form'> = (message, ctl) => {
  const editing = message.job !== null;
  const id = message.job?.id ?? null;
  return Message({
    message,
    ctl,
    title: editing ? JOBS.formEditTitle : JOBS.formCreateTitle,
    children: Form({
      label: editing ? JOBS.formEditTitle : JOBS.formCreateTitle,
      onSubmit: (form) => void ctl.saveJob(id, Object.fromEntries(new FormData(form).entries()) as Record<string, string>),
      children: [
        TextField({ id: 'title', label: JOBS.titleLabel, help: JOBS.titleHelp, required: true, maxlength: 120, value: draft(ctl, 'title', message.job?.title ?? ''), error: formError(ctl, 'title') }),
        TextAreaField({ id: 'text', label: JOBS.textLabel, help: JOBS.textHelp, rows: 9, maxlength: 50_000, value: draft(ctl, 'text', message.job?.text ?? '') }),
        Button({ label: editing ? JOBS.save : JOBS.saveCreate, variant: 'primary', type: 'submit', block: true }),
      ],
    }),
  });
};

const SettingsFormView: MessageView<'settings_form'> = (message, ctl) => {
  const accepted = ctl.snapshot().settings.acceptances.terms;
  return Message({
    message,
    ctl,
    title: SETTINGS.title,
    children: [
      Form({
        label: SETTINGS.title,
        onSubmit: (form) => void ctl.saveSettings(Object.fromEntries(new FormData(form).entries()) as Record<string, string>),
        children: [...responsibleFields(message, ctl), Button({ label: SETTINGS.save, variant: 'primary', type: 'submit', block: true })],
      }),
      ctl.ui.retentionConfirm === null
        ? null
        : Notice({
            tone: 'attention',
            title: SETTINGS.retentionConfirmTitle,
            text: SETTINGS.retentionConfirmText(ctl.ui.retentionConfirm.count, ctl.ui.retentionConfirm.days),
            live: true,
            children: h(
              'div',
              { class: 'tr-msg__actions' },
              Button({ label: SETTINGS.retentionConfirmButton(ctl.ui.retentionConfirm.count), variant: 'danger', focusKey: 'retention-confirm', onClick: () => void ctl.confirmRetention() }),
              Button({ label: SETTINGS.retentionBack, variant: 'primary', focusKey: 'retention-back', onClick: () => ctl.cancelRetention() }),
            ),
          }),
      ctl.ui.settingsSaved ? h('p', { class: 'tr-text tr-text--ok', role: 'status' }, SETTINGS.saved) : null,
      ClickReadSection(ctl),
      TemplatesSection(message, ctl),
      accepted === undefined ? null : h('p', { class: 'tr-text tr-text--muted tr-text--small' }, SETTINGS.accepted(new Date(accepted.at).toLocaleDateString('pt-BR'))),
    ],
  });
};

const ConfirmView: MessageView<'confirm'> = (message, ctl) =>
  Message({
    message,
    ctl,
    title: message.what === 'delete_job' ? JOBS.confirmDeleteTitle : JOBS.confirmArchiveTitle,
    children: h('p', { class: 'tr-text', role: 'alert' }, message.what === 'delete_job' ? JOBS.confirmDeleteText(message.title) : JOBS.confirmArchiveText(message.title)),
  });

const HelpView: MessageView<'help_affirmative'> = (message, ctl) =>
  Message({ message, ctl, title: HELP.title, children: HELP.paragraphs.map((text) => h('p', { class: 'tr-text' }, text)) });

export const MESSAGE_VIEWS: ViewMap = {
  notices: NoticesView,
  accept_form: AcceptFormView,
  no_job: NoJobView,
  job_list: JobListView,
  job_summary: JobSummaryView,
  job_form: JobFormView,
  requirements: RequirementsView,
  search: SearchView,
  settings_form: SettingsFormView,
  confirm: ConfirmView,
  help_affirmative: HelpView,
  paste_form: PasteFormView,
  analysis_result: AnalysisResultView,
  top_ten: TopTenView,
  candidate_list: CandidateListView,
  candidate_detail: CandidateDetailView,
  report_options: ReportOptionsView,
  confirm_candidate: ConfirmCandidateView,
  privacy_info: PrivacyInfoView,
  privacy_people: PrivacyPeopleView,
  privacy_data: PrivacyDataView,
  confirm_person: ConfirmPersonView,
};

export function renderMessage(message: ConversationMessage, ctl: Controller): HTMLElement {
  const view = MESSAGE_VIEWS[message.kind] as (message: ConversationMessage, ctl: Controller) => HTMLElement;
  return view(message, ctl);
}
