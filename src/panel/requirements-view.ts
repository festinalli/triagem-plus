// Mensagem dos requisitos (RF-11 a RF-16): sugestões a partir do texto, lista da vaga, adição à mão e termos excluídos.
// Toda recusa mostra o motivo que vem da trava (TOPIC_REASONS). Não há campo de teto de experiência (RF-14).
import type { RequirementKind, Requirement } from '../core/model.ts';
import { MIN_YEARS_HIGHEST, MIN_YEARS_LOWEST } from '../core/job/requirements.ts';
import { h } from './ui/h.ts';
import { Button, Checkbox, Form, formValues, Notice, SelectField, StatusPill, TextField } from './ui/components.ts';
import type { Controller, SuggestionItem } from './app.ts';
import { draft, formError, Message } from './frame.ts';
import type { MessageView } from './messages.ts';
import { KIND_LABELS, REQUIREMENTS } from './strings.ts';

const YEARS_KINDS: ReadonlySet<RequirementKind> = new Set<RequirementKind>(['term', 'total_experience']);
const KIND_OPTIONS = (Object.keys(KIND_LABELS) as RequirementKind[]).map((value) => ({ value, label: KIND_LABELS[value] }));
const IMPORTANCE_OPTIONS = [
  { value: 'required', label: REQUIREMENTS.required },
  { value: 'preferred', label: REQUIREMENTS.preferred },
];

function suggestionRow(item: SuggestionItem, index: number): HTMLElement {
  const { requirement } = item;
  const hasYears = YEARS_KINDS.has(requirement.kind);
  return h(
    'li',
    { class: 'tr-list__item tr-list__item--stack' },
    Checkbox({ id: `use-${index}`, label: REQUIREMENTS.use, checked: item.use }),
    h('p', { class: 'tr-list__meta' }, KIND_LABELS[requirement.kind]),
    requirement.kind === 'total_experience'
      ? h('p', { class: 'tr-list__title' }, requirement.label)
      : TextField({ id: `label-${index}`, label: REQUIREMENTS.nameLabel, maxlength: 200, value: requirement.label, error: item.error }),
    h('input', { type: 'hidden', name: `kind-${index}`, value: requirement.kind }),
    h(
      'div',
      { class: 'tr-pair' },
      SelectField({ id: `imp-${index}`, label: REQUIREMENTS.importance, options: IMPORTANCE_OPTIONS, value: requirement.importance }),
      hasYears
        ? TextField({ id: `years-${index}`, label: REQUIREMENTS.yearsLabel, type: 'number', inputmode: 'numeric', min: MIN_YEARS_LOWEST, max: MIN_YEARS_HIGHEST, value: requirement.minYears === undefined ? '' : String(requirement.minYears), error: requirement.kind === 'total_experience' ? item.error : undefined })
        : null,
    ),
  );
}

function suggestionBlock(ctl: Controller): HTMLElement | null {
  const suggestion = ctl.ui.suggestion;
  if (suggestion === null) return null;
  return h(
    'section',
    { class: 'tr-block', 'aria-labelledby': 'suggestions-title' },
    h('h3', { class: 'tr-block__title', id: 'suggestions-title' }, REQUIREMENTS.suggestionsTitle),
    suggestion.truncated ? Notice({ tone: 'attention', text: REQUIREMENTS.truncated }) : null,
    suggestion.ignored.length > 0
      ? Notice({
          tone: 'attention',
          title: REQUIREMENTS.ignoredTitle,
          text: REQUIREMENTS.ignoredIntro,
          children: h(
            'ul',
            { class: 'tr-plain-list', 'data-testid': 'ignored-lines' },
            suggestion.ignored.map((ignored) => h('li', null, h('q', null, ignored.line), h('span', { class: 'tr-reason' }, `${REQUIREMENTS.ignoredReason}: ${ignored.reason}`))),
          ),
        })
      : null,
    suggestion.needsManualEntry && suggestion.items.length === 0 ? Notice({ tone: 'info', text: REQUIREMENTS.manualNeeded }) : null,
    suggestion.items.length > 0
      ? Form({
          label: REQUIREMENTS.suggestionsTitle,
          onSubmit: (form) => void ctl.applySuggestion(formValues(form)),
          children: [
            h('p', { class: 'tr-text' }, REQUIREMENTS.suggestionsIntro),
            h('ul', { class: 'tr-list', 'aria-label': REQUIREMENTS.suggestionsTitle }, suggestion.items.map(suggestionRow)),
            suggestion.error === undefined ? null : Notice({ tone: 'error', text: suggestion.error, live: true }),
            h('div', { class: 'tr-msg__actions' }, Button({ label: REQUIREMENTS.suggestionsUse, variant: 'primary', type: 'submit' }), Button({ label: REQUIREMENTS.suggestionsDiscard, onClick: () => ctl.discardSuggestion() })),
          ],
        })
      : h('div', { class: 'tr-msg__actions' }, Button({ label: REQUIREMENTS.suggestionsDiscard, onClick: () => ctl.discardSuggestion() })),
  );
}

function savedRow(requirement: Requirement, ctl: Controller): HTMLElement {
  const error = ctl.ui.errors[requirement.id];
  return h(
    'li',
    { class: 'tr-list__item tr-list__item--stack', 'data-requirement': requirement.label },
    h('p', { class: 'tr-list__title' }, requirement.label),
    h(
      'p',
      { class: 'tr-list__meta' },
      KIND_LABELS[requirement.kind],
      ' ',
      StatusPill({ status: requirement.importance === 'required' ? 'info' : 'neutral', label: requirement.importance === 'required' ? REQUIREMENTS.required : REQUIREMENTS.preferred }),
      requirement.minYears === undefined ? null : ` ${REQUIREMENTS.yearsSuffix(requirement.minYears)}`,
    ),
    h(
      'div',
      { class: 'tr-pair' },
      SelectField({
        id: `saved-imp-${requirement.id}`,
        label: REQUIREMENTS.importanceNamed(requirement.label),
        options: IMPORTANCE_OPTIONS,
        value: requirement.importance,
        onChange: (value) => void ctl.changeRequirement(requirement.id, { importance: value === 'preferred' ? 'preferred' : 'required' }),
      }),
      YEARS_KINDS.has(requirement.kind)
        ? TextField({
            id: `saved-years-${requirement.id}`,
            label: REQUIREMENTS.yearsNamed(requirement.label),
            type: 'number',
            inputmode: 'numeric',
            min: MIN_YEARS_LOWEST,
            max: MIN_YEARS_HIGHEST,
            value: requirement.minYears === undefined ? '' : String(requirement.minYears),
            error,
            onChange: (value) => void ctl.changeRequirement(requirement.id, { years: value }),
          })
        : null,
    ),
    error !== undefined && !YEARS_KINDS.has(requirement.kind) ? h('p', { class: 'tr-field__error', role: 'alert' }, error) : null,
    h('div', { class: 'tr-list__actions' }, Button({ label: REQUIREMENTS.remove, ariaLabel: REQUIREMENTS.removeNamed(requirement.label), focusKey: `remove-${requirement.id}`, onClick: () => void ctl.removeRequirement(requirement.id) })),
  );
}

function manualForm(ctl: Controller): HTMLElement {
  const kind = (draft(ctl, 'kind', 'term') as RequirementKind) in KIND_LABELS ? (draft(ctl, 'kind', 'term') as RequirementKind) : 'term';
  const labelField = TextField({ id: 'hand-label', name: 'label', label: REQUIREMENTS.addLabel, help: REQUIREMENTS.addLabelHelp, maxlength: 200, value: draft(ctl, 'label', ''), error: formError(ctl, 'hand-label') });
  const yearsField = TextField({ id: 'hand-years', name: 'years', label: REQUIREMENTS.yearsLabel, help: REQUIREMENTS.addYearsHelp, type: 'number', inputmode: 'numeric', min: MIN_YEARS_LOWEST, max: MIN_YEARS_HIGHEST, value: draft(ctl, 'years', ''), error: formError(ctl, 'hand-years') });
  const sync = (value: string): void => {
    labelField.hidden = value === 'total_experience';
    yearsField.hidden = !YEARS_KINDS.has(value as RequirementKind);
  };
  sync(kind);
  return h(
    'section',
    { class: 'tr-block', 'aria-labelledby': 'hand-title' },
    h('h3', { class: 'tr-block__title', id: 'hand-title' }, REQUIREMENTS.addTitle),
    Form({
      label: REQUIREMENTS.addTitle,
      onSubmit: (form) => void ctl.addRequirementByHand(formValues(form)),
      children: [
        SelectField({ id: 'hand-kind', name: 'kind', label: REQUIREMENTS.addKind, options: KIND_OPTIONS, value: kind, onChange: sync }),
        labelField,
        h('div', { class: 'tr-pair' }, SelectField({ id: 'hand-importance', name: 'importance', label: REQUIREMENTS.importance, options: IMPORTANCE_OPTIONS, value: draft(ctl, 'importance', 'required') }), yearsField),
        Button({ label: REQUIREMENTS.addButton, type: 'submit', variant: 'primary' }),
      ],
    }),
  );
}

function excludedBlock(terms: readonly string[], ctl: Controller): HTMLElement {
  return h(
    'section',
    { class: 'tr-block', 'aria-labelledby': 'excluded-title' },
    h('h3', { class: 'tr-block__title', id: 'excluded-title' }, REQUIREMENTS.excludedTitle),
    terms.length === 0
      ? h('p', { class: 'tr-text tr-text--muted' }, REQUIREMENTS.excludedEmpty)
      : h(
          'ul',
          { class: 'tr-list', 'aria-label': REQUIREMENTS.excludedListLabel },
          terms.map((term) =>
            h('li', { class: 'tr-list__item' }, h('div', { class: 'tr-list__main' }, h('p', { class: 'tr-list__title' }, term)), h('div', { class: 'tr-list__actions' }, Button({ label: REQUIREMENTS.remove, ariaLabel: REQUIREMENTS.excludedRemove(term), focusKey: `remove-excluded-${term}`, onClick: () => void ctl.removeExcluded(term) }))),
          ),
        ),
    Form({
      label: REQUIREMENTS.excludedTitle,
      onSubmit: (form) => void ctl.addExcluded(formValues(form)['excluded'] ?? ''),
      children: [
        TextField({ id: 'excluded', label: REQUIREMENTS.excludedLabel, help: REQUIREMENTS.excludedHelp, maxlength: 200, value: draft(ctl, 'excluded', ''), error: formError(ctl, 'excluded') }),
        Button({ label: REQUIREMENTS.excludedButton, type: 'submit' }),
      ],
    }),
  );
}

export const RequirementsView: MessageView<'requirements'> = (message, ctl) => {
  const { job } = message;
  const reread = job.text.trim() !== '' && ctl.ui.suggestion === null;
  // Com sugestões na tela, seguir para a busca as jogaria fora, sem aviso. O caminho é "Usar os marcados".
  const pending = (ctl.ui.suggestion?.items.length ?? 0) > 0;
  return Message({
    message: pending ? { ...message, actions: message.actions.filter((action) => action.id !== 'open_search') } : message,
    ctl,
    title: REQUIREMENTS.title,
    children: [
      h('p', { class: 'tr-msg__strong' }, REQUIREMENTS.forJob(job.title)),
      h('p', { class: 'tr-text tr-text--small tr-text--muted', 'data-testid': 'guard-limits' }, REQUIREMENTS.guardLimits),
      job.text.trim() === '' ? h('p', { class: 'tr-text' }, REQUIREMENTS.noText) : null,
      suggestionBlock(ctl),
      h(
        'section',
        { class: 'tr-block', 'aria-labelledby': 'saved-title' },
        h('h3', { class: 'tr-block__title', id: 'saved-title' }, REQUIREMENTS.savedTitle),
        job.requirements.length === 0 ? h('p', { class: 'tr-text tr-text--muted' }, REQUIREMENTS.savedEmpty) : h('ul', { class: 'tr-list', 'aria-label': REQUIREMENTS.savedLabel }, job.requirements.map((requirement) => savedRow(requirement, ctl))),
        reread ? h('div', { class: 'tr-msg__actions' }, Button({ label: REQUIREMENTS.suggestionsAgain, onClick: () => ctl.suggestAgain() })) : null,
      ),
      manualForm(ctl),
      excludedBlock(job.excludedTerms, ctl),
    ],
  });
};
