// Mensagem da busca (RF-20 a RF-24): versão completa e curta, operadores, limites conhecidos, Copiar e Abrir no LinkedIn.
// A extensão só monta o texto e o endereço. "Abrir" é um link comum, aberto por clique do usuário em aba nova, com o texto
// da busca no endereço e mais nada: nenhuma página é lida e nada é inserido nela (RF-23, RNF-03).
import type { Requirement } from '../core/model.ts';
import { OPERATOR_LIMITS, peopleSearchUrl } from '../core/search/build.ts';
import { h } from './ui/h.ts';
import { Button, LinkButton, Notice, RadioGroup, TextAreaField } from './ui/components.ts';
import type { SearchVersion } from './app.ts';
import { copyText } from './clipboard.ts';
import { Message } from './frame.ts';
import { ReadPageBlock } from './read-page-block.ts';
import type { MessageView } from './messages.ts';
import { SEARCH } from './strings.ts';

/** O motivo de a busca não ter texto, para a pessoa saber o que fazer. */
function emptyText(requirements: readonly Requirement[]): string {
  if (requirements.length === 0) return SEARCH.emptyNone;
  const required = requirements.filter((requirement) => requirement.importance === 'required');
  if (required.length === 0) return SEARCH.emptyOnlyPreferred;
  return required.every((requirement) => requirement.kind === 'total_experience') ? SEARCH.emptyOnlyTime : SEARCH.empty;
}

export const SearchView: MessageView<'search'> = (message, ctl) => {
  const { built } = message;
  const version: SearchVersion = ctl.ui.searchVersion ?? 'short';
  const startedShort = ctl.ui.searchVersion === null;
  const chosen = built[version];
  const refused = [...built.refusedRequirements, ...built.refusedExcluded];
  const empty = built.full.text === '';
  const salesLimit = OPERATOR_LIMITS.salesNavigator;

  const copy = async (): Promise<void> => {
    const ok = await copyText(chosen.text);
    ctl.setCopyStatus(ok ? 'copied' : 'manual');
    if (!ok) {
      const area = document.getElementById('search-text');
      if (area instanceof HTMLTextAreaElement) {
        area.focus();
        area.select();
      }
    }
  };

  return Message({
    message,
    ctl,
    title: SEARCH.title,
    children: [
      h('p', { class: 'tr-text' }, SEARCH.intro),
      empty
        ? Notice({ tone: 'attention', text: emptyText(ctl.snapshot().activeJob?.requirements ?? []) })
        : [
            startedShort ? Notice({ tone: 'info', text: SEARCH.startedShort }) : null,
            RadioGroup({
              name: 'search-version',
              legend: SEARCH.versionLabel,
              value: version,
              options: [
                { value: 'full', label: SEARCH.full },
                { value: 'short', label: SEARCH.short },
              ],
              onChange: (value) => ctl.setSearchVersion(value === 'short' ? 'short' : 'full'),
            }),
            TextAreaField({ id: 'search-text', label: SEARCH.textLabel, rows: 8, readonly: true, value: chosen.text }),
            h('p', { class: 'tr-text', 'data-testid': 'operators' }, SEARCH.operators(chosen.operators)),
            chosen.operators > salesLimit ? Notice({ tone: 'attention', text: SEARCH.overSales(salesLimit) }) : null,
            version === 'full' ? h('p', { class: 'tr-text tr-text--small tr-text--muted' }, SEARCH.noResults) : null,
            h(
              'div',
              { class: 'tr-msg__actions' },
              Button({ label: SEARCH.copy, variant: 'primary', focusKey: 'search-copy', onClick: () => void copy() }),
              LinkButton({ label: SEARCH.open, href: peopleSearchUrl(chosen.text), describedBy: 'search-open-help' }),
            ),
            h('p', { class: 'tr-text tr-text--small tr-text--muted', id: 'search-open-help' }, SEARCH.openHelp),
            h(
              'p',
              { class: 'tr-text tr-text--ok', role: 'status', 'data-testid': 'copy-status' },
              ctl.ui.copyStatus === 'copied' ? SEARCH.copied : ctl.ui.copyStatus === 'manual' ? SEARCH.copyManual : '',
            ),
            ReadPageBlock(ctl),
          ],
      refused.length > 0
        ? Notice({
            tone: 'attention',
            title: SEARCH.refusedTitle,
            children: h(
              'ul',
              { class: 'tr-plain-list' },
              refused.map((item) => h('li', null, SEARCH.refusedTerm(item.term, item.reason))),
            ),
          })
        : null,
      h(
        'section',
        { class: 'tr-block', 'aria-labelledby': 'limits-title' },
        h('h3', { class: 'tr-block__title', id: 'limits-title' }, SEARCH.limitsTitle),
        h(
          'ul',
          { class: 'tr-plain-list' },
          h('li', null, SEARCH.limitFree),
          h('li', null, SEARCH.limitSales(salesLimit)),
          h('li', null, SEARCH.limitRecruiter),
        ),
        h('p', { class: 'tr-text' }, SEARCH.monthlyLimit),
      ),
    ],
  });
};
