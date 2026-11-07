// A moldura comum das mensagens da conversa: título que recebe o foco ao chegar, corpo e os botões do próximo passo.
import type { Action, ActionId, ConversationMessage } from '../core/conversation/build.ts';
import { h } from './ui/h.ts';
import type { Child } from './ui/h.ts';
import { Button } from './ui/components.ts';
import type { Controller } from './app.ts';
import { ACTIONS } from './strings.ts';

export function actionButtons(actions: readonly Action[], messageId: string, ctl: Controller, className = 'tr-msg__actions'): HTMLElement | null {
  if (actions.length === 0) return null;
  return h(
    'div',
    { class: className },
    actions.map((action) =>
      Button({
        label: ACTIONS[action.id],
        variant: action.danger ? 'danger' : action.primary ? 'primary' : 'secondary',
        focusKey: `${messageId}:${action.id}:${action.jobId ?? ''}`,
        onClick: () => ctl.run(action),
      }),
    ),
  );
}

/**
 * A moldura da mensagem. Os botões em `topActions` ficam logo abaixo do título, antes do corpo (por exemplo, Gerar PDF e Ver
 * todos antes da lista do Top 10); os outros botões do próximo passo ficam no fim.
 */
export function Message(props: { message: ConversationMessage; title: string; children?: Child; ctl: Controller; topActions?: readonly ActionId[] }): HTMLElement {
  const { message } = props;
  const top = props.topActions ?? [];
  const topList = message.actions.filter((action) => top.includes(action.id));
  const bottomList = message.actions.filter((action) => !top.includes(action.id));
  const titleId = `msg-${message.id}-title`;
  return h(
    'article',
    { class: ['tr-msg', `tr-msg--${message.kind}`], 'aria-labelledby': titleId, 'data-kind': message.kind },
    h('h2', { class: 'tr-msg__title', id: titleId, tabindex: -1, 'data-initial-focus': 'true' }, props.title),
    topList.length === 0 ? null : actionButtons(topList, message.id, props.ctl, 'tr-msg__actions tr-msg__actions--top'),
    h('div', { class: 'tr-msg__body' }, props.children),
    actionButtons(bottomList, message.id, props.ctl),
  );
}

export function formError(ctl: Controller, name: string): string | undefined {
  return ctl.ui.errors[name];
}

export function draft(ctl: Controller, name: string, fallback: string): string {
  return ctl.ui.drafts[name] ?? fallback;
}

