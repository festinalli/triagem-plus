// Ver todos, com filtros (RF-60, CA-12). O filtro só esconde da tela: a tela diz quantos ficaram de fora e ninguém é apagado.
import { STAGES } from '../core/model.ts';
import { h } from './ui/h.ts';
import { Button, Checkbox, Form, formValues, Notice, SelectField, TextField } from './ui/components.ts';
import { draft, formError, Message } from './frame.ts';
import type { MessageView } from './messages.ts';
import { PersonItem } from './people-view.ts';
import { BAND_NAMES, LIST, STAGE_NAMES } from './strings.ts';

const BAND_OPTIONS = [{ value: 'any', label: LIST.any }, ...(['strong', 'partial', 'weak'] as const).map((band) => ({ value: band, label: BAND_NAMES[band] }))];
const STAGE_OPTIONS = [{ value: 'any', label: LIST.any }, ...STAGES.map((stage) => ({ value: stage, label: STAGE_NAMES[stage] }))];

export const CandidateListView: MessageView<'candidate_list'> = (message, ctl) => {
  const { filters } = message;
  const form = Form({
    label: LIST.filtersTitle,
    onSubmit: (element) => ctl.setFilters(formValues(element)),
    children: [
      TextField({ id: 'filter-term', name: 'term', label: LIST.term, help: LIST.termHelp, maxlength: 200, value: draft(ctl, 'term', filters.term), error: formError(ctl, 'term') }),
      TextField({ id: 'filter-years', name: 'minYears', label: LIST.minYears, type: 'number', inputmode: 'numeric', min: 0, max: 60, value: draft(ctl, 'minYears', filters.minYears === null ? '' : String(filters.minYears)), error: formError(ctl, 'minYears') }),
      h(
        'div',
        { class: 'tr-pair' },
        SelectField({ id: 'filter-band', name: 'band', label: LIST.band, options: BAND_OPTIONS, value: draft(ctl, 'band', filters.band) }),
        SelectField({ id: 'filter-stage', name: 'stage', label: LIST.stage, options: STAGE_OPTIONS, value: draft(ctl, 'stage', filters.stage) }),
      ),
      Checkbox({ id: 'filter-favorite', name: 'favoriteOnly', label: LIST.favoriteOnly, checked: filters.favoriteOnly }),
      Checkbox({ id: 'filter-required', name: 'allRequired', label: LIST.allRequired, checked: filters.allRequired }),
      h('div', { class: 'tr-msg__actions' }, Button({ label: LIST.apply, variant: 'primary', type: 'submit' }), message.filtersActive ? Button({ label: LIST.clear, focusKey: 'filters-clear', onClick: () => ctl.clearFilters() }) : null),
    ],
  });
  return Message({
    message,
    ctl,
    title: LIST.title,
    children: [
      h('section', { class: 'tr-block', 'aria-labelledby': 'filters-title' }, h('h3', { class: 'tr-block__title', id: 'filters-title' }, LIST.filtersTitle), form),
      h(
        'div',
        { class: 'tr-counts', role: 'status', 'data-testid': 'list-counts' },
        h('p', { class: 'tr-msg__strong' }, LIST.count(message.shown, message.total)),
        message.filtersActive ? Notice({ tone: message.hidden > 0 ? 'attention' : 'info', text: LIST.hidden(message.hidden) }) : null,
      ),
      message.rows.length === 0 ? h('p', { class: 'tr-text' }, LIST.empty) : h('ol', { class: 'tr-people', 'aria-label': LIST.listLabel }, message.rows.map((row) => PersonItem(row, ctl))),
    ],
  });
};
