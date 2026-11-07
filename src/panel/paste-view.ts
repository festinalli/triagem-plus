// Colar o perfil (RF-30, RF-34, RF-37): caixa do texto, link e nome. O nome já vem preenchido com o que o leitor achou e
// continua sempre editável. Sem vaga ativa, ou com vaga sem requisitos, a mensagem explica o que falta em vez do formulário.
import { toLines } from '../core/profile/lines.ts';
import { profileKeyOf } from '../core/profile/merge.ts';
import { readNameFromLines } from '../core/profile/name.ts';
import { h } from './ui/h.ts';
import { Button, Form, formValues, Notice, TextAreaField, TextField } from './ui/components.ts';
import { draft, formError, Message } from './frame.ts';
import type { MessageView } from './messages.ts';
import { PASTE } from './strings.ts';

/** O nome da primeira linha do texto, olhando só o começo: o painel não analisa o texto inteiro a cada tecla. */
function nameFromText(text: string): string {
  return readNameFromLines(toLines(text.slice(0, 4000))) ?? '';
}

function input(root: ParentNode, name: string): HTMLInputElement | HTMLTextAreaElement | null {
  return root.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${name}"]`);
}

/** Liga os campos: nome sugerido a partir do texto (enquanto a pessoa não mexeu nele) e aviso de link fora do padrão. */
function wire(form: HTMLFormElement, warning: HTMLElement): void {
  const text = input(form, 'text');
  const name = input(form, 'name');
  const url = input(form, 'url');
  let touched = (name?.value ?? '') !== '';
  name?.addEventListener('input', () => {
    touched = true;
  });
  text?.addEventListener('input', () => {
    if (touched || name === null || text === null) return;
    name.value = nameFromText(text.value);
  });
  const check = (): void => {
    const value = url?.value.trim() ?? '';
    warning.hidden = value === '' || profileKeyOf(value) !== null || !/^https:\/\//i.test(value);
  };
  url?.addEventListener('input', check);
  url?.addEventListener('change', check);
  check();
}

export const PasteFormView: MessageView<'paste_form'> = (message, ctl) => {
  if (message.blocked === 'no_job') {
    return Message({ message, ctl, title: PASTE.blockedNoJobTitle, children: h('p', { class: 'tr-text', role: 'alert' }, PASTE.blockedNoJob) });
  }
  if (message.blocked === 'no_requirements') {
    return Message({ message, ctl, title: PASTE.blockedNoReqTitle, children: h('p', { class: 'tr-text', role: 'alert' }, PASTE.blockedNoReq) });
  }
  const adding = message.adding;
  const warning = h('div', { 'data-testid': 'url-warning', hidden: true }, Notice({ tone: 'attention', text: PASTE.urlNotProfile }));
  const form = Form({
    label: adding === null ? PASTE.title : PASTE.addingTitle,
    onSubmit: (element) => void ctl.submitPaste(formValues(element)),
    children: [
      TextAreaField({ id: 'text', label: PASTE.textLabel, help: PASTE.textHelp, rows: 9, maxlength: 400_000, value: draft(ctl, 'text', ''), error: formError(ctl, 'text') }),
      TextField({ id: 'url', name: 'url', label: PASTE.urlLabel, help: PASTE.urlHelp, maxlength: 2048, inputmode: 'url', value: draft(ctl, 'url', adding?.link ?? ''), error: formError(ctl, 'url') }),
      warning,
      TextField({ id: 'name', name: 'name', label: PASTE.nameLabel, help: PASTE.nameHelp, maxlength: 120, autocomplete: 'off', value: draft(ctl, 'name', adding?.name ?? ''), error: formError(ctl, 'name') }),
      Button({ label: adding === null ? PASTE.submit : PASTE.submitAdd, variant: 'primary', type: 'submit', block: true, disabled: ctl.ui.busy }),
    ],
  });
  wire(form, warning);
  return Message({
    message,
    ctl,
    title: adding === null ? PASTE.title : PASTE.addingTitle,
    children: [h('p', { class: 'tr-text' }, adding === null ? PASTE.intro : PASTE.addingIntro(adding.name)), form],
  });
};
