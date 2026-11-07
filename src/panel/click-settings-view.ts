// A parte de Ajustes da leitura por clique: estado, botão de ligar com o aviso, botão de desligar.
import { h } from './ui/h.ts';
import { Button, Notice } from './ui/components.ts';
import type { Controller } from './app.ts';
import { CLICK_READ } from './click-strings.ts';

export function ClickReadSection(ctl: Controller): HTMLElement {
  const { settings } = ctl.snapshot();
  const control = ctl.clickRead;
  const on = settings.clickReadEnabled && settings.acceptances.clickRead !== undefined;
  const since = settings.acceptances.clickRead;
  const status = on && since !== undefined ? CLICK_READ.statusOn(new Date(since.at).toLocaleDateString('pt-BR')) : CLICK_READ.statusOff;
  return h(
    'section',
    { class: 'tr-block', 'aria-labelledby': 'click-read-title', 'data-testid': 'click-read' },
    h('h3', { class: 'tr-block__title', id: 'click-read-title' }, CLICK_READ.title),
    h('p', { class: 'tr-text' }, CLICK_READ.intro),
    h('p', { class: 'tr-text', role: 'status', 'data-testid': 'click-read-status' }, status),
    on
      ? Button({ label: CLICK_READ.turnOff, focusKey: 'click-read-off', onClick: () => void control.disable() })
      : control.asking
        ? Notice({
            tone: 'attention',
            title: CLICK_READ.warningTitle,
            children: [
              CLICK_READ.warning.map((text) => h('p', { class: 'tr-text' }, text)),
              h(
                'div',
                { class: 'tr-msg__actions' },
                Button({ label: CLICK_READ.accept, variant: 'primary', focusKey: 'click-read-accept', onClick: () => void control.accept() }),
                Button({ label: CLICK_READ.cancel, focusKey: 'click-read-cancel', onClick: () => control.cancel() }),
              ),
            ],
          })
        : Button({ label: CLICK_READ.turnOn, focusKey: 'click-read-on', onClick: () => control.ask() }),
  );
}
