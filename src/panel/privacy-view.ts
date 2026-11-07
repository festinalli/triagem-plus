// A tela de Privacidade (RF-91 a RF-94, RNF-05, FL-9): o que fica guardado, achar uma pessoa, exportar e apagar.
// Nome, link, cargo e notas de candidatos chegam de fora e entram sempre como texto, nunca como HTML (RNF-04).
import type { PersonGroup, StoredRecord } from '../core/conversation/privacy.ts';
import { h } from './ui/h.ts';
import type { Child } from './ui/h.ts';
import { Button, Disclosure, Form, formValues, Notice, TextField } from './ui/components.ts';
import { draft, formError, Message } from './frame.ts';
import type { MessageView } from './messages.ts';
import { ProfileLink } from './people-view.ts';
import type { Controller } from './app.ts';
import { CONFIRM_PERSON, DATA, FIND, PRIVACY, RECORD } from './privacy-strings.ts';
import { BAND_NAMES, REPORT, SECTION_NAMES, STAGE_NAMES } from './strings.ts';

function dateText(at: number): string {
  return new Date(at).toLocaleDateString('pt-BR');
}

const number = (value: number): string => value.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

/** Tamanho em texto simples: bytes, KB ou MB. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${number(bytes / 1024)} KB`;
  return `${number(bytes / (1024 * 1024))} MB`;
}

function Section(id: string, title: string, ...children: Child[]): HTMLElement {
  return h('section', { class: 'tr-block', 'aria-labelledby': `privacy-${id}` }, h('h3', { class: 'tr-block__title', id: `privacy-${id}` }, title), children);
}

const bullets = (items: readonly string[]): HTMLElement => h('ul', { class: 'tr-plain-list' }, items.map((item) => h('li', null, item)));

export const PrivacyInfoView: MessageView<'privacy_info'> = (message, ctl) =>
  Message({
    message,
    ctl,
    title: PRIVACY.title,
    children: [
      Notice({ tone: 'attention', title: PRIVACY.notLegal.title, text: PRIVACY.notLegal.text }),
      Section('stored', PRIVACY.stored.title, bullets(PRIVACY.stored.items), h('p', { class: 'tr-text' }, PRIVACY.stored.session)),
      Section('where', PRIVACY.where.title, h('p', { class: 'tr-text' }, PRIVACY.where.text)),
      Section('how-long', PRIVACY.howLong.title, h('p', { class: 'tr-text' }, PRIVACY.howLong.text(message.retentionDays))),
      Section(
        'unprotected',
        PRIVACY.unprotected.title,
        Notice({ tone: 'error', children: bullets(PRIVACY.unprotected.items), class: 'tr-privacy-notice' }),
      ),
      Section('yours', PRIVACY.yours.title, bullets(PRIVACY.yours.items)),
      Section(
        'space',
        PRIVACY.space.title,
        h('p', { class: 'tr-text', 'data-testid': 'storage-used' }, message.bytes === null ? PRIVACY.space.unknown : PRIVACY.space.used(formatBytes(message.bytes), formatBytes(message.limitBytes))),
        message.storage === 'near_limit' ? Notice({ tone: 'attention', text: PRIVACY.space.near, live: true }) : message.bytes === null ? null : h('p', { class: 'tr-text tr-text--muted tr-text--small' }, PRIVACY.space.ok),
      ),
    ],
  });

function FactRow(label: string, value: Child): Child[] {
  return [h('dt', { class: 'tr-facts__label' }, label), h('dd', { class: 'tr-facts__value' }, value)];
}

function RecordFacts(record: StoredRecord): HTMLElement {
  return h(
    'section',
    { class: 'tr-record', 'data-record': record.id },
    h('h4', { class: 'tr-record__title' }, record.jobTitle ?? RECORD.jobGone),
    h(
      'dl',
      { class: 'tr-facts' },
      FactRow(RECORD.score, record.scored ? `${record.score} (${BAND_NAMES[record.band]})` : RECORD.noScore),
      FactRow(RECORD.stage, STAGE_NAMES[record.stage]),
      FactRow(RECORD.currentTitle, record.currentTitle ?? RECORD.noTitle),
      FactRow(RECORD.experience, record.totalMonths === null ? RECORD.noExperience : RECORD.months(record.totalMonths)),
      FactRow(RECORD.terms, record.terms.length === 0 ? RECORD.noTerms : record.terms.join(', ')),
      FactRow(RECORD.sections, record.sectionsRead.length === 0 ? RECORD.noTerms : record.sectionsRead.map((section) => SECTION_NAMES[section]).join(', ')),
      FactRow(RECORD.favorite, record.favorite ? RECORD.yes : RECORD.no),
      FactRow(RECORD.notes, record.notes.trim() === '' ? RECORD.noNotes : h('span', { class: 'tr-facts__notes' }, record.notes)),
      FactRow(RECORD.informed, record.informedAt === null ? RECORD.notInformed : dateText(record.informedAt)),
      FactRow(RECORD.source, record.source === 'clicked' ? RECORD.clicked : RECORD.pasted),
      FactRow(RECORD.added, dateText(record.addedAt)),
      FactRow(RECORD.updated, dateText(record.updatedAt)),
      FactRow(RECORD.keepUntil, record.expiresAt < Date.now() ? RECORD.expiredNote : dateText(record.expiresAt)),
    ),
  );
}

const KEY = (id: string): string => `found:${id}`;

function PersonCard(group: PersonGroup, editing: boolean, open: boolean, ctl: Controller): HTMLElement {
  return h(
    'li',
    { class: 'tr-found', 'data-person': group.id },
    h('p', { class: 'tr-found__name' }, group.name),
    ProfileLink({ link: group.link, text: group.linkText }),
    h('p', { class: 'tr-text tr-text--muted tr-text--small' }, FIND.inJobs(group.records.length)),
    Disclosure({ summary: FIND.seeAll, open, children: group.records.map(RecordFacts) }),
    editing
      ? Form({
          label: FIND.correct,
          onSubmit: (form) => void ctl.privacy.savePerson(group.id, formValues(form)),
          children: [
            TextField({ id: 'person-name', name: 'name', label: FIND.editName, required: true, maxlength: 120, value: draft(ctl, 'name', group.name), error: formError(ctl, 'person-name') }),
            TextField({ id: 'person-link', name: 'link', label: FIND.editLink, help: FIND.editLinkHelp, required: true, maxlength: 2048, value: draft(ctl, 'link', group.linkText), error: formError(ctl, 'person-link') }),
            h('div', { class: 'tr-msg__actions' }, Button({ label: FIND.editSave, variant: 'primary', type: 'submit' }), Button({ label: FIND.editCancel, focusKey: KEY(`${group.id}:cancel`), onClick: () => ctl.privacy.edit(null) })),
          ],
        })
      : h(
          'div',
          { class: 'tr-msg__actions' },
          Button({ label: FIND.correct, ariaLabel: FIND.correctNamed(group.name), focusKey: KEY(`${group.id}:edit`), onClick: () => ctl.privacy.edit(group.id) }),
          Button({ label: FIND.export, ariaLabel: FIND.exportNamed(group.name), focusKey: KEY(`${group.id}:export`), describedBy: 'find-export-notice', onClick: () => void ctl.privacy.exportPerson(group.id) }),
          Button({ label: FIND.delete, ariaLabel: FIND.deleteNamed(group.name), variant: 'danger', focusKey: KEY(`${group.id}:delete`), onClick: () => ctl.run({ id: 'delete_person', candidateId: group.id }) }),
        ),
  );
}

export const PrivacyPeopleView: MessageView<'privacy_people'> = (message, ctl) => {
  const groups = message.groups;
  const status = ctl.privacy.peopleStatus;
  return Message({
    message,
    ctl,
    title: FIND.title,
    children: [
      h('p', { class: 'tr-text' }, FIND.intro),
      Form({
        label: FIND.title,
        onSubmit: (form) => void ctl.privacy.search(formValues(form)['query'] ?? ''),
        children: [
          TextField({ id: 'privacy-query', name: 'query', label: FIND.label, help: FIND.help, maxlength: 300, value: draft(ctl, 'query', message.query), error: formError(ctl, 'privacy-query') }),
          Button({ label: FIND.submit, variant: 'primary', type: 'submit', focusKey: 'find-submit' }),
        ],
      }),
      h('p', { class: 'tr-text tr-text--ok', role: 'status', 'data-testid': 'find-status' }, status ?? ''),
      groups === null
        ? null
        : groups.length === 0
          ? h('p', { class: 'tr-text', role: 'status', 'data-testid': 'find-count' }, FIND.none)
          : [
              h('p', { class: 'tr-msg__strong', role: 'status', 'data-testid': 'find-count' }, FIND.count(groups.length)),
              Notice({ tone: 'attention', text: FIND.exportNotice, class: 'tr-report-notice' }),
              h('span', { class: 'tr-visually-hidden', id: 'find-export-notice' }, FIND.exportNotice),
              h('ul', { class: 'tr-found-list', 'aria-label': FIND.listLabel }, groups.map((group) => PersonCard(group, message.editing !== null && group.records.some((record) => record.id === message.editing), groups.length === 1, ctl))),
            ],
    ],
  });
};

export const PrivacyDataView: MessageView<'privacy_data'> = (message, ctl) => {
  const first = !message.exportAccepted;
  const status = ctl.privacy.dataStatus;
  return Message({
    message,
    ctl,
    title: DATA.title,
    children: [
      Section(
        'export',
        DATA.exportTitle,
        h('p', { class: 'tr-text' }, DATA.exportText),
        Notice({
          tone: 'attention',
          title: REPORT.noticeTitle,
          children: [h('p', { class: 'tr-notice__text', id: 'export-notice' }, REPORT.notice), first ? h('p', { class: 'tr-notice__text' }, REPORT.firstTimeNotice) : null],
          class: 'tr-report-notice',
        }),
        h('div', { class: 'tr-msg__actions' }, Button({ label: first ? DATA.exportButtonFirst : DATA.exportButton, variant: 'primary', describedBy: 'export-notice', focusKey: 'export-all', onClick: () => void ctl.privacy.exportEverything() })),
        h('p', { class: 'tr-text tr-text--ok', role: 'status', 'data-testid': 'export-status' }, status ?? ''),
      ),
      Section(
        'wipe',
        DATA.wipeTitle,
        h('p', { class: 'tr-text' }, DATA.wipeText),
        h('p', { class: 'tr-text' }, DATA.wipeUninstall),
        Form({
          label: DATA.wipeTitle,
          onSubmit: (form) => void ctl.privacy.wipe(formValues(form)),
          children: [
            TextField({ id: 'wipe-confirm', name: 'confirm', label: DATA.wipeLabel, help: DATA.wipeHelp, value: draft(ctl, 'confirm', ''), error: formError(ctl, 'wipe-confirm') }),
            Button({ label: DATA.wipeButton, variant: 'danger', type: 'submit', focusKey: 'wipe-submit' }),
          ],
        }),
      ),
    ],
  });
};

export const ConfirmPersonView: MessageView<'confirm_person'> = (message, ctl) =>
  Message({ message, ctl, title: CONFIRM_PERSON.title, children: h('p', { class: 'tr-text', role: 'alert' }, CONFIRM_PERSON.text(message.name, message.recordCount)) });
