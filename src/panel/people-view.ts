// Peças que várias mensagens da triagem repartem: nota com faixa, linha de pessoa, link, resultado por requisito e o aviso
// de leitura incompleta. Nome, cargo, link e termos vêm de fora e entram sempre como texto, nunca como HTML (RNF-04).
import type { PersonRow, ReadNotice, RequirementLine } from '../core/conversation/triage.ts';
import type { Band, ProfileSection, RequirementStatus } from '../core/model.ts';
import { formatExperience } from '../core/report/model.ts';
import { h } from './ui/h.ts';
import type { Child } from './ui/h.ts';
import { Button, Notice, StatusPill } from './ui/components.ts';
import type { PillStatus } from './ui/components.ts';
import type { Controller } from './app.ts';
import { BAND_NAMES, NOTE_TEXTS, RESULT, SECTION_NAMES, STAGE_NAMES, STATUS_NAMES, TOP } from './strings.ts';

/** Nota e faixa juntas. A faixa vem sempre escrita: a cor sozinha nunca diz nada. */
export function ScoreBadge(props: { scored: boolean; score: number; band: Band; compact?: boolean }): HTMLElement {
  if (!props.scored) {
    return h('span', { class: ['tr-score', 'tr-score--none', props.compact && 'tr-score--compact'] }, h('span', { class: 'tr-score__num' }, RESULT.noScore));
  }
  return h(
    'span',
    { class: ['tr-score', `tr-score--${props.band}`, props.compact && 'tr-score--compact'] },
    h('span', { class: 'tr-visually-hidden' }, `${RESULT.scoreLabel}: `),
    h('span', { class: 'tr-score__num' }, String(props.score)),
    h('span', { class: 'tr-score__band' }, BAND_NAMES[props.band]),
  );
}

/** Link do perfil: clicável só quando é https seguro (RNF-04); senão aparece como texto. */
export function ProfileLink(props: { link: string | null; text: string }): HTMLElement {
  if (props.link === null) return h('span', { class: 'tr-person__link tr-text--muted' }, props.text, ' ', h('em', null, `(${TOP.noLink})`));
  return h('a', { class: 'tr-link tr-person__link', href: props.link, target: '_blank', rel: 'noopener noreferrer' }, props.text);
}

/**
 * Uma pessoa da lista, em duas linhas (cerca de 80 px em 360 px de largura).
 * Primeira: posição, nome (link para o perfil, quando for https seguro) e nota com faixa.
 * Segunda: cargo, etapa e os selos (não informado, favorito, prazo acabando).
 * O botão de detalhe fica à direita, discreto, com nome acessível próprio. Sem foto.
 */
export function PersonItem(row: PersonRow, ctl: Controller): HTMLElement {
  const name =
    row.link === null
      ? h('strong', { class: 'tr-person__name', title: row.linkText }, row.name)
      : h('a', { class: 'tr-link tr-person__name', href: row.link, target: '_blank', rel: 'noopener noreferrer', title: row.link, 'aria-label': TOP.linkNamed(row.name) }, row.name);
  return h(
    'li',
    { class: 'tr-person', 'data-candidate': row.id },
    h(
      'div',
      { class: 'tr-person__top' },
      h('span', { class: 'tr-person__rank' }, `${row.position}º`),
      name,
      ScoreBadge({ scored: row.scored, score: row.score, band: row.band, compact: true }),
      Button({ label: TOP.seeDetailShort, ariaLabel: TOP.seeDetailNamed(row.name), variant: 'quiet', focusKey: `person:${row.id}`, onClick: () => ctl.run({ id: 'show_detail', candidateId: row.id }) }),
    ),
    h(
      'div',
      { class: 'tr-person__bottom' },
      h('span', { class: 'tr-person__sub' }, `${row.currentTitle ?? TOP.noTitle} · ${STAGE_NAMES[row.stage]}`),
      row.link === null ? h('span', { class: 'tr-person__sub' }, `(${TOP.noLink})`) : null,
      row.notInformed ? StatusPill({ status: 'attention', label: TOP.notInformed }) : null,
      row.favorite ? StatusPill({ status: 'info', label: TOP.favorite }) : null,
      row.expiring ? StatusPill({ status: 'attention', label: TOP.expiring }) : null,
    ),
  );
}

const STATUS_PILL: Readonly<Record<RequirementStatus, PillStatus>> = { met: 'success', partial: 'attention', not_found: 'neutral', needs_reanalysis: 'info' };

function evidenceText(section: ProfileSection, term: string, jobTitles: readonly string[], months: number | null): string {
  return RESULT.evidence(SECTION_NAMES[section], term, jobTitles, months === null ? null : formatExperience(months));
}

function RequirementItem(line: RequirementLine): HTMLElement {
  return h(
    'li',
    { class: 'tr-req', 'data-requirement-status': line.status },
    h('div', { class: 'tr-req__head' }, h('span', { class: 'tr-req__label' }, line.label), h('span', { class: 'tr-req__importance' }, line.importance === 'required' ? RESULT.required : RESULT.preferred)),
    StatusPill({ status: STATUS_PILL[line.status], label: STATUS_NAMES[line.status] }),
    line.note === null ? null : h('p', { class: 'tr-req__note' }, NOTE_TEXTS[line.note]),
    line.status === 'needs_reanalysis' ? h('p', { class: 'tr-req__note' }, RESULT.reanalysisHelp) : null,
    line.evidence.length === 0
      ? null
      : h('ul', { class: 'tr-req__evidence', 'aria-label': RESULT.evidenceLabel }, line.evidence.map((item) => h('li', null, evidenceText(item.section, item.term, item.jobTitles, item.months)))),
  );
}

export function RequirementList(lines: readonly RequirementLine[]): HTMLElement {
  return h('ul', { class: 'tr-reqs', 'aria-label': RESULT.requirementsLabel }, lines.map(RequirementItem));
}

/** Aviso de leitura incompleta, com o que faltou e como completar (RF-35). Nulo quando a leitura veio boa. */
export function ReadNoticeView(notice: ReadNotice): HTMLElement | null {
  if (notice.level === 'ok' && !notice.truncated) return null;
  const facts: Child[] = [];
  if (notice.level === 'empty') facts.push(h('p', { class: 'tr-notice__text' }, RESULT.readEmpty));
  else if (notice.missing.length > 0) facts.push(h('p', { class: 'tr-notice__text' }, RESULT.readMissing(notice.missing.map((section) => SECTION_NAMES[section]))));
  if (notice.truncated) facts.push(h('p', { class: 'tr-notice__text' }, RESULT.readTruncated));
  facts.push(h('p', { class: 'tr-notice__text' }, RESULT.readHow));
  return Notice({ tone: 'attention', title: RESULT.readTitle, children: facts, class: 'tr-read-notice' });
}
