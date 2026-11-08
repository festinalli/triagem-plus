// Onde o botão "Ler esta página" aparece (D-10): na tela da busca, com a explicação, e na lista depois de ler, para a
// próxima página. Com a leitura desligada, a tela da busca mostra ali mesmo o jeito de ligar, com o aviso (RF-32). E o botão
// Próximo perfil (D-11), enquanto houver alguém só com pré-nota.
import { clickReadActive } from '../background/gesture.ts';
import { h } from './ui/h.ts';
import { Button } from './ui/components.ts';
import type { Controller } from './app.ts';
import { ClickReadSection } from './click-settings-view.ts';
import { NEXT_PROFILE, PAGE_BUTTON } from './click-strings.ts';
import { pendingTargets, readNextProfile } from './next-profile.ts';
import { PAGE_BUTTON_AVAILABLE, readThisPage } from './page-read-button.ts';

export function ReadPageBlock(ctl: Controller): HTMLElement | null {
  if (!PAGE_BUTTON_AVAILABLE) return null;
  if (!clickReadActive(ctl.snapshot().settings)) return ClickReadSection(ctl);
  return h(
    'section',
    { class: 'tr-block', 'aria-labelledby': 'read-page-title', 'data-testid': 'read-page' },
    h('h3', { class: 'tr-block__title', id: 'read-page-title' }, PAGE_BUTTON.title),
    h('p', { class: 'tr-text', id: 'read-page-help' }, PAGE_BUTTON.help),
    h('div', { class: 'tr-msg__actions' }, Button({ label: PAGE_BUTTON.read, variant: 'primary', describedBy: 'read-page-help', focusKey: 'read-page', onClick: () => readThisPage(ctl) })),
    h('p', { class: 'tr-text tr-text--small tr-text--muted' }, PAGE_BUTTON.firstTime),
  );
}

/** Depois de ler: só o botão, para a próxima página. */
export function ReadNextButton(ctl: Controller): HTMLElement | null {
  if (!PAGE_BUTTON_AVAILABLE || !clickReadActive(ctl.snapshot().settings)) return null;
  return h('div', { class: 'tr-msg__actions' }, Button({ label: PAGE_BUTTON.read, focusKey: 'read-page-next', onClick: () => readThisPage(ctl) }));
}

/** Abrir e ler o próximo perfil com pré-nota (D-11, RF-26). Some quando todos já têm nota completa. */
export function NextProfileBlock(ctl: Controller, where: 'top' | 'result'): HTMLElement | null {
  const snapshot = ctl.snapshot();
  if (!PAGE_BUTTON_AVAILABLE || !clickReadActive(snapshot.settings)) return null;
  const left = pendingTargets(snapshot.candidates).length;
  if (left === 0) return null;
  const helpId = `next-profile-help-${where}`;
  return h(
    'div',
    { class: 'tr-next', 'data-testid': `next-profile-${where}` },
    h('div', { class: 'tr-msg__actions' }, Button({ label: NEXT_PROFILE.button(left), variant: 'primary', describedBy: helpId, focusKey: `next-profile-${where}`, onClick: () => readNextProfile(ctl) })),
    h('p', { class: 'tr-text tr-text--small tr-text--muted', id: helpId }, NEXT_PROFILE.help),
  );
}
